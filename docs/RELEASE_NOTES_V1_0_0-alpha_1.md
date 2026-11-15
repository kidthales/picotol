# Release Notes — `@kidthales/picotol` v1.0.0-alpha.1 (Pre-release)

Inaugural `v1.0.0` pre-release of `@kidthales/picotol`, published to the npm `next` distribution channel. Wave 1 hardens the supply-chain, release automation, provenance attestation, and documentation integrity pipelines while keeping the canonical `v0.7.0` CSS surface (`--pt-color`, `.pt-app`, `.pt-card`, `.pt-callout`, `.pt-badge`, and `@layer picotol.*`) unchanged and verified against upstream `kidthales/tol-palettes` with zero colour stop drift.

> [!NOTE]
> **SemVer 2.0.0 Pre-release (`next` channel)**: This release is published as `1.0.0-alpha.1` under `--tag next`. Stable `v1.0.0` promotion follows Wave 1 verification.

---

## Highlights

### 1. Deterministic Version Synchronization & 5-Manifest Parity (#290)
- **Single-Command Sync (`npm run sync:version`)**: `tools/sync-version.mjs` validates SemVer 2.0.0 coordinates, updates `package.json`, `package-lock.json`, and `CITATION.cff`, regenerates `dist/` in a fresh subprocess, and rewrites `README.md` pinned CDN URLs, SHA-384 SRI integrity attributes, GitHub release download URLs, and APA version metadata with transactional rollback on failure.
- **Fail-Closed Lint Gates**: `tools/lint.mjs` enforces 5-manifest version parity (`package.json`, `package-lock.json`, `CITATION.cff`, `dist/sri.json`, `dist/manifest.json`), strictly one versioned offline bundle (`dist/assets/picotol-v1.0.0-alpha.1.zip`) after stale archive cleanup in `tools/package-assets.mjs`, `dist/SHA256SUMS.txt` disk digest verification, and `README.md` SRI parity.

### 2. Pre-Release Channel Routing & 10-Artifact Sigstore Provenance (#261, #291)
- **Channel Routing**: `.github/workflows/release.yml` routes SemVer pre-releases (`*-*`) to `--tag next` and stable releases to `--tag latest` across npm and GitHub Packages, while verifying that `refs/tags/${TAG}^{commit}` matches `HEAD`.
- **10-Artifact Attestation**: `attach-assets` generates Sigstore build provenance via `actions/attest@v4` across all 6 CSS bundles (`dist/picotol*.css`), `dist/manifest.json`, `dist/sri.json`, `dist/SHA256SUMS.txt`, and `dist/assets/picotol-v1.0.0-alpha.1.zip`.
- **Epic PR Verification**: `.github/workflows/ci.yml` widens `pull_request` triggers to `[main, 'src-*/epic/**']` and supports `workflow_call.inputs.ref` for release tag verification.

### 3. Seldon Schema v2 Local CI & Workflow AST Hardening (#281, #282)
- **Local/Remote Parity**: `scripts/ci-local.ps1` emits structured Seldon Schema v2 `Gate Summary` lines and adds `-Gate0Only` / `-WorkflowsPath` support for isolated Gate 0 auditing.
- **Workflow Contract Enforcement**: `tools/check-workflows.mjs` enforces `timeout-minutes` bounds, `with.script` expression hygiene, and release attestation ordering via YAML AST parsing.

### 4. Relocated SRON Attribution & Doc-Lint Guards (#292)
- **Canonical Primary Source**: Updated Paul Tol's primary SRON attribution URLs to `https://sronpersonalpages.nl/~pault/` across `NOTICE`, `CITATION.cff`, and `README.md`, and fixed the `README.md` WCAG 2.2 badge link target (`tests/a11y.test.mjs`).
- **Zero Palette Drift & Regression Guards**: Confirmed zero hex stop drift against `kidthales/tol-palettes` (`npm run sync:upstream` / `data/tol-qualitative.json`) and added stale-SRON-URL and broken-badge regression guards in `tests/doc-lint.test.mjs`.

---

## Installation

### npm (Public Registry — `next` Channel)

```bash
npm install @kidthales/picotol@1.0.0-alpha.1
```

### GitHub Packages (Alternative)

Add the `@kidthales` registry to your `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol@1.0.0-alpha.1
```

### CDN (Drop-In)

```html
<!-- Core bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@1.0.0-alpha.1/dist/picotol.core.min.css" integrity="sha384-JPzVA+gv8XRbJNMICFA/poPOyG2iFGMMjX27vOgvGCD1otkmIO+9jPELybwAxqjW" crossorigin="anonymous">

<!-- Full bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@1.0.0-alpha.1/dist/picotol.min.css" integrity="sha384-aDjgHlaGZmviPq6Be9S9EgqLgsSAPP6cExWq2fN5g4zQ2tHAJQiQshiXq+Dcn88c" crossorigin="anonymous">

<!-- Layered bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@1.0.0-alpha.1/dist/picotol.layer.min.css" integrity="sha384-aDjgHlaGZmviPq6Be9S9EgqLgsSAPP6cExWq2fN5g4zQ2tHAJQiQshiXq+Dcn88c" crossorigin="anonymous">
```

### Standalone Offline Bundle & Checksums

Download `picotol-v1.0.0-alpha.1.zip`, `manifest.json`, and `SHA256SUMS.txt` directly from [GitHub Releases](https://github.com/kidthales/picotol/releases/tag/v1.0.0-alpha.1).

---

## Attribution & Acknowledgements

- **Dr. Paul Tol**: Qualitative colour schemes, palette constants, and accessibility principles sourced from SRON Netherlands Institute for Space Research technical note *"Colour Schemes"* (SRON/EPS/TN/09-002, 3-Clause BSD, [sronpersonalpages.nl/~pault/](https://sronpersonalpages.nl/~pault/)). See `NOTICE` for full attribution.
- **Lucas Larroche (Lucas Driscoll) / Pico CSS**: Semantic HTML selector patterns and class-light design inspiration under the MIT License.
