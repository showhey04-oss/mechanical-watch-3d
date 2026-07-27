# Phase 3C.2 正式黒革ストラップ・尾錠 証跡

## 由来

- Base：`feature/final-exterior-balanced-phase3c1-watch-head`
- Base SHA：`4de3c018f52ea88d1cbe5f4ad0c44166f7f89914`
- 再修正作業開始Head：`d3f414350c088250f9de3cc38182d1b3364d1e30`
- 再修正実装・browser harness基準：`292fb96a858c55a2f6bdd97bb3cff680d36ec671`
- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- branch：`feature/final-exterior-balanced-phase3c2-strap-buckle`
- APP_VERSION：`v3.15.0`
- query：`?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2`
- capture mode：same-origin unsandboxed iframe harness、actual Three.js WebGLRenderTarget PNG capture
- Phase 3C.1：`HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS`
- Phase 3C.2：`TECHNICAL_REQUIREMENTS_RESOLVED_PENDING_HUMAN_CONFIRMATION`

正本の`desktop-*`／`mobile-390-*`と`images/revision2`は実Three.js sceneのWebGLRenderTarget PNGである。`tests/generate-phase3c2-evidence.py`は正本captureを生成せず、実captureを入力としてclose-up、比較板、UI crop、review GIFを作る。GIFは実captureのreview animationであり連続WebM録画ではない。

## 再修正の実測

- 確定原因：`STRAP_BODY_WRAP_MESH_BOUNDARY`
- 旧可視overlap：0.900
- 新可視overlap：0
- 接続：shared-vertex C1 outer shell + real annular tunnel
- 12時／6時ストラップ：closed true、non-manifold edge 0
- 中心線長：75.000／115.000
- 終端接線角：95°／120°
- 非ラグ領域surface clearance：63.575
- refined lug：4本、root embed 0.170、edge break 0.075
- lug-to-lug：46.600、ラグ間20.000、外端Z ±23.300
- 禁止干渉：位置1／位置2とも0
- 登録部品：11
- blank selection：Desktop 10/10、390×844 10/10
- 革：`#211B17`、roughness 0.71、bumpScale 0.065、roughness variation ±0.06
- 外部画像asset／color map／CSG：不使用

## 原因診断画像

修正前：

- `images/revision2/diagnostics-before/product.png`
- `images/revision2/diagnostics-before/twelve-only.png`
- `images/revision2/diagnostics-before/six-only.png`
- `images/revision2/diagnostics-before/both-straps.png`
- `images/revision2/diagnostics-before/bodies-only.png`
- `images/revision2/diagnostics-before/wraps-only.png`
- `images/revision2/diagnostics-before/wireframe.png`
- `images/revision2/diagnostics-before/normal.png`
- `images/revision2/diagnostics-before/basic-front.png`
- `images/revision2/diagnostics-before/basic-double.png`
- `images/revision2/diagnostics-before/object-id.png`
- `images/revision2/diagnostics-before/depth.png`

修正後：

- `images/revision2/after/diagnostic-both-straps.png`
- `images/revision2/after/diagnostic-twelve-only.png`
- `images/revision2/after/diagnostic-six-only.png`
- `images/revision2/after/diagnostic-bodies-only.png`
- `images/revision2/after/diagnostic-wraps-only.png`
- `images/revision2/after/diagnostic-wireframe.png`
- `images/revision2/after/diagnostic-normal.png`
- `images/revision2/after/diagnostic-basic-front.png`
- `images/revision2/after/diagnostic-basic-double.png`
- `images/revision2/after/diagnostic-object-id.png`
- `images/revision2/after/diagnostic-depth.png`
- `images/revision2/after/diagnostic-backplane-top.png`
- `images/revision2/after/diagnostic-backplane-bottom.png`

## 修正後の静止画

- `images/revision2/after/desktop-front.png`
- `images/revision2/after/desktop-oblique.png`
- `images/revision2/after/desktop-side.png`
- `images/revision2/after/desktop-back.png`
- `images/revision2/after/desktop-top-strap.png`
- `images/revision2/after/desktop-bottom-strap.png`
- `images/revision2/after/top-strap-back.png`
- `images/revision2/after/bottom-strap-back.png`
- `images/revision2/after/buckle-detail.png`
- `images/revision2/after/opacity-100.png`
- `images/revision2/after/opacity-50.png`
- `images/revision2/after/opacity-16.png`
- `images/revision2/after/mobile-390-front.png`
- `images/revision2/after/mobile-390-side.png`
- `images/revision2/after/mobile-390-internal-selection.png`

既存正本、close-up、review board、GIFも同じ実装基準で再生成した。全一覧とbytes／SHA-256は`evidence-manifest.json`を正とする。

## Reports

- `reports/phase3c2-config.json`
- `reports/phase3c2-defect-diagnosis-before.json`
- `reports/phase3c2-defect-diagnosis-after.json`
- `reports/phase3c2-human-requirement-closure.json`
- `reports/geometry-report.json`
- `reports/interference-report.json`
- `reports/selection-opacity-report.json`
- `reports/material-report.json`
- `reports/world-bounds-camera.json`
- `reports/performance-results.json`
- `reports/suite-regression-results.json`
- `reports/regression-results.json`
- `reports/normal-path-diff.json`
- `reports/phase3c1-only-diff.json`
- `reports/capture-metadata.json`
- `reports/image-metrics.json`
- `reports/desktop-runtime.json`
- `reports/mobile-runtime.json`

`evidence-manifest.json`は自身を除くclosed-world一覧で、全ファイルのbytesとSHA-256を保持する。

## 試験状態

- Node：175/175
- runtime harness：Desktop 1280×720／390×844合格
- Geometry：finite、indexed、closed、outward。退化、重複・反転triangle、non-manifold edge、winding mismatch、coplanar overlap、z-fighting 0
- Material：opacity 100%で不透明、50%／16%契約と100%復帰合格
- 選択：11/11 HUD・学習同期、opacity 16%内部選択合格、空白解除10/10＋10/10
- 外装表示：ON／OFF、split、explode、restore合格
- performance：Desktop／390×844のidle・pointer・wheelは`DIFFERENTIAL_PASS`
- console error／warning：0
- 音声：Desktop／390×844ともスピーカーの信頼済みpointer gestureで23/23
- 試験閾値：変更なし
- PC／物理iPhone人間確認：再修正後は未実施

通常pathとPhase 3C.1-only pathにはPhase 3C.2 Object3D／Material／DOMを追加していない。承認Base `4de3c018...`と候補を同一Browser、同一固定状態で再取得し、両経路ともPNG bytes／SHA-256まで一致した。

全体CG感は`DEFERRED_GLOBAL_RENDERING_POLISH_TO_ISSUE_2`である。小秒選択性、A.5前後面明度差、Issue #2の照明・影・透過品質、PR #5、D2c3は本PRで変更していない。
