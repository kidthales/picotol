# Release Notes — `@kidthales/picotol` v0.4.1 (Pre-release)

Fifth public open-source pre-release of `@kidthales/picotol`, introducing an automated bundle size and compression budget auditor across all 6 CSS distribution bundles, synchronized README documentation and badge boundaries, and 5-gate CI parity across GitHub Actions and local verification.

> [!NOTE]
> **SemVer 2.0.0 Pre-release**: In accordance with SemVer 2.0.0 §4, versions in the `0.y.z` range represent initial development releases with evolving APIs. True stable major releases commence at `v1.0.0`.

---

## Highlights

### 1. Automated Bundle Size & Compression Budget Enforcement (`tools/check-budgets.mjs`) (#167)
- **Zero-Dependency Compression Auditor**: Introduced `tools/check-budgets.mjs` using native `node:zlib` (`gzipSync` level 9, `brotliCompressSync` quality 11) to compute raw, minified, gzip, and brotli byte lengths across all 6 CSS distribution bundles (`picotol.core.css`, `picotol.core.min.css`, `picotol.css`, `picotol.min.css`, `picotol.layer.css`, `picotol.layer.min.css`).
- **Hard CI Budget Ceilings**: Enforces deterministic ceilings (`picotol.core.min.css` $\le 14.0\text{ KB}$ minified / $\le 4.5\text{ KB}$ gzip; `picotol.min.css` and `picotol.layer.min.css` $\le 38.0\text{ KB}$ minified / $\le 9.0\text{ KB}$ gzip) and fails immediately on any budget breach.
- **Step Summary Telemetry**: Automatically emits a formatted Markdown telemetry table to `$GITHUB_STEP_SUMMARY` in GitHub Actions workflows alongside console output.

### 2. Documentation & Badge Synchronization (#167)
- **Badge & Tier Alignment**: Updated `README.md` bundle size badge (`<= 38 KB min | <= 9 KB gzip`) and Two-Tier Bundle Architecture documentation to match enforced automated budget ceilings.
- **Documentation Drift Guard**: `tools/check-budgets.mjs` inspects `README.md` directly during every test and CI run to guarantee documented size claims remain synchronized with enforced thresholds.

### 3. Five-Gate Local & Remote CI Parity (#167)
- **Dedicated Budget Gate**: Added `npm run check:budgets` to `package.json`, `.github/workflows/ci.yml`, and Gate 5 of `scripts/ci-local.ps1`, maintaining 1:1 parity between local pre-push verification and remote GitHub Actions pipelines.

---

## Installation

### npm (Public Registry — Zero Config)

```bash
npm install @kidthales/picotol@0.4.1
```

### GitHub Packages (Alternative)

Add the `@kidthales` registry to your `.npmrc`:

```ini
@kidthales:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @kidthales/picotol@0.4.1
```

### CDN (Drop-In)

```html
<!-- Core bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.4.1/dist/picotol.core.min.css">

<!-- Full bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.4.1/dist/picotol.min.css">

<!-- Layered bundle -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@kidthales/picotol@0.4.1/dist/picotol.layer.min.css">
```

### Standalone Offline Bundle & Checksums

Download `picotol-v0.4.1.zip`, `manifest.json`, and `SHA256SUMS.txt` directly from [GitHub Releases](https://github.com/kidthales/picotol/releases/tag/v0.4.1).

---

## Attribution & Acknowledgements

- **Dr. Paul Tol**: Qualitative colour schemes, palette constants, and accessibility principles sourced from SRON Netherlands Institute for Space Research technical note *"Colour Schemes"* (SRON/EPS/TN/09-002, 3-Clause BSD). See `NOTICE` for full attribution.
- **Lucas Larroche (Lucas Driscoll) / Pico CSS**: Semantic HTML selector patterns and class-light design inspiration under the MIT License.
