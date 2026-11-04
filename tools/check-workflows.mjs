// Real YAML Parser and Workflow Drift Auditor for GitHub Actions workflows.
// Powered by `yaml` (Node.js YAML 1.2 AST parser).
// Replaces fragile line-by-line indentation regexes with structured object traversal.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const FORBIDDEN_RUN_PATTERN = /\b(npm\s+(test|t|tst|run\s+test|run\s+lint|run\s+check:budgets|pack)|node\s+--test)\b/;

/**
 * Finds all unescaped ${{ ... }} expressions in a run: script string.
 * @param {string} runScript - The raw script from the step's run: field
 * @returns {boolean} True if an unescaped expression is found
 */
export function hasUnescapedExpression(runScript) {
  if (typeof runScript !== 'string') return false;
  return /\$\{\{/.test(runScript);
}

/**
 * Audits all GitHub Actions workflows in .github/workflows/ using the `yaml` parser.
 * @param {string} [rootDir=ROOT] - Project root directory
 * @returns {string[]} Array of violation messages (empty on success)
 */
export function auditWorkflows(rootDir = ROOT) {
  const workflowDir = path.join(rootDir, '.github', 'workflows');
  const errors = [];

  if (!fs.existsSync(workflowDir)) {
    errors.push('No workflow files found in .github/workflows/.');
    return errors;
  }

  const files = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  if (files.length === 0) {
    errors.push('No workflow files found in .github/workflows/.');
    return errors;
  }

  const requiredWorkflows = ['ci.yml', 'release.yml', 'pages.yml'];
  if (path.resolve(rootDir) === ROOT) {
    for (const req of requiredWorkflows) {
      if (!files.includes(req)) {
        errors.push(`Missing required workflow file: .github/workflows/${req}`);
      }
    }
  }

  const expectedCheckoutCounts = {
    'ci.yml': 2,
    'release.yml': 4,
    'pages.yml': 1,
  };

  let ciInvokesScript = false;

  for (const file of files) {
    const filePath = path.join(workflowDir, file);
    const rawContent = fs.readFileSync(filePath, 'utf8');

    let doc;
    try {
      doc = YAML.parse(rawContent);
    } catch (err) {
      errors.push(`${file}: Failed to parse YAML: ${err.message}`);
      continue;
    }

    if (!doc || typeof doc !== 'object') {
      errors.push(`${file}: Empty or non-object YAML workflow root.`);
      continue;
    }

    // 1. Root permissions check: must default to least-privilege read permissions
    const rootPerms = doc.permissions;
    if (rootPerms === 'write-all') {
      errors.push(`${file} grants root-level write permission '${rootPerms}'. All workflows must default to least-privilege read permissions at root.`);
    } else if (!rootPerms || (rootPerms !== 'read-all' && typeof rootPerms !== 'object')) {
      errors.push(`${file} must explicitly declare root-level least-privilege 'permissions: { contents: read }'.`);
    } else if (typeof rootPerms === 'object') {
      if (rootPerms.contents !== 'read') {
        errors.push(`${file} must explicitly declare root-level 'contents: read' permission.`);
      }
      for (const [permKey, permVal] of Object.entries(rootPerms)) {
        if (permVal === 'write') {
          errors.push(`${file} grants root-level write permission '${permKey}: write'. All workflows must default to least-privilege read permissions at root.`);
        }
      }
    }

    // 2. Job and step level traversal
    const jobs = doc.jobs || {};
    let checkoutCount = 0;

    for (const [jobKey, job] of Object.entries(jobs)) {
      if (!job || typeof job !== 'object') continue;

      // Check job permissions for unauthorized write
      const jobPerms = job.permissions;
      if (jobPerms === 'write-all') {
        errors.push(`${file} job '${jobKey}' grants unauthorized write-all permissions.`);
      }

      const steps = Array.isArray(job.steps) ? job.steps : [];
      for (const step of steps) {
        if (!step || typeof step !== 'object') continue;

        // Uses: action pin check
        if (typeof step.uses === 'string') {
          const actionRef = step.uses.trim();
          if (actionRef.startsWith('.') || actionRef.startsWith('$')) {
            const segments = actionRef.split('/');
            if (
              !/^(\.|\$)\/\.github\/actions\/[a-zA-Z0-9._-]+(\/[a-zA-Z0-9._-]+)*$/.test(actionRef) ||
              segments.slice(1).some((seg) => seg === '.' || seg === '..') ||
              actionRef.includes('..') ||
              actionRef.includes('@')
            ) {
              errors.push(`${file} step action '${actionRef}' is not a valid canonical local action path.`);
            }
          } else {
            const atIndex = actionRef.lastIndexOf('@');
            if (atIndex === -1) {
              errors.push(`${file} third-party action '${actionRef}' is missing a commit SHA pin.`);
            } else {
              const ref = actionRef.slice(atIndex + 1);
              if (!/^[a-fA-F0-9]{40}$/.test(ref)) {
                errors.push(`${file} third-party action '${actionRef}' is not pinned to a 40-character commit SHA.`);
              }
            }
          }

          // Checkout persist-credentials check
          if (actionRef.startsWith('actions/checkout')) {
            checkoutCount++;
            const withOpts = step.with || {};
            if (withOpts['persist-credentials'] !== false) {
              errors.push(`${file} contains actions/checkout step missing 'persist-credentials: false'.`);
            }
          }
        }

        // Run: script injection, forbidden commands, approved npm scripts
        if (typeof step.run === 'string') {
          const runScript = step.run;
          if (hasUnescapedExpression(runScript)) {
            errors.push(`${file} step '${step.name || 'unnamed'}' contains unescaped \${{ ... }} expression inside 'run:' script block (potential script injection). Pass values via 'env:' instead.`);
          }

          for (const line of runScript.split(/\r?\n/)) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('#')) continue;

            if (FORBIDDEN_RUN_PATTERN.test(trimmedLine)) {
              errors.push(`${file} invokes forbidden verification command in 'run:': '${trimmedLine}'`);
            }

            const npmRunMatch = trimmedLine.match(/\bnpm\s+run\s+([a-zA-Z0-9:_-]+)/);
            if (npmRunMatch) {
              const npmScript = npmRunMatch[1];
              if (!(npmScript === 'build' && (file === 'pages.yml' || file === 'release.yml'))) {
                errors.push(`${file} invokes unapproved 'npm run ${npmScript}' in 'run:' (only artifact 'npm run build' in pages.yml/release.yml is allowed)`);
              }
            }

            if (file === 'ci.yml' && /pwsh\b.*scripts\/ci-local\.ps1/.test(trimmedLine)) {
              ciInvokesScript = true;
            }
          }
        }
      }
    }

    // Checkout counts per workflow contract
    if (Object.hasOwn(expectedCheckoutCounts, file)) {
      const expected = expectedCheckoutCounts[file];
      if (checkoutCount !== expected) {
        errors.push(`${file} has ${checkoutCount} actions/checkout step(s), expected ${expected}.`);
      }
    } else if (checkoutCount === 0 && Object.keys(jobs).length > 0) {
      errors.push(`${file} has zero actions/checkout steps matched; expected at least one.`);
    }

    // 3. Workflow-specific architectural contracts
    if (file === 'release.yml') {
      const verifyJob = jobs.verify;
      const validCiUses = ['./.github/workflows/ci.yml', '$/.github/workflows/ci.yml'];
      if (!verifyJob || typeof verifyJob !== 'object' || !validCiUses.includes(verifyJob.uses)) {
        errors.push("release.yml verify job must delegate verification via 'uses: ./.github/workflows/ci.yml' or 'uses: $/.github/workflows/ci.yml'.");
      }
      if (!verifyJob || typeof verifyJob !== 'object' || !verifyJob.permissions || typeof verifyJob.permissions !== 'object' || verifyJob.permissions.contents !== 'read' || verifyJob.permissions['security-events'] !== 'write') {
        errors.push("release.yml verify job must explicitly scope permissions (contents: read, security-events: write).");
      }
      if (verifyJob && typeof verifyJob === 'object' && verifyJob.permissions && typeof verifyJob.permissions === 'object') {
        for (const [pKey, pVal] of Object.entries(verifyJob.permissions)) {
          if (pKey !== 'security-events' && pVal === 'write') {
            errors.push("release.yml verify job must not grant unauthorized write permissions.");
          }
        }
      }

      const tagGuardJob = jobs['tag-guard'];
      if (!tagGuardJob || typeof tagGuardJob !== 'object') {
        errors.push("release.yml must define a 'tag-guard' job.");
      } else {
        const tgPerms = (tagGuardJob.permissions && typeof tagGuardJob.permissions === 'object') ? tagGuardJob.permissions : null;
        if (!tgPerms || tgPerms.contents !== 'read' || Object.values(tgPerms).includes('write')) {
          errors.push("release.yml tag-guard job must explicitly define 'permissions: contents: read' and no write permissions.");
        }
        const tgSteps = Array.isArray(tagGuardJob.steps) ? tagGuardJob.steps : [];
        const tgScript = tgSteps.map((s) => (s && typeof s === 'object' && typeof s.run === 'string' ? s.run : '')).join('\n');
        if (!tgScript.includes('EXPECTED_TAG="v${PKG_VER}"')) {
          errors.push('release.yml tag-guard must construct expected tag as EXPECTED_TAG="v${PKG_VER}".');
        }
        if (!tgScript.includes('TAG="${RELEASE_TAG:-$REF_NAME}"')) {
          errors.push('release.yml tag-guard must fallback from RELEASE_TAG to REF_NAME.');
        }
        if (!/if\s*\[\s*-z\s*"\$TAG"\s*\];\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b/.test(tgScript)) {
          errors.push('release.yml tag-guard must fail closed (exit 1) inside the missing-tag branch.');
        }
        if (!/if\s*\[\s*"\$TAG"\s*!=\s*"\$EXPECTED_TAG"\s*\];\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b/.test(tgScript)) {
          errors.push('release.yml tag-guard must fail closed (exit 1) inside the tag-mismatch branch.');
        }
        for (const s of tgSteps) {
          if (!s || typeof s !== 'object') continue;
          if (s.with && s.with.cache && /npm/i.test(String(s.with.cache))) {
            errors.push('release.yml tag-guard job must not use shared npm cache.');
          }
          if (typeof s.uses === 'string' && s.uses.startsWith('actions/setup-node')) {
            if (!s.with || s.with['package-manager-cache'] !== false) {
              errors.push("release.yml tag-guard job actions/setup-node step must set 'package-manager-cache: false'.");
            }
          }
        }
      }

      if (verifyJob && typeof verifyJob === 'object') {
        const verifyNeeds = Array.isArray(verifyJob.needs) ? verifyJob.needs : [verifyJob.needs];
        if (!verifyNeeds.includes('tag-guard')) {
          errors.push('release.yml verify job must depend on tag-guard (needs: [tag-guard]).');
        }
      }

      for (const pubJob of ['publish-npm', 'publish-gpr', 'attach-assets']) {
        const j = jobs[pubJob];
        if (!j || typeof j !== 'object') {
          errors.push(`release.yml ${pubJob} job must exist.`);
        } else {
          const jNeeds = Array.isArray(j.needs) ? j.needs : [j.needs];
          if (!jNeeds.includes('verify')) {
            errors.push(`release.yml ${pubJob} job must depend on verify (needs: [verify]).`);
          }
          const jSteps = Array.isArray(j.steps) ? j.steps : [];
          for (const s of jSteps) {
            if (!s || typeof s !== 'object') continue;
            if (s.with && s.with.cache && /npm/i.test(String(s.with.cache))) {
              errors.push(`release.yml ${pubJob} job must not use shared npm cache.`);
            }
            if (typeof s.uses === 'string' && s.uses.startsWith('actions/setup-node')) {
              if (!s.with || s.with['package-manager-cache'] !== false) {
                errors.push(`release.yml ${pubJob} job actions/setup-node step must set 'package-manager-cache: false'.`);
              }
            }
          }
        }
      }

      const notifyJob = jobs.notify;
      if (notifyJob && typeof notifyJob === 'object') {
        const notifPerms = notifyJob.permissions;
        if (notifPerms && (notifPerms === 'write-all' || (typeof notifPerms === 'object' && Object.values(notifPerms).includes('write')))) {
          errors.push('release.yml notify job must not grant write permissions.');
        }
        const notifySteps = Array.isArray(notifyJob.steps) ? notifyJob.steps : [];
        const hasSkippedCheck = notifySteps.some(
          (s) => s && typeof s === 'object' && s.env && typeof s.env.ASSETS_STATUS === 'string' && s.env.ASSETS_STATUS.includes('attach-assets.result') && s.env.ASSETS_STATUS.includes('skipped')
        );
        if (!hasSkippedCheck) {
          errors.push('release.yml notify job must report skipped status when attach-assets is skipped.');
        }
      }
    }

    if (file === 'pages.yml') {
      const verifyJob = jobs.verify;
      const validCiUses = ['./.github/workflows/ci.yml', '$/.github/workflows/ci.yml'];
      if (!verifyJob || typeof verifyJob !== 'object' || !validCiUses.includes(verifyJob.uses)) {
        errors.push("pages.yml verify job must delegate verification via 'uses: ./.github/workflows/ci.yml' or 'uses: $/.github/workflows/ci.yml'.");
      }
      if (!verifyJob || typeof verifyJob !== 'object' || !verifyJob.permissions || typeof verifyJob.permissions !== 'object' || verifyJob.permissions.contents !== 'read' || verifyJob.permissions['security-events'] !== 'write') {
        errors.push("pages.yml verify job must explicitly scope permissions (contents: read, security-events: write).");
      }
      if (verifyJob && typeof verifyJob === 'object' && verifyJob.permissions && typeof verifyJob.permissions === 'object') {
        for (const [pKey, pVal] of Object.entries(verifyJob.permissions)) {
          if (pKey !== 'security-events' && pVal === 'write') {
            errors.push("pages.yml verify job must not grant unauthorized write permissions.");
          }
        }
      }

      const buildJob = jobs.build;
      if (buildJob && typeof buildJob === 'object') {
        const buildNeeds = Array.isArray(buildJob.needs) ? buildJob.needs : [buildJob.needs];
        if (!buildNeeds.includes('verify')) {
          errors.push('pages.yml build job must depend on verify (needs: [verify]).');
        }
      } else {
        errors.push('pages.yml must define a build job.');
      }

      const deployJob = jobs.deploy;
      if (deployJob && typeof deployJob === 'object') {
        const deployNeeds = Array.isArray(deployJob.needs) ? deployJob.needs : [deployJob.needs];
        if (!deployNeeds.includes('build')) {
          errors.push('pages.yml deploy job must depend on build (needs: [build]).');
        }
        const deployPerms = (deployJob.permissions && typeof deployJob.permissions === 'object') ? deployJob.permissions : {};
        if (deployPerms.pages !== 'write' || deployPerms['id-token'] !== 'write') {
          errors.push('pages.yml deploy job must explicitly scope permissions (pages: write, id-token: write).');
        }
        for (const [pKey, pVal] of Object.entries(deployPerms)) {
          if (pKey !== 'pages' && pKey !== 'id-token' && pVal === 'write') {
            errors.push('pages.yml deploy job must not grant unauthorized write permissions.');
          }
        }
      } else {
        errors.push('pages.yml must define a deploy job.');
      }

      for (const [jKey, jVal] of Object.entries(jobs)) {
        if (!jVal || typeof jVal !== 'object') continue;
        if (jKey !== 'deploy' && jKey !== 'verify' && jVal.permissions) {
          if (jVal.permissions === 'write-all' || (typeof jVal.permissions === 'object' && Object.values(jVal.permissions).includes('write'))) {
            errors.push(`pages.yml job '${jKey}' must not grant any write permissions.`);
          }
        }
      }
    }

    if (file === 'ci.yml') {
      if (doc.name !== 'CI') {
        errors.push("ci.yml workflow name must be 'CI' to match cancel-in-progress concurrency expression.");
      }
      if (!doc.on || !Object.hasOwn(doc.on, 'workflow_call')) {
        errors.push("ci.yml must support reusable workflow calls via 'workflow_call:'.");
      }

      const concurrency = doc.concurrency;
      if (!concurrency || typeof concurrency !== 'object') {
        errors.push("ci.yml concurrency block must isolate callers via github.workflow and scope cancel-in-progress to github.workflow == 'CI'.");
      } else {
        const groupNorm = typeof concurrency.group === 'string' ? concurrency.group.replace(/\s+/g, '') : '';
        const cancelRaw = typeof concurrency['cancel-in-progress'] === 'string'
          ? concurrency['cancel-in-progress'].replace(/\s+/g, '')
          : String(concurrency['cancel-in-progress'] ?? '');
        const cancelNorm = cancelRaw.replace(/"/g, "'");
        if (groupNorm !== '${{github.workflow}}-${{github.ref}}' || cancelNorm !== "${{github.workflow=='CI'}}") {
          errors.push("ci.yml concurrency block must isolate callers via github.workflow and scope cancel-in-progress to github.workflow == 'CI'.");
        }
      }

      const secJob = jobs.security;
      if (!secJob || typeof secJob !== 'object') {
        errors.push("ci.yml must define a dedicated 'security' job to run gitleaks and zizmor once rather than per matrix leg.");
      } else {
        const secPerms = (secJob.permissions && typeof secJob.permissions === 'object') ? secJob.permissions : {};
        if (secPerms.contents !== 'read' || secPerms['security-events'] !== 'write') {
          errors.push("ci.yml security job must explicitly scope permissions (contents: read, security-events: write).");
        }
        const secSteps = Array.isArray(secJob.steps) ? secJob.steps : [];
        const hasGitleaks = secSteps.some((s) => s && s.uses && s.uses.includes('gitleaks/gitleaks-action'));
        const hasZizmor = secSteps.some((s) => s && s.uses && s.uses.includes('zizmorcore/zizmor-action'));
        if (!hasGitleaks) {
          errors.push('ci.yml security job must run gitleaks secret detection.');
        }
        if (!hasZizmor) {
          errors.push('ci.yml security job must run zizmor workflow analysis.');
        }
        for (const [pKey, pVal] of Object.entries(secPerms)) {
          if (pKey !== 'security-events' && pVal === 'write') {
            errors.push('ci.yml security job must not grant unauthorized write permissions.');
          }
        }
      }

      for (const [jKey, jVal] of Object.entries(jobs)) {
        if (!jVal || typeof jVal !== 'object') continue;
        if (jKey !== 'security' && jVal.permissions) {
          if (jVal.permissions === 'write-all' || (typeof jVal.permissions === 'object' && Object.values(jVal.permissions).includes('write'))) {
            errors.push(`ci.yml job '${jKey}' must not grant any write permissions.`);
          }
        }
      }

      const verifyJob = jobs.verify;
      if (verifyJob && typeof verifyJob === 'object') {
        const vSteps = Array.isArray(verifyJob.steps) ? verifyJob.steps : [];
        if (vSteps.some((s) => s && s.uses && s.uses.includes('gitleaks/gitleaks-action'))) {
          errors.push('ci.yml verify matrix job must not run gitleaks (must run once in security job).');
        }
      }

      const notifyJob = jobs.notify;
      if (notifyJob && typeof notifyJob === 'object') {
        const notifIf = String(notifyJob.if || '');
        if (!/always\(\)\s*&&\s*github\.event_name\s*!=\s*['"]workflow_call['"]\s*&&\s*github\.workflow\s*==\s*['"]CI['"]/.test(notifIf)) {
          errors.push("ci.yml notify job must skip execution under workflow_call via 'if: always() && github.event_name != ''workflow_call'' && github.workflow == ''CI'''.");
        }
      }
    }
  }

  if (!ciInvokesScript && (files.includes('ci.yml') || path.resolve(rootDir) === ROOT)) {
    errors.push("ci.yml must invoke 'pwsh ./scripts/ci-local.ps1 -CI' in a 'run:' step.");
  }

  return errors;
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = auditWorkflows(ROOT);
  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`✖ ${err}`);
    }
    process.exit(1);
  }
  console.log('✔ All GitHub Actions workflows verified with zero drift (real YAML parser).');
}
