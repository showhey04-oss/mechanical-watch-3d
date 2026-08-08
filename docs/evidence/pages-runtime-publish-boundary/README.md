# Pages runtime publish boundary R1–R2 evidence

- Source main: `f66cccede585356161e6d6069db06442a4a3637e`
- Failed Pages run: `31110184546`
- Reported failed artifact: 1,090,357,153 bytes
- APP_VERSION: `v3.15.0`
- Product implementation changes: 0
- Pages Settings changes: 0
- Production deployments: 0
- R1 hosted-runner recovery: run `31117611284`, attempt 3, PASS
- R1 artifact: `8981696222` / `github-pages` / 292,751 bytes
- R2 PR validation: run `31153243244`, PASS; deploy job skipped
- R2 validation artifact: `8984125070` / `github-pages` / 292,755 bytes

The source audit records 1,468,169,637 tracked bytes. Runtime staging contains 52 allowlisted files and 1,166,897 bytes, a 99.9205% reduction. The official upload transport excludes the zero-byte `.nojekyll` dotfile by design, so the modeled deployment tar has 51 files and the same byte total. Custom-workflow deployment does not invoke Jekyll. All evidence and historical assets remain in the repository but are outside the staged site.

## Files

- `source-size-inventory.json`: base-tree capacity audit and large-file inventory
- `runtime-dependency-register.json`: A/B/C/D classifications and zero unresolved dependencies
- `staging-manifest.json`: deterministic runtime file bytes and SHA-256
- `excluded-category-register.json`: excluded counts and sizes without deletion
- `local-browser-verification.json`: staged HTTP, Desktop/Mobile, route, interaction, and console results
- `review-summary.json`: independent read-only findings and R1 decision
- `r1-attempt3.json`: hosted runner, steps, tests, artifact, and no-deploy result
- `r2-pr-validation.json`: R2 workflow contract, PR CI result, and skipped deployment
- `captures/`: default/legacy Desktop/Mobile plus the minute-wheel arbor close-up
- `evidence-manifest.json`: closed-world SHA-256 inventory excluding itself

The browser captures are actual staged runtime screenshots. The in-app browser returned JPEG bytes, so the files retain the truthful `.jpg` extension rather than being mislabeled as PNG.

The repository Pages setting remained the legacy `main` `/` source throughout this preparation. No settings mutation or production deployment was performed. Both downloaded Actions artifacts were inspected as tar archives: each contained the 51 transported runtime files from `.pages-site` and no repository-root development or evidence paths.
