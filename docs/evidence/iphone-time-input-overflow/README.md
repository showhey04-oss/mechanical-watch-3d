# iPhone time input overflow evidence

This directory preserves the failed R1 physical-iPhone review and the R2 bounded-shell automation. R2 changes the visual-frame owner from the native time input to `.timeInputShell`; it does not replace the native picker.

## Provenance

- Base main commit: `155275d0aaeb968fd83d6dfe15313e259f2bb064`
- R1 review Head: `6e2be3b5714ae329309c581a07d351b6ebaaf621`
- R2 implementation commit: `e6f65ecdd67bde5b66d95587b2f195268e0171d8`
- Branch: `fix/iphone-time-input-overflow`
- APP_VERSION: `v3.15.0`
- Routes: default and `?defaultProfile=legacy`
- Requested viewports: 320×568, 336×667, 375×667, 390×844, 393×852, 430×932, and 1280×720

## Reports

- `reports/human-review-r1.json`: exact iPhone 16 / iOS 26.5.2 Human failure record.
- `reports/before-layout.json`: R1 fixed-main layout measurements retained for provenance.
- `reports/after-layout.json`: R2 shell/input measurements across 42 browser-route scenarios and focus stages.
- `reports/browser-matrix.json`: Chrome, WebKit, Native Safari, UI/HUD/time-flow, inherited-failure, and Node summaries.
- `reports/decision-summary.json`: R1 failure, confirmed visual cause, R2 automated decision, and pending Human gate.
- `reports/image-inventory.json`: PNG byte size, SHA-256, physical pixel size, CSS viewport, and evidence phase.
- `evidence-manifest.json`: closed-world SHA-256 inventory; the manifest does not include itself.

## R2 images

Native Safari captures preserve device-pixel-ratio 2 and cover before focus, focus, and after blur for 390×844 default, 390×844 legacy, and 393×852 default. Installed Chrome captures cover 320×568, 390×844, and 1280×720 after blur.

The R2 images show:

- left and right shell borders;
- left and right rounded corners;
- a 16px panel-body inset on both sides at 390×844;
- focus outline around the ordinary shell;
- native time text retained inside the shell;
- shell edges aligned with the action buttons below.

The six older, unprefixed images remain R1 desktop-automation provenance. They are not physical-iPhone PASS evidence.

## Interpretation boundary

R1 physical-iPhone review remains `FAIL`: value text was fixed, but the native outer frame was not. R2 desktop and macOS Safari automation demonstrates the new shell contract and preserved functionality; it does not prove physical-iPhone paint behavior.

The current automated state is `PR29_R2_AUTOMATED_GATES_PASSED_PENDING_PHYSICAL_IPHONE_REVIEW`. No completion, Ready, merge, or Human acceptance is implied.
