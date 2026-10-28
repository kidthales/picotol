## Summary
- 

## Verification Checklist
- [ ] Local CI executed via `npm run ci:local` (or `pwsh ./scripts/ci-local.ps1`) and exits 100% green
- [ ] `npm run generate` executed and `dist/` has zero uncommitted drift
- [ ] `npm run lint` passes (0 CSS AST errors, 100% Paul Tol hex purity, `--pt-*` / `--tol-*` namespace)
- [ ] `npm test` passes across all WCAG 2.2 contrast, reflow, and packaging suites
- [ ] Bundle byte budgets respected (core <= 12.0 KB, full <= 23.5 KB, layer <= 23.6 KB)
- [ ] Zero agent/scratch files tracked in git
