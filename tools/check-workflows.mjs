// Real YAML Parser and Workflow Drift Auditor for GitHub Actions workflows.
// Powered by `yaml` (Node.js YAML 1.2 AST parser).
// Replaces fragile line-by-line indentation regexes with structured object traversal.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

export const DEFAULT_MAX_TIMEOUT_MINUTES = 30;
export const SEMVER_RELEASE_TAG_REGEX = '^v[0-9]+\\.[0-9]+\\.[0-9]+(-(alpha|beta|rc)\\.[1-9][0-9]*)?$';
export const REQUIRED_RELEASE_ATTEST_SUBJECTS = [
  'dist/picotol*.css',
  'dist/assets/picotol-v*.zip',
  'dist/SHA256SUMS.txt',
  'dist/manifest.json',
  'dist/sri.json',
];

const EXPECTED_RELEASE_CHECKOUT_REF = '${{github.event.release.tag_name||inputs.tag||github.ref}}';
const EXPECTED_TAG_GUARD_SHA_REF = '${{needs.tag-guard.outputs.sha}}';
const EXPECTED_RELEASE_TAG_ENV = '${{github.event.release.tag_name||inputs.tag}}';
const EXPECTED_REF_NAME_ENV = '${{github.ref_name}}';
const EXPECTED_CI_CALL_CHECKOUT_REF = "${{inputs.ref||''}}";
const EXPECTED_NOTIFY_SHA_ENV = '${{needs.tag-guard.outputs.sha||github.sha}}';

function normalizeExpr(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, '') : '';
}

function stepHasReleaseTagEnv(step) {
  return Boolean(
    step &&
      typeof step === 'object' &&
      step.env &&
      normalizeExpr(step.env.RELEASE_TAG) === EXPECTED_RELEASE_TAG_ENV &&
      normalizeExpr(step.env.REF_NAME) === EXPECTED_REF_NAME_ENV
  );
}

const FORBIDDEN_RUN_PATTERN = /\b(npm\s+(test|t|tst|run\s+test|run\s+lint|run\s+check:budgets|pack)|node\s+--test)\b/;
export const FORBIDDEN_NPM_OIDC_ENV_KEYS = ['NODE_AUTH_TOKEN', 'NPM_TOKEN', 'NPM_CONFIG__AUTHTOKEN'];

function checkNpmCiIgnoreScripts(step, stepLabel, permDesc, errors) {
  if (!step || typeof step !== 'object' || typeof step.run !== 'string') return;
  for (const rawLine of step.run.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (/\bnpm\s+ci\b/.test(line) && !/(?:^|\s)--ignore-scripts(?=\s|$)/.test(line)) {
      errors.push(
        `${stepLabel} must pass '--ignore-scripts' to 'npm ci' so dependency lifecycle scripts cannot execute with ${permDesc}.`
      );
    }
  }
}

function checkForbiddenEnvBindings(envObj, forbiddenKeys, contextLabel, errors) {
  if (!envObj || typeof envObj !== 'object' || Array.isArray(envObj)) return;
  const upperForbidden = new Set(forbiddenKeys.map((k) => k.toUpperCase()));
  for (const key of Object.keys(envObj)) {
    if (upperForbidden.has(key.toUpperCase()) || /^NPM_CONFIG_.*_AUTHTOKEN$/i.test(key)) {
      errors.push(`${contextLabel} must not bind forbidden env '${key}' (tokenless OIDC required).`);
    }
  }
}

