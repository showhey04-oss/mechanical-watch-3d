# iPhone time input overflow evidence

This closed-world evidence set preserves the R1 failure, the physical-iPhone R2 core acceptance, and the automated R3 centered `HH:MM:SS` polish result.

## Provenance

- Base main: `155275d0aaeb968fd83d6dfe15313e259f2bb064`
- R1 review Head: `6e2be3b5714ae329309c581a07d351b6ebaaf621`
- R2 implementation: `e6f65ecdd67bde5b66d95587b2f195268e0171d8`
- R3 start Head: `4a375c8818c1c73b50f47c34bb3cb47ec23e5776`
- R3 implementation: `b08e9762ff1557ad88ebef966bf9ee006f5fd644`
- Branch: `fix/iphone-time-input-overflow`
- APP_VERSION: `v3.15.0`
- Routes: default and `?defaultProfile=legacy`
- Viewports: 320×568, 336×667, 375×667, 390×844, 393×852, 430×932, and 1280×720

## Reports

- `human-review-r1.json`: exact failed R1 physical-iPhone record.
- `human-review-r2.json`: exact accepted R2 core-overflow record and requested R3 polish.
- `before-layout.json`: retained R1 layout provenance.
- `after-layout.json`: R3 42-scenario layout contract summary.
- `browser-matrix.json`: R3 browser, UI/HUD, functional, Native Safari, inherited-failure, and evidence limitations.
- `decision-summary.json`: chronological R1 → R2 → R3 decision state.
- `image-inventory.json`: PNG sizes and SHA-256 values.
- `evidence-manifest.json`: closed-world inventory; it does not include itself.

## Images

The unprefixed files are R1 automation provenance. `r2-*` files document the bounded-shell candidate evaluated before physical-iPhone R2 acceptance.

The valid `r3-installed-chrome-*` files show the centered `HH:MM:SS` visual layer before focus, during focus at 390×844, and after blur. They cover 320×568, 390×844, and 1280×720. They confirm the visible value, centering, shell borders/radii, symmetric insets, and action-button width alignment in the installed Chrome environment.

Native Safari R3 layout and function results are represented by measured JSON, not PNG. SafariDriver returned single-color full-page and element screenshots despite valid DOM rectangles; those invalid captures were excluded. This environment limitation is not converted into a physical-iPhone visual PASS. The existing R2 Native Safari PNGs remain historical R2 evidence.

PR #29-specific Node tests pass 12/12. The branch-wide suite is 475/477 with the same two unrelated completed-watch documentation-state expectations inherited at the PR start. PR #28 fixed Head `dbb4210361599427c60d5a44234b4c1eafd32f09` was independently re-run from a detached worktree and passes 465/465.

## Decision boundary

- R1: `PR29_R1_PHYSICAL_IPHONE_REVIEW_FAILED`
- R2: `PR29_R2_CORE_OVERFLOW_FIX_HUMAN_ACCEPTED`
- R3: `PR29_R3_AUTOMATED_GATES_PASSED_PENDING_PHYSICAL_IPHONE_REVIEW`

R3 is a nonblocking polish candidate. No complete, Ready, merge, body-completion, or release claim is made. The accepted R2 core fix remains the fallback if R3 Human review rejects the visual overlay.
