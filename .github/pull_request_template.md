## Summary
- 

## Verification Checklist
- [ ] `npm run generate` executed and `dist/` has zero uncommitted drift
- [ ] `npm run lint` passes (0 CSS AST errors, 100% Paul Tol hex purity, `--pt-*` / `--tol-*` namespace)
- [ ] `npm test` passes across all WCAG 2.2 contrast, reflow, and packaging suites
- [ ] Bundle byte budgets respected (`core` <= 9.5 KB, `full` <= 16.0 KB)
- [ ] Zero agent/scratch files tracked in git
