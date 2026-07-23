# Movement / dial dimension audit evidence

## Purpose

Refactor Phase 1の読み取り専用寸法監査証跡。基準はmain `7cd1941c3239f7186a6d83695eab8ba347e2afd9`、アプリ実装基準は `90e14647190156d040fbd4aee1e74bf38c3442b3`。寸法・座標・形状・機構・通常表示は変更していない。

ETA公式高さ4.50 mmと現行アプリY包絡6.645 model unitは基準面が未対応のため、movement-heightは `REVIEW`。数値差は調整量ではない。32.20 model unitは `dialRingDiameter` / 表示開口候補であり、物理 `dialBlankDiameter` は `UNVERIFIED` とする。

## Fixed capture state

- time: `10:10:30`
- paused: `true`
- structural opacity: `100%`
- exploded / split: `false / false`
- panel: collapsed
- operation sound: OFF
- theme: navy
- viewports: 1280×720、390×844、393×852、375×667
- views: front (`reset`)、back (`movementBack`)、side、winding、motionWorks

監査注釈は `?dimensionAudit=1&dimensionOverlay=<mode>` の証跡専用canvasで、通常アクセスには存在しない。

## Reports

- [`current-model-dimensions.json`](reports/current-model-dimensions.json): 定義値、Object3D実Geometry、world座標、層範囲、機構不変条件
- [`reference-anchors.json`](reports/reference-anchors.json): ETA公式アンカーと分類語彙
- [`normalized-ratios.json`](reports/normalized-ratios.json): 基準面不一致の注記、対直径比・対半径比、Phase 2の3包絡計測方針
- [`dimension-differences.json`](reports/dimension-differences.json): KEEP / REVIEW / ADJUST_PHASE2 / UNVERIFIED。movement-heightはREVIEW、dialBlankDiameterはUNVERIFIED
- [`screen-space-ratios.json`](reports/screen-space-ratios.json): 4 viewport × 5 viewの20条件とcamera composition判定
- [`regression-results.json`](reports/regression-results.json): Node、desktop、mobile、PR #3、PR #4、音声、A.7、性能
- [`baseline-image-comparison.json`](reports/baseline-image-comparison.json): mainと監査ブランチの通常表示pixel exact比較
- [`evidence-manifest.json`](evidence-manifest.json): 閉世界ファイル一覧、サイズ、SHA-256

## Images

### Required views

- [`desktop-front.png`](images/desktop-front.png)
- [`desktop-back.png`](images/desktop-back.png)
- [`desktop-side.png`](images/desktop-side.png)
- [`mobile-390-front.png`](images/mobile-390-front.png)
- [`mobile-390-back.png`](images/mobile-390-back.png)
- [`mobile-390-side.png`](images/mobile-390-side.png)
- [`winding-works.png`](images/winding-works.png)
- [`motion-works.png`](images/motion-works.png)

### Annotated audit-only views

- [`annotated-front.png`](images/annotated-front.png)
- [`annotated-side.png`](images/annotated-side.png)
- [`main-train-center-layout.png`](images/main-train-center-layout.png)
- [`dial-hands-small-seconds-layout.png`](images/dial-hands-small-seconds-layout.png)
- [`y-layer-diagram.png`](images/y-layer-diagram.png)

### Normal-access baseline comparison

- [`normal-baseline-main.png`](images/normal-baseline-main.png)
- [`normal-branch.png`](images/normal-branch.png)

両画像は1280×720、同一camera quaternion、同一距離、同一target、同一1920×1080 drawing bufferでpixel exact。branch通常アクセスの監査用DOM数は0。

## Verification summary

| Suite | Result |
|---|---|
| Node | 56/56 |
| desktop comprehensive | 86/86 |
| 390×844 comprehensive | 87/88; existing walnut sampling guard only |
| PR #3 UI | 1280: 20/20、390: 22/22、375: 22/22 |
| PR #4 HUD | 390 / 393 / 375: each 57/57 |
| v3.14 audio | desktop / 390: each 23/23 |
| A.7 | 9/9 |
| interference | wind 0 / set 0 |
| hand coupling | 3/3; mount distance 0 |
| audit transform invariant | all 20 screen-space cases |
| normal baseline image | pixel exact |

393×852でPR #3 UIを補助実行した場合、既存試験ハーネスの厳密viewport許可値が `[375,390] × [667,844]` のため、そのガードだけが非適用となる。試験閾値は変更していない。393×852のHUD 57/57と寸法監査は合格している。

## Interpretation and Phase 2 handoff

- screen-space占有率が100%を超える条件は `REVIEW — camera composition`。モデル寸法縮小の根拠にはしない
- 針長、中心半径、りゅうず位置、輪列中心は対ムーブメント直径比と対ムーブメント半径比を併記
- Phase 2では `baseMovementEnvelope`、`handMountAndProtrudingArborEnvelope`、`applicationEnvelopeIncludingDialAndHands` を別々に計測する
- Phase 2の寸法変更は本証跡の対象外

## Performance

- front idle 10 s: 600 frames、59.61 fps、p50 16.70 ms、p95 16.80 ms、p99 17.40 ms
- over 33 ms / 50 ms: 0 / 0
- pointer / wheel: p95 17.60 ms、over 33 ms / 50 ms: 0 / 0
- per-frame audit Box3 / DOM / Object3D work: none

## Primary sources

- https://portal.eta.ch/en/6498-1-6498-1-5.html
- https://shopb2b.eta.ch/en/technicaldocuments/index/pdf/id/1915/
