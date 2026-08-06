# Pages runtime publish boundary R1 evidence

- Source main: `f66cccede585356161e6d6069db06442a4a3637e`
- Failed Pages run: `31110184546`
- Reported failed artifact: 1,090,357,153 bytes
- APP_VERSION: `v3.15.0`
- Product implementation changes: 0
- Pages Settings changes: 0
- Production deployments: 0

The source audit records 1,468,169,637 tracked bytes. Runtime staging contains 52 allowlisted files and 1,166,897 bytes, a 99.9205% reduction. The official upload transport excludes the zero-byte `.nojekyll` dotfile by design, so the modeled deployment tar has 51 files and the same byte total. Custom-workflow deployment does not invoke Jekyll. All evidence and historical assets remain in the repository but are outside the staged site.

## Files

- `source-size-inventory.json`: base-tree capacity audit and large-file inventory
- `runtime-dependency-register.json`: A/B/C/D classifications and zero unresolved dependencies
- `staging-manifest.json`: deterministic runtime file bytes and SHA-256
- `excluded-category-register.json`: excluded counts and sizes without deletion
- `local-browser-verification.json`: staged HTTP, Desktop/Mobile, route, interaction, and console results
- `review-summary.json`: independent read-only findings and R1 decision
- `captures/`: default/legacy Desktop/Mobile plus the minute-wheel arbor close-up
- `evidence-manifest.json`: closed-world SHA-256 inventory excluding itself

The browser captures are actual staged runtime screenshots. The in-app browser returned JPEG bytes, so the files retain the truthful `.jpg` extension rather than being mislabeled as PNG.
