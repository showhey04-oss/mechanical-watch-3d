# iPhone time input overflow evidence

This directory contains the before/after layout measurements, cross-browser matrix, decision record, and screenshots for the isolated physical-iPhone time-input fix.

## Provenance

- Base main commit: `155275d0aaeb968fd83d6dfe15313e259f2bb064`
- Implementation commit: `aca123f9dc3fd2d5bf0f9365beb56347cb1042cb`
- Branch: `fix/iphone-time-input-overflow`
- APP_VERSION: `v3.15.0`
- Routes: default and `?defaultProfile=legacy`
- Requested widths: 320, 375, 390, 393, and 430 CSS pixels

## Reports

- `reports/before-layout.json`: fixed-main measurements before focus, after focus, and after value/change/blur.
- `reports/after-layout.json`: candidate measurements under the same matrix.
- `reports/browser-matrix.json`: Installed Chrome, Playwright WebKit, Native Safari, UI/HUD/time-function, baseline A/B, Node, and console results.
- `reports/decision-summary.json`: bounded cause classification and merge/Human-review decision.
- `reports/image-inventory.json`: PNG byte size, SHA-256, pixel size, and CSS viewport.
- `evidence-manifest.json`: closed-world file inventory and SHA-256 values.

## Images

- `images/before-native-safari-390x844.png`
- `images/before-native-safari-393x852.png`
- `images/after-native-safari-390x844.png`
- `images/after-native-safari-393x852.png`
- `images/after-installed-chrome-320x568.png`
- `images/after-installed-chrome-1280x720.png`

Native Safari screenshots retain the device-pixel-ratio 2 backing size. Their filenames and inventory `cssViewport` fields identify the CSS viewport; the PNG dimensions are therefore 780×1688 for 390×844 and 786×1704 for 393×852.

## Interpretation boundary

The physical iPhone showed right-edge clipping in the native time-input presentation. Desktop automation did not reproduce an outer input-rectangle overflow on the main baseline. The evidence therefore demonstrates that the candidate stays within the measured layout contract and preserves time behavior; it does not convert the physical-device report into a synthetic desktop reproduction.

The full Node result is 471/473 with two unrelated failures inherited from the exact main base. Consequently this evidence does not claim complete acceptance and does not authorize a physical-iPhone fixed-commit URL, Ready state, or merge.
