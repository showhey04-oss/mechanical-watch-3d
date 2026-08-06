# GitHub Pages runtime publish boundary R1

## Conclusion

The branch-based GitHub Pages build for main commit `f66cccede585356161e6d6069db06442a4a3637e` attempted to package repository evidence and historical assets together with the browser runtime. Run `31110184546` uploaded 1,090,357,153 bytes and timed out at the Pages deployment boundary. R1 preserves every repository file and instead prepares a runtime-only allowlist package for Human review.

R1 does not change GitHub Pages Settings, does not deploy production, and does not change the application. `APP_VERSION` remains `v3.15.0`.

## Source audit

- Base commit: `f66cccede585356161e6d6069db06442a4a3637e`
- Tracked source: 1,468,169,637 bytes across 6,734 files
- `docs/evidence`: 1,459,270,522 bytes across 6,348 files
- Captured media: 1,057,026,604 bytes across 5,481 files
- Tests: 2,078,552 bytes across 230 files
- Runtime audio selected by the manifest: 32,505 bytes across seven files including the manifest
- Historical audio references: 2,304,176 bytes across four files

The eight files at or above 10 MiB are historical JSON evidence. No tracked file reaches 50 MiB or 100 MiB. No evidence, audio reference, test, or history file is deleted, rewritten, or migrated.

## Runtime dependency boundary

`scripts/build-pages-site.mjs` derives an allowlist from:

- `index.html`
- `.nojekyll`
- both approved Home Screen icons
- all 41 current `js/*.js` runtime modules
- `assets/audio/manifest.json`
- the six files under the manifest's `runtime` object

The manifest's `references` array is provenance, not a fetch contract. `js/mechanical-audio.js` fetches only the six `runtime` files, so `assets/audio/references/**` is not published. Conditional imports of `tests/**` are diagnostic/test routes and are intentionally not part of the production package. The built-in `dimensionAudit=1` route remains available without publishing test harnesses.

Every source must be a regular non-symlink file. The builder rejects traversal, missing files, unresolved runtime audio, symlinks, hardlinks, byte mismatches, and packages at or above 512 MiB. It warns at 256 MiB and rebuilds `.pages-site/` from an empty directory each time.

## R1 package

- Runtime files: 52
- Runtime bytes: 1,166,897
- Excluded base files: 6,682
- Excluded bytes: 1,467,002,740
- Reduction: 1,467,002,740 bytes (99.9205%)
- 256 MiB warning: not reached
- 512 MiB hard limit: passed
- Source/stage SHA-256 parity: exact

## Workflow design

`.github/workflows/pages.yml` is build-only in R1. It runs for pull requests and manual dispatch, has only `contents: read`, executes the full Node suite, builds and verifies `.pages-site`, and uploads only `.pages-site` as a review artifact. There is no push-to-main trigger, deploy job, `pages: write`, `id-token: write`, `github-pages` environment, or `actions/deploy-pages` step.

The workflow uses the current official major lines verified from the official Action repositories on 2026-08-07: `actions/checkout@v6`, `actions/setup-node@v5`, `actions/configure-pages@v6`, and `actions/upload-pages-artifact@v4`. Checkout uses `fetch-depth: 0` because the audit and parity tests require the fixed base object.

The official upload action intentionally excludes dotfiles while constructing its deployment tar, so `.nojekyll` is present and SHA-verified in `.pages-site` but is recorded as the single transport exclusion. A custom Actions Pages deployment does not run the branch/Jekyll build, so `.nojekyll` is not required by that transport. The manifest records both the 52-file stage and the 51-file transport set instead of claiming they are identical. A future Human-authorized R2 may add the official `actions/deploy-pages@v4` build/deploy structure described by [GitHub Pages custom workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages). R1 does not change the repository's current Pages Source.

## Local runtime verification

Only `.pages-site/` was served over HTTP. Desktop 1280×720 and Mobile 390×844 passed default and `defaultProfile=legacy` routes. The default route rendered the completed watch, the legacy route remained available, `dimensionAudit=1` returned schemaVersion 2 with status `passed`, the three tabs were present, query-driven selection displayed the HUD and synchronized the learning text, time setting reached `03:00:00`, and audio toggled OFF → ON → OFF. The minute-wheel arbor selection remained behind the physical dial with no visible protrusion.

The runtime index, representative JS, audio manifest, runtime WAV, and Home Screen icon each returned HTTP 200 from the staged server. Console error/warning and runtime error counts were zero; no staged request returned 404.

## Protected scope

`index.html`, `js/**`, `assets/**`, both icon PNGs, Geometry, mechanism, rendering, camera, lighting, transparency, audio logic, UI, thresholds, and `APP_VERSION` are byte-unchanged from the base commit.

## R1 boundary

This Draft prepares a delivery recovery mechanism only. Human approval is required before Ready, merge, Pages Source changes, production deployment, or enabling a deploy job. Until a later production deployment succeeds, the capture baseline remains pending and video production remains blocked.