function collectDisallowedSecretsRefs(value, pathLabel, out = []) {
  if (typeof value === 'string') {
    for (const match of value.matchAll(/\bsecrets\s*\.\s*([A-Za-z0-9_]+)\b/gi)) {
      if (match[1].toUpperCase() !== 'GITHUB_TOKEN') {
        out.push({ secretName: match[1], location: pathLabel });
      }
    }
    for (const match of value.matchAll(/\bsecrets\s*\[\s*(['"])([^'"]+)\1\s*\]/gi)) {
      if (match[2].toUpperCase() !== 'GITHUB_TOKEN') {
        out.push({ secretName: match[2], location: pathLabel });
      }
    }
    return out;
  }
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      collectDisallowedSecretsRefs(value[i], `${pathLabel}[${i}]`, out);
    }
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      collectDisallowedSecretsRefs(v, `${pathLabel}.${k}`, out);
    }
  }
  return out;
}

function auditPublishNpmOidcContract(file, doc, pubNpm, errors) {
  const perms = pubNpm.permissions;
  const permKeys = perms && typeof perms === 'object' && !Array.isArray(perms) ? Object.keys(perms) : [];
  if (
    !perms ||
    typeof perms !== 'object' ||
    Array.isArray(perms) ||
    permKeys.length !== 2 ||
    perms.contents !== 'read' ||
    perms['id-token'] !== 'write'
  ) {
    errors.push(
      `${file} publish-npm job must declare exact permissions { contents: read, id-token: write } for OIDC Trusted Publishing.`
    );
  }

  const envName = typeof pubNpm.environment === 'string' ? pubNpm.environment : pubNpm.environment?.name;
  if (envName !== 'npm') {
    errors.push(
      `${file} publish-npm job must declare environment 'npm' for OIDC Trusted Publishing (got '${envName ?? ''}').`
    );
  }

  const requiredNodeRange = '>=24.5.0 <25';
  const steps = Array.isArray(pubNpm.steps) ? pubNpm.steps : [];
  const setupNodeSteps = steps.filter(
    (s) =>
      s &&
      typeof s === 'object' &&
      typeof s.uses === 'string' &&
      (s.uses.trim().startsWith('actions/setup-node@') || s.uses.trim() === 'actions/setup-node')
  );
  if (setupNodeSteps.length === 0) {
    errors.push(
      `${file} publish-npm job must include actions/setup-node with node-version: '${requiredNodeRange}'.`
    );
  } else {
    for (const snStep of setupNodeSteps) {
      const nv = String(snStep.with?.['node-version'] ?? '').trim();
      if (nv !== requiredNodeRange) {
        errors.push(
          `${file} publish-npm job step '${snStep.name || 'setup-node'}' must set node-version: '${requiredNodeRange}' (got '${nv}').`
        );
      }
    }
  }

  checkForbiddenEnvBindings(doc.env, FORBIDDEN_NPM_OIDC_ENV_KEYS, `${file} workflow`, errors);
  checkForbiddenEnvBindings(pubNpm.env, FORBIDDEN_NPM_OIDC_ENV_KEYS, `${file} publish-npm job`, errors);
  for (const { secretName, location } of [
    ...collectDisallowedSecretsRefs(doc.env, `${file} workflow env`),
    ...collectDisallowedSecretsRefs(pubNpm.env, `${file} publish-npm job env`),
  ]) {
    errors.push(
      `${location} must not reference secret 'secrets.${secretName}' (only tokenless OIDC or secrets.GITHUB_TOKEN is permitted for publish-npm).`
    );
  }

  for (const step of steps) {
    if (!step || typeof step !== 'object') continue;
    const stepLabel = `${file} publish-npm step '${step.name || 'unnamed'}'`;
    checkForbiddenEnvBindings(step.env, FORBIDDEN_NPM_OIDC_ENV_KEYS, stepLabel, errors);
    for (const { secretName, location } of collectDisallowedSecretsRefs(
      { env: step.env, with: step.with, run: step.run, if: step.if },
      stepLabel
    )) {
      errors.push(
        `${location} must not reference secret 'secrets.${secretName}' (only tokenless OIDC or secrets.GITHUB_TOKEN is permitted for publish-npm).`
      );
    }
    if (typeof step.run === 'string') {
      if (/\b(?:NODE_AUTH_TOKEN|NPM_TOKEN)\b/.test(step.run)) {
        errors.push(`${stepLabel} must not reference NODE_AUTH_TOKEN or NPM_TOKEN in run script.`);
      }
      if (/\bNPM_CONFIG_(?:[A-Z0-9_]*_)?_AUTHTOKEN\b/i.test(step.run)) {
        errors.push(`${stepLabel} must not reference NPM_CONFIG__AUTHTOKEN in run script.`);
      }
      if (/_authToken/i.test(step.run)) {
        errors.push(
          `${stepLabel} must not reference _authToken in run script (CLI flags, npm config, or .npmrc writes forbidden).`
        );
      }
      if (/\bnpm\s+(?:install|i|add)\b/.test(step.run)) {
        errors.push(
          `${stepLabel} must not run ad-hoc 'npm install' (use 'npm ci --ignore-scripts' and Node >=24.5.0 bundled npm).`
        );
      }
      if (!(perms && typeof perms === 'object' && !Array.isArray(perms) && perms['id-token'] === 'write')) {
        checkNpmCiIgnoreScripts(step, stepLabel, 'id-token: write', errors);
      }
      for (const rawLine of step.run.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        if (/\b(?:npx|npm\s+(?:exec|rebuild))\b/.test(line)) {
          errors.push(
            `${stepLabel} must not run '${line}' (dependency script execution forbidden in OIDC publish-npm job).`
          );
        }
      }
    }
  }
}

/**
 * Verifies `.github/zizmor.yml` pins `use-trusted-publishing` ignore strictly to
 * `publish-gpr`'s `npm publish` line in `release.yml` without inline ignores or drift.
 * @param {string} zizmorRaw - Raw YAML contents of `.github/zizmor.yml`
 * @param {string} releaseRaw - Raw YAML contents of `.github/workflows/release.yml`
 * @param {string[]} [errors] - Optional array to collect violation messages
 * @returns {string[]} Array of violation messages (empty on parity)
 */
export function auditZizmorConfig(zizmorRaw, releaseRaw, errors = []) {
  let zizmorDoc;
  try {
    zizmorDoc = YAML.parse(zizmorRaw);
  } catch (err) {
    errors.push(`.github/zizmor.yml: Failed to parse YAML: ${err.message}`);
    return errors;
  }

  const trustedIgnore = zizmorDoc?.rules?.['use-trusted-publishing']?.ignore;
  if (!Array.isArray(trustedIgnore)) {
    errors.push('.github/zizmor.yml must define rules.use-trusted-publishing.ignore array.');
    return errors;
  }
  if (trustedIgnore.length !== 1) {
    errors.push(
      `.github/zizmor.yml rules.use-trusted-publishing.ignore must pin strictly 1 line in release.yml (got ${trustedIgnore.length}).`
    );
    return errors;
  }

  const linePinMatch = String(trustedIgnore[0]).match(/^release\.yml:(\d+)$/);
  if (!linePinMatch) {
    errors.push(`.github/zizmor.yml expected release.yml:<line> entry, got '${trustedIgnore[0]}'.`);
    return errors;
  }
  const pinnedLineNum = Number(linePinMatch[1]);

  if (releaseRaw.includes('# zizmor: ignore')) {
    errors.push('release.yml must not contain inline # zizmor: ignore comments.');
  }

  const releaseLines = releaseRaw.split(/\r?\n/);
  if (pinnedLineNum < 1 || pinnedLineNum > releaseLines.length) {
    errors.push(`.github/zizmor.yml pinned line ${pinnedLineNum} is out of range for release.yml.`);
    return errors;
  }

  const publishGprStart = releaseLines.findIndex((l) => /^\s{2}publish-gpr:\s*$/.test(l)) + 1;
  const attachAssetsStart = releaseLines.findIndex((l) => /^\s{2}attach-assets:\s*$/.test(l)) + 1;
  if (publishGprStart <= 0 || attachAssetsStart <= publishGprStart) {
    errors.push('release.yml must declare publish-gpr before attach-assets for zizmor line-pin verification.');
    return errors;
  }

  const gprPublishOffset = releaseLines
    .slice(publishGprStart - 1, attachAssetsStart - 1)
    .findIndex((l) => /^\s*npm publish\b.*--registry=https:\/\/npm\.pkg\.github\.com\//.test(l));
  if (gprPublishOffset < 0) {
    errors.push('release.yml publish-gpr must contain npm publish --registry=https://npm.pkg.github.com/.');
    return errors;
  }

  const actualGprPublishLine = publishGprStart + gprPublishOffset;
  if (pinnedLineNum !== actualGprPublishLine) {
    errors.push(
      `zizmor line pin drifted: .github/zizmor.yml pins release.yml:${pinnedLineNum}, but publish-gpr's npm publish is at release.yml:${actualGprPublishLine}.`
    );
  }

  return errors;
}

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
 * @param {string|object} [options] - Workflows dir path or options object { workflowsDir }
 * @returns {string[]} Array of violation messages (empty on success)
 */
export function auditWorkflows(rootDir = ROOT, options = {}) {
  let workflowsDir = null;
  if (typeof options === 'string') {
    workflowsDir = options;
  } else if (options && typeof options === 'object' && options.workflowsDir !== undefined) {
    workflowsDir = options.workflowsDir;
  }

  if (workflowsDir !== null && (typeof workflowsDir !== 'string' || workflowsDir.trim() === '')) {
    return ['Invalid workflows directory specified: path must be a non-empty string.'];
  }

  const workflowDir = workflowsDir ? path.resolve(workflowsDir) : path.join(rootDir, '.github', 'workflows');
  const errors = [];

  if (!fs.existsSync(workflowDir)) {
    errors.push(workflowsDir ? `Workflows directory not found: ${workflowsDir}` : 'No workflow files found in .github/workflows/.');
    return errors;
  }

  const files = fs.readdirSync(workflowDir).filter((f) => f.endsWith('.yml') || f.endsWith('.yaml'));
  if (files.length === 0) {
    errors.push(workflowsDir ? `No workflow files found in ${workflowsDir}.` : 'No workflow files found in .github/workflows/.');
    return errors;
  }

  const resolveReal = (p) => {
    try {
      return fs.realpathSync.native ? fs.realpathSync.native(p) : fs.realpathSync(p);
    } catch {
      return path.resolve(p);
    }
  };

  const requiredWorkflows = ['ci.yml', 'release.yml', 'pages.yml'];
  const rootWfDir = path.join(ROOT, '.github', 'workflows');
  const isRootWorkflows = resolveReal(workflowDir).toLowerCase() === resolveReal(rootWfDir).toLowerCase();
  if (isRootWorkflows) {
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

      // Check timeout-minutes on step-executing jobs
      if (Array.isArray(job.steps)) {
        const timeout = job['timeout-minutes'];
        if (timeout === undefined || timeout === null) {
          errors.push(`${file} job '${jobKey}' must explicitly define 'timeout-minutes' (<= ${DEFAULT_MAX_TIMEOUT_MINUTES}).`);
        } else if (typeof timeout !== 'number' || !Number.isInteger(timeout) || timeout <= 0) {
          errors.push(`${file} job '${jobKey}' 'timeout-minutes' must be a positive integer.`);
        } else if (timeout > DEFAULT_MAX_TIMEOUT_MINUTES) {
          errors.push(`${file} job '${jobKey}' timeout-minutes ${timeout} exceeds maximum allowed limit of ${DEFAULT_MAX_TIMEOUT_MINUTES} minutes.`);
        }
      }

      const privilegedPerms = [];
      if (jobPerms && typeof jobPerms === 'object' && !Array.isArray(jobPerms)) {
        if (jobPerms['id-token'] === 'write') privilegedPerms.push('id-token: write');
        if (jobPerms.attestations === 'write') privilegedPerms.push('attestations: write');
        if (jobPerms.packages === 'write') privilegedPerms.push('packages: write');
      }

      const steps = Array.isArray(job.steps) ? job.steps : [];
      for (const step of steps) {
        if (!step || typeof step !== 'object') continue;

        if (privilegedPerms.length > 0) {
          const stepLabel = `${file} ${jobKey} step '${step.name || 'unnamed'}'`;
          checkNpmCiIgnoreScripts(step, stepLabel, privilegedPerms.join(' / '), errors);
        }

        // Uses: action pin check
        if (typeof step.uses === 'string') {
          const actionRef = step.uses.trim();
          if (actionRef.startsWith('.') || actionRef.startsWith('$')) {
            const segments = actionRef.split('/');
            if (
              !/^\$\/\.github\/actions\/[a-zA-Z0-9._-]+(\/[a-zA-Z0-9._-]+)*$/.test(actionRef) ||
              segments.slice(1).some((seg) => seg === '.' || seg === '..') ||
              actionRef.includes('..') ||
              actionRef.includes('@')
            ) {
              errors.push(`${file} step action '${actionRef}' is not a valid canonical local action path (zizmor self-repository rule requires '$/').`);
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

        // with.script: script injection inspection
        if (step.with && typeof step.with === 'object' && typeof step.with.script === 'string') {
          const withScript = step.with.script;
          if (hasUnescapedExpression(withScript)) {
            errors.push(`${file} step '${step.name || 'unnamed'}' contains unescaped \${{ ... }} expression inside 'with.script' block (potential script injection). Pass values via 'env:' instead.`);
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
      const dispatchTag =
        doc.on && typeof doc.on === 'object' && !Array.isArray(doc.on)
          ? doc.on.workflow_dispatch?.inputs?.tag
          : null;
      if (!dispatchTag || typeof dispatchTag !== 'object' || dispatchTag.type !== 'string' || dispatchTag.required !== false) {
        errors.push("release.yml must declare 'on.workflow_dispatch.inputs.tag' with 'type: string' and 'required: false'.");
      }

      for (const [jobKey, job] of Object.entries(jobs)) {
        if (!job || typeof job !== 'object') continue;
        const jobSteps = Array.isArray(job.steps) ? job.steps : [];
        const expectedCheckoutRef = jobKey === 'tag-guard' ? EXPECTED_RELEASE_CHECKOUT_REF : EXPECTED_TAG_GUARD_SHA_REF;
        const expectedCheckoutLabel =
          jobKey === 'tag-guard'
            ? '${{ github.event.release.tag_name || inputs.tag || github.ref }}'
            : '${{ needs.tag-guard.outputs.sha }}';
        for (const s of jobSteps) {
          if (s && typeof s === 'object' && typeof s.uses === 'string' && s.uses.trim().startsWith('actions/checkout')) {
            const refVal = normalizeExpr(s.with && typeof s.with === 'object' ? s.with.ref : '');
            if (refVal !== expectedCheckoutRef) {
              errors.push(`release.yml job '${jobKey}' actions/checkout step must pin 'with.ref' to '${expectedCheckoutLabel}'.`);
            }
          }
        }
      }

      const verifyJob = jobs.verify;
      if (!verifyJob || typeof verifyJob !== 'object' || verifyJob.uses !== '$/.github/workflows/ci.yml') {
        errors.push("release.yml verify job must delegate verification via 'uses: $/.github/workflows/ci.yml' (zizmor self-repository rule rejects './').");
      }
      const verifyRefVal = normalizeExpr(
        verifyJob && typeof verifyJob === 'object' && verifyJob.with && typeof verifyJob.with === 'object'
          ? verifyJob.with.ref
          : ''
      );
      if (verifyRefVal !== EXPECTED_TAG_GUARD_SHA_REF) {
        errors.push("release.yml verify job must pass 'with.ref' pinned to '${{ needs.tag-guard.outputs.sha }}'.");
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
        const tgOutputSha = tagGuardJob.outputs && typeof tagGuardJob.outputs === 'object' ? tagGuardJob.outputs.sha : '';
        if (typeof tgOutputSha !== 'string' || !/outputs\.sha/.test(tgOutputSha)) {
          errors.push("release.yml tag-guard job must declare 'outputs.sha' wired to the verified tag step output.");
        }
        const tgSteps = Array.isArray(tagGuardJob.steps) ? tagGuardJob.steps : [];
        const tgScript = tgSteps.map((s) => (s && typeof s === 'object' && typeof s.run === 'string' ? s.run : '')).join('\n');
        const tgResolveStep = tgSteps.find(
          (s) => s && typeof s === 'object' && typeof s.run === 'string' && s.run.includes('TAG="${RELEASE_TAG:-$REF_NAME}"')
        );
        if (!tgScript.includes('EXPECTED_TAG="v${PKG_VER}"')) {
          errors.push('release.yml tag-guard must construct expected tag as EXPECTED_TAG="v${PKG_VER}".');
        }
        if (!tgResolveStep) {
          errors.push('release.yml tag-guard must fallback from RELEASE_TAG to REF_NAME.');
        } else if (!stepHasReleaseTagEnv(tgResolveStep)) {
          errors.push("release.yml tag-guard step must pass 'RELEASE_TAG: ${{ github.event.release.tag_name || inputs.tag }}' and 'REF_NAME: ${{ github.ref_name }}'.");
        }
        if (!/if\s*\[\s*-z\s*"\$TAG"\s*\];\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b/.test(tgScript)) {
          errors.push('release.yml tag-guard must fail closed (exit 1) inside the missing-tag branch.');
        }
        if (!/if\s*\[\s*"\$TAG"\s*!=\s*"\$EXPECTED_TAG"\s*\];\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b/.test(tgScript)) {
          errors.push('release.yml tag-guard must fail closed (exit 1) inside the tag-mismatch branch.');
        }
        if (!tgScript.includes(SEMVER_RELEASE_TAG_REGEX)) {
          errors.push(`release.yml tag-guard must enforce SemVer pre-release regex '${SEMVER_RELEASE_TAG_REGEX}'.`);
        }
        if (!/if\s*\[\[\s*!\s*"\$TAG"\s*=~\s*\$SEMVER_TAG_RE\s*\]\];\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b/.test(tgScript)) {
          errors.push('release.yml tag-guard must fail closed (exit 1) inside the SemVer regex mismatch branch.');
        }
        const hasTagRefCheck =
          /refs\/tags\/\$\{?TAG\}?\^\{commit\}/.test(tgScript) &&
          /git\s+rev-parse\s+HEAD/.test(tgScript) &&
          /if\s+\[[^\n]*(?:"\$TAG_COMMIT"|refs\/tags\/)[^\n]*\];\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b/.test(tgScript);
        if (!hasTagRefCheck) {
          errors.push('release.yml tag-guard must fail closed (exit 1) when refs/tags/${TAG}^{commit} is missing or does not match HEAD.');
        }
        if (!/sha=.*>>\s*"\$GITHUB_OUTPUT"/.test(tgScript)) {
          errors.push('release.yml tag-guard must export verified commit SHA to GITHUB_OUTPUT.');
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
          if (!jNeeds.includes('tag-guard') || !jNeeds.includes('verify')) {
            errors.push(`release.yml ${pubJob} job must depend on tag-guard and verify (needs: [tag-guard, verify]).`);
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
          if (pubJob === 'publish-npm') {
            auditPublishNpmOidcContract(file, doc, j, errors);
          }
          if (pubJob === 'publish-npm' || pubJob === 'publish-gpr') {
            const pubScript = jSteps.map((s) => (s && typeof s === 'object' && typeof s.run === 'string' ? s.run : '')).join('\n');
            const hasDistTagSwitch =
              /if\s*\[\[\s*"\$PKG_VER"\s*==\s*\*-\*\s*\]\];\s*then(?:(?!\belse\b)[\s\S])*?DIST_TAG="next"(?:(?!\bfi\b)[\s\S])*?\belse\b(?:(?!\bfi\b)[\s\S])*?DIST_TAG="latest"(?:(?!\bfi\b)[\s\S])*?\bfi\b/.test(pubScript);
            const hasPublishDistTag = /\bnpm\s+publish\b[^\n]*--tag\s+"\$DIST_TAG"/.test(pubScript);
            if (!hasDistTagSwitch || !hasPublishDistTag) {
              errors.push(`release.yml ${pubJob} job must route SemVer pre-releases (*-*) to '--tag next' and stable releases to '--tag latest' via DIST_TAG.`);
            }
          }
        }
      }

      const attachJob = jobs['attach-assets'];
      if (attachJob && typeof attachJob === 'object') {
        const attachPerms = (attachJob.permissions && typeof attachJob.permissions === 'object') ? attachJob.permissions : {};
        if (attachPerms.contents !== 'write' || attachPerms.attestations !== 'write' || attachPerms['id-token'] !== 'write') {
          errors.push('release.yml attach-assets job must explicitly scope permissions (contents: write, attestations: write, id-token: write).');
        }
        for (const [pKey, pVal] of Object.entries(attachPerms)) {
          if (pKey !== 'contents' && pKey !== 'attestations' && pKey !== 'id-token' && pVal === 'write') {
            errors.push('release.yml attach-assets job must not grant unauthorized write permissions.');
          }
        }
        const attachSteps = Array.isArray(attachJob.steps) ? attachJob.steps : [];
        const buildIdx = attachSteps.findIndex(
          (s) => s && typeof s === 'object' && typeof s.run === 'string' && /\bnpm\s+run\s+build\b/.test(s.run)
        );
        const cleanIdx = attachSteps.findIndex(
          (s) =>
            s &&
            typeof s === 'object' &&
            typeof s.run === 'string' &&
            /if\s*!\s*test\s+-z\s+"\$\(git status --porcelain\)";\s*then(?:(?!\bfi\b)[\s\S])*?\bexit\s+1\b(?:(?!\bfi\b)[\s\S])*?\bfi\b/.test(s.run)
        );
        const attestIdx = attachSteps.findIndex(
          (s) => s && typeof s === 'object' && typeof s.uses === 'string' && (s.uses.startsWith('actions/attest@') || s.uses === 'actions/attest')
        );
        const uploadIdx = attachSteps.findIndex(
          (s) =>
            s &&
            typeof s === 'object' &&
            typeof s.run === 'string' &&
            s.run.includes('TAG_NAME="${RELEASE_TAG:-$REF_NAME}"') &&
            /gh\s+release\s+upload\s+"\$TAG_NAME"/.test(s.run)
        );

        if (buildIdx === -1) {
          errors.push('release.yml attach-assets job must run npm run build before verifying clean tree.');
        }
        if (cleanIdx === -1) {
          errors.push('release.yml attach-assets job must verify a clean post-build working tree (test -z "$(git status --porcelain)" with fail-closed exit 1).');
        }
        if (uploadIdx === -1 || !stepHasReleaseTagEnv(attachSteps[uploadIdx])) {
          errors.push('release.yml attach-assets job must resolve TAG_NAME="${RELEASE_TAG:-$REF_NAME}" from RELEASE_TAG (including inputs.tag) and upload to "$TAG_NAME".');
        }
        if (attestIdx === -1) {
          errors.push('release.yml attach-assets job must contain an actions/attest step for provenance attestation.');
        } else {
          const attestStep = attachSteps[attestIdx];
          const subjectPath = attestStep.with && attestStep.with['subject-path'];
          if (typeof subjectPath !== 'string' || subjectPath.trim().length === 0) {
            errors.push("release.yml attach-assets actions/attest step must declare a non-empty 'with.subject-path'.");
          } else {
            const subjectEntries = subjectPath.trim().split(/\s+/);
            for (const reqSubject of REQUIRED_RELEASE_ATTEST_SUBJECTS) {
              if (!subjectEntries.includes(reqSubject)) {
                errors.push(`release.yml attach-assets actions/attest step 'with.subject-path' must include '${reqSubject}'.`);
              }
            }
          }
        }
        if (
          buildIdx !== -1 &&
          cleanIdx !== -1 &&
          attestIdx !== -1 &&
          uploadIdx !== -1 &&
          !(buildIdx < cleanIdx && cleanIdx < attestIdx && attestIdx < uploadIdx)
        ) {
          errors.push('release.yml attach-assets steps must execute in order: npm run build < git status --porcelain < actions/attest < gh release upload.');
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
        const notifyTagStep = notifySteps.find(
          (s) => s && typeof s === 'object' && typeof s.run === 'string' && s.run.includes('TAG_NAME="${RELEASE_TAG:-$REF_NAME}"')
        );
        if (!notifyTagStep || !stepHasReleaseTagEnv(notifyTagStep)) {
          errors.push('release.yml notify job must resolve TAG_NAME="${RELEASE_TAG:-$REF_NAME}" from RELEASE_TAG (including inputs.tag).');
        } else {
          if (!/--arg\s+tag\s+"\$TAG_NAME"/.test(notifyTagStep.run)) {
            errors.push('release.yml notify job must pass --arg tag "$TAG_NAME" to jq.');
          }
          if (normalizeExpr(notifyTagStep.env?.SHA) !== EXPECTED_NOTIFY_SHA_ENV) {
            errors.push("release.yml notify job must pass 'SHA: ${{ needs.tag-guard.outputs.sha || github.sha }}'.");
          }
        }
      }
      const zizmorPath = path.join(path.dirname(workflowDir), 'zizmor.yml');
      if (fs.existsSync(zizmorPath)) {
        auditZizmorConfig(fs.readFileSync(zizmorPath, 'utf8'), rawContent, errors);
      } else if (isRootWorkflows) {
        errors.push('Missing required .github/zizmor.yml for release.yml use-trusted-publishing line-pin enforcement.');
      }
    }

    if (file === 'pages.yml') {
      const verifyJob = jobs.verify;
      if (!verifyJob || typeof verifyJob !== 'object' || verifyJob.uses !== '$/.github/workflows/ci.yml') {
        errors.push("pages.yml verify job must delegate verification via 'uses: $/.github/workflows/ci.yml' (zizmor self-repository rule rejects './').");
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
      const wfCallRef =
        doc.on && typeof doc.on === 'object' && !Array.isArray(doc.on)
          ? doc.on.workflow_call?.inputs?.ref
          : null;
      if (!wfCallRef || typeof wfCallRef !== 'object' || wfCallRef.type !== 'string' || wfCallRef.required !== false) {
        errors.push("ci.yml must declare 'on.workflow_call.inputs.ref' with 'type: string' and 'required: false'.");
      }
      for (const [jKey, jVal] of Object.entries(jobs)) {
        if (!jVal || typeof jVal !== 'object') continue;
        const jSteps = Array.isArray(jVal.steps) ? jVal.steps : [];
        for (const s of jSteps) {
          if (s && typeof s === 'object' && typeof s.uses === 'string' && s.uses.trim().startsWith('actions/checkout')) {
            const refVal = normalizeExpr(s.with && typeof s.with === 'object' ? s.with.ref : '').replace(/"/g, "'");
            if (refVal !== EXPECTED_CI_CALL_CHECKOUT_REF) {
              errors.push(`ci.yml job '${jKey}' actions/checkout step must set 'with.ref' to "\${{ inputs.ref || '' }}".`);
            }
          }
        }
      }
      const prBranches =
        doc.on && typeof doc.on === 'object' && !Array.isArray(doc.on)
          ? doc.on.pull_request?.branches
          : null;
      if (!Array.isArray(prBranches) || !prBranches.includes('main') || !prBranches.includes('src-*/epic/**')) {
        errors.push("ci.yml 'on.pull_request.branches' must include 'main' and 'src-*/epic/**' so Wave Epic sub-issue PRs run CI.");
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

  if (!ciInvokesScript && (files.includes('ci.yml') || isRootWorkflows)) {
    errors.push("ci.yml must invoke 'pwsh ./scripts/ci-local.ps1 -CI' in a 'run:' step.");
  }

  return errors;
}

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let workflowsDir = null;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--workflows-dir') {
      const next = args[i + 1];
      if (!next || next.startsWith('-')) {
        console.error('✖ Usage error: --workflows-dir requires a valid directory path argument.');
        process.exit(1);
      }
      workflowsDir = next;
      i++;
    } else if (arg.startsWith('--workflows-dir=')) {
      const val = arg.slice('--workflows-dir='.length).trim();
      if (!val) {
        console.error('✖ Usage error: --workflows-dir= requires a non-empty directory path argument.');
        process.exit(1);
      }
      workflowsDir = val;
    } else if (arg.startsWith('-')) {
      console.error(`✖ Unknown flag: ${arg}`);
      process.exit(1);
    }
  }

  const errors = auditWorkflows(ROOT, { workflowsDir });
  if (errors.length > 0) {
    for (const err of errors) {
      console.error(`✖ ${err}`);
    }
    process.exit(1);
  }
  console.log('✔ All GitHub Actions workflows verified with zero drift (real YAML parser).');
}
