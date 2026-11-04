# Contributing to `@kidthales/picotol`

Thank you for your interest in contributing to `@kidthales/picotol`! We welcome bug reports, documentation improvements, design token audits, and code contributions.

## Code of Conduct

All contributors and maintainers are expected to adhere to our [Code of Conduct](CODE_OF_CONDUCT.md) (adapted from Contributor Covenant 2.1). Please review it to understand the community standards and reporting channels for unacceptable behavior.

## Architectural Invariants

Every contribution must preserve these core architectural invariants:

1. **100% Paul Tol Hex Purity**: Every hex color in `src/` and `dist/` must belong strictly to the canonical Paul Tol qualitative, diverging, or sequential datasets (`data/tol-qualitative.json`). Arbitrary `rgb()`, `hsl()`, `oklch()`, or non-Tol hex literals are prohibited and will fail the AST linter (`tools/lint.mjs`).
2. **Custom Property Namespace (`--pt-*` / `--tol-*`)**: Framework design tokens must reside under `--pt-*` and palette primitives must reside under `--tol-*`.
3. **WCAG 2.2 & Scalable Typography**: Never use `outline: none/0` or fixed `px` `font-size` declarations. All resting and hover states across all accent ladders must pass WCAG 2.2 AA ($\ge 4.5:1$ text, $\ge 3.0:1$ non-text borders). Universal `:focus-visible` high-contrast outlines and forced-colors fallbacks are mandatory.
4. **Automated Bundle Byte & Compression Budgets**: Bundle size, gzip, and brotli ceilings are managed in a single source of truth: [`tools/check-budgets.mjs`](tools/check-budgets.mjs) (established in #200). Do not restate or hardcode budget numbers by hand. All distribution bundles (`dist/picotol*.css`) are automatically audited against raw, minified, gzip, and brotli ceilings by `npm run check:budgets`.

## Commit & Pull Request Conventions

We enforce [Conventional Commits](https://www.conventionalcommits.org/) and a structured pull request lifecycle to ensure reproducible releases and clean changelog generation.

### Commit Messages

Commit messages must follow the standard conventional commit structure:

```
<type>(<optional scope>): <description>

[optional body]

[optional footer(s)]
```

- **Allowed Types**:
  - `feat`: A new feature or styling primitive.
  - `fix`: A bug fix or accessibility correction.
  - `docs`: Documentation-only updates (README, guides, JSDoc/types).
  - `style`: Formatting, whitespace, or non-functional lint corrections.
  - `refactor`: Code reorganization with zero functional or visual changes.
  - `perf`: Performance or minification improvements.
  - `test`: Adding or correcting automated tests.
  - `build`: Changes affecting build scripts or external build tooling.
  - `ci`: Changes to GitHub Actions workflows or local CI scripts.
  - `chore`: Housekeeping, dependency updates, or metadata adjustments.
- **Breaking Changes**: Append `!` after the type/scope (e.g. `feat(css)!: rename token`) and explain the migration steps in the commit footer under `BREAKING CHANGE:`.
- **Subject**: Use imperative present tense ("add", "fix", "update", not "added" or "adds"). Do not end the subject line with a period.

### Pull Requests

1. **Link Tracking Issues**: Every PR must reference its parent issue (e.g. `Closes #123` or `Addresses #123`).
2. **Draft First**: Pull requests should be opened as **Draft PRs** initially with a 1:1 checklist mirroring the issue's MVP acceptance criteria.
3. **CI Green**: All CI checks (linting, tests, workflow verification, bundle budget audits, and type checking) must pass cleanly.
4. **Single Responsibility**: Keep PRs focused on a single atomic feature, fix, or documentation change. Avoid mixing unrelated refactors into functional PRs.

## Development Workflow

### Prerequisites
- **Node.js**: `>= 22.2.0` (native `--test` runner and ESM support)
- **PowerShell**: `pwsh` 7+ for running local CI parity scripts

### Setup & Local Commands

1. **Install dependencies**:
   ```bash
   npm ci
   ```
2. **Regenerate tokens, bundles, SRI manifest, and demo HTML**:
   ```bash
   npm run generate
   ```
3. **Run the full AST linter and test suite**:
   ```bash
   npm test
   ```
4. **Run the 1:1 local continuous integration pipeline**:
   ```bash
   npm run ci:local
   # or directly in PowerShell:
   pwsh -NoProfile -ExecutionPolicy Bypass ./scripts/ci-local.ps1
   # Fast loop (lint & tests only):
   pwsh ./scripts/ci-local.ps1 -Quick
   ```

## Licensing & Inbound/Outbound Terms

By submitting a pull request, patch, or issue contribution to `@kidthales/picotol`, you agree that your contributions will be licensed under the project's [MIT License](LICENSE) (the standard inbound = outbound contribution model).

You certify under the **Developer Certificate of Origin (DCO 1.1)** that:
- The contribution was created in whole or in part by you, and you have the right to submit it under the MIT License; or
- The contribution is based upon previous work that is covered under an appropriate open-source license, and you have the right under that license to submit that work with modifications under the MIT License; or
- The contribution was provided directly to you by another person who certified the above, and you have not modified it.
