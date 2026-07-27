# Phase 3C.2 正式黒革ストラップ・尾錠 証跡

## 由来

- Base：`feature/final-exterior-balanced-phase3c1-watch-head`
- Base SHA：`4de3c018f52ea88d1cbe5f4ad0c44166f7f89914`
- 最終局所修正作業開始Head：`752418e72d3bb7b1dd86952638a3bb85fdf6d582`
- lug-case continuity実装基準：`2a9cfe31de83c631e6d99d50851f2cb4463684dc`
- surfacing修正作業開始Head：`9b55d5d3971ef456de5474b3bff6d3f26d6879f8`
- surfacing実装・browser harness基準：`00983f49b4dea623247e211cca54f3aac3f559ec`
- 意匠精査作業開始Head：`832d33a941af7f92ba10ae81079af09e59410e37`
- 意匠精査実装・browser harness基準：`5d51a74a21b12185fb854f9348e060c8eab440d5`
- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- branch：`feature/final-exterior-balanced-phase3c2-strap-buckle`
- APP_VERSION：`v3.15.0`
- query：`?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2`
- capture mode：same-origin unsandboxed iframe harness、actual Three.js WebGLRenderTarget PNG capture
- Phase 3C.1：`HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS`
- Phase 3C.2：`LUG_DESIGN_REFINEMENT_TECHNICALLY_RESOLVED_PENDING_HUMAN_DESIGN_CONFIRMATION`

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
- refined lug：4本、root embed 0.260、edge break 0.055、transition 4.297
- root断面：幅3.400 × 厚さ5.400、tip断面：幅2.000 × 厚さ2.000
- surfacing：16 station、24分割rounded superellipse、exponent 2.400
- root profile：ケース半径追従rootからeasingで単調に絞る閉合indexed Mesh
- mid-waist／S字反転：0、lug ↔ strap最小clearance：0.060889
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

## refined lug接続修正の履歴証跡

`images/lug-continuity-final/raw-before`は作業開始Head、`raw-after`は最終局所修正実装のactual Three.js captureである。比較板、close-up、接続注記、profile図はこれらの実captureと実装値だけから生成した。

- `images/lug-continuity-final/comparison-front.png`
- `images/lug-continuity-final/comparison-oblique.png`
- `images/lug-continuity-final/comparison-side.png`
- `images/lug-continuity-final/comparison-review-angle.png`
- `images/lug-continuity-final/lug-12-left-closeup.png`
- `images/lug-continuity-final/lug-12-right-closeup.png`
- `images/lug-continuity-final/lug-6-left-closeup.png`
- `images/lug-continuity-final/lug-6-right-closeup.png`
- `images/lug-continuity-final/lug-case-connection-annotation.png`
- `images/lug-continuity-final/root-profile-comparison.png`
- `videos/lug-continuity-final/front-oblique-side-continuous.gif`
- `videos/lug-continuity-final/review-angle-closeup-rotation.gif`
- `videos/lug-continuity-final/split-explode-restore.gif`
- `videos/lug-continuity-final/mobile-rotate-zoom.gif`

## refined lug surfacing最終局所修正の証跡

`images/lug-surfacing-final/raw-before`は人間確認で未承認となった作業開始Head `9b55d5d`、`raw-after`はsurfacing実装基準 `00983f4` のactual Three.js WebGLRenderTarget captureである。比較板、4ラグclose-up、注記図、profile図はこれらの実captureと実測runtime JSONだけから生成した。

- `images/lug-surfacing-final/comparison-front.png`
- `images/lug-surfacing-final/comparison-oblique.png`
- `images/lug-surfacing-final/comparison-side.png`
- `images/lug-surfacing-final/comparison-review-angle.png`
- `images/lug-surfacing-final/lug-12-left-closeup.png`
- `images/lug-surfacing-final/lug-12-right-closeup.png`
- `images/lug-surfacing-final/lug-6-left-closeup.png`
- `images/lug-surfacing-final/lug-6-right-closeup.png`
- `images/lug-surfacing-final/surfacing-continuity-annotation.png`
- `images/lug-surfacing-final/surfacing-profile.png`
- `videos/lug-surfacing-final/front-oblique-side-continuous.gif`

## refined lug意匠最終精査の証跡

`images/lug-design-refinement-final/raw-before`は人間確認で野暮ったさ・でっぷり感が残ると判定された作業開始Head `832d33a`、`raw-after`は意匠精査実装基準 `5d51a74` のactual Three.js WebGLRenderTarget captureである。比較板、4ラグclose-up、断面減衰図、注記図はこれらの実captureとruntime JSONから生成した。

- `images/lug-design-refinement-final/comparison-front.png`
- `images/lug-design-refinement-final/comparison-oblique.png`
- `images/lug-design-refinement-final/comparison-side.png`
- `images/lug-design-refinement-final/comparison-review-angle.png`
- `images/lug-design-refinement-final/design-reference-alignment-board.png`
- `images/lug-design-refinement-final/lug-12-left-closeup.png`
- `images/lug-design-refinement-final/lug-12-right-closeup.png`
- `images/lug-design-refinement-final/lug-6-left-closeup.png`
- `images/lug-design-refinement-final/lug-6-right-closeup.png`
- `images/lug-design-refinement-final/surfacing-continuity-annotation.png`
- `images/lug-design-refinement-final/surfacing-profile.png`
- `videos/lug-design-refinement-final/front-oblique-side-continuous.gif`
- `videos/lug-design-refinement-final/four-lug-comparison.gif`
- `videos/lug-design-refinement-final/split-explode-restore.gif`
- `videos/lug-design-refinement-final/opacity-100-50-16-100.gif`
- `videos/lug-design-refinement-final/mobile-rotate-zoom.gif`

元の人間参照画像はリポジトリへ保存されていない。`design-reference-alignment-board.png`は、元画像の雰囲気と構成を受けて承認済みとなったPhase 3C.1 alignment artifactを意匠基準側に置き、今回候補とのドレス感・軽快感の整合を確認する。

## Reports

- `reports/phase3c2-config.json`
- `reports/phase3c2-defect-diagnosis-before.json`
- `reports/phase3c2-defect-diagnosis-after.json`
- `reports/phase3c2-human-requirement-closure.json`
- `reports/phase3c2-lug-continuity-closure.json`
- `reports/phase3c2-lug-surfacing-closure.json`
- `reports/phase3c2-lug-design-refinement-closure.json`
- `reports/lug-design-capture-metadata.json`
- `reports/lug-design-image-metrics.json`
- `reports/lug-design-desktop-runtime.json`
- `reports/lug-design-mobile-runtime.json`
- `reports/lug-design-geometry-report.json`
- `reports/lug-design-interference-report.json`
- `reports/lug-design-protected-paths.json`
- `reports/lug-design-performance.json`
- `reports/lug-design-regression-results.json`
- `reports/lug-design-rotation-metadata.json`
- `reports/lug-design-split-explode-restore-metadata.json`
- `reports/lug-design-mobile-rotate-zoom-metadata.json`
- `reports/lug-surfacing-capture-metadata.json`
- `reports/lug-surfacing-image-metrics.json`
- `reports/lug-surfacing-desktop-runtime.json`
- `reports/lug-surfacing-mobile-runtime.json`
- `reports/lug-surfacing-protected-paths.json`
- `reports/lug-surfacing-performance.json`
- `reports/lug-surfacing-rotation-metadata.json`
- `reports/lug-continuity-capture-metadata.json`
- `reports/lug-continuity-image-metrics.json`
- `reports/lug-continuity-protected-paths.json`
- `reports/lug-continuity-performance.json`
- `reports/lug-continuity-rotation-metadata.json`
- `reports/lug-continuity-closeup-rotation-metadata.json`
- `reports/lug-continuity-split-explode-restore-metadata.json`
- `reports/lug-continuity-mobile-rotate-zoom-metadata.json`
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

- Node：186/186
- runtime harness：Desktop 1280×720／390×844合格
- Geometry：finite、indexed、closed、outward。退化、重複・反転triangle、non-manifold edge、winding mismatch、coplanar overlap、z-fighting 0
- Material：opacity 100%で不透明、50%／16%契約と100%復帰合格
- 選択：11/11 HUD・学習同期、opacity 16%内部選択合格、空白解除10/10＋10/10
- 外装表示：ON／OFF、split、explode、restore合格
- performance：Desktop／390×844のidle・pointer・wheelは`DIFFERENTIAL_PASS`。最大fps低下1.619%、最大p95増加0.100ms
- console error／warning：0
- 音声：Node音声試験合格。実ブラウザ統合は信頼済みpointer gesture後も開始Head／候補の双方でtimeoutし、候補固有回帰なしの環境制約として記録
- 試験閾値：変更なし
- refined lug最終局所修正：4視点の技術閉鎖項目は`RESOLVED`
- PC／物理iPhone人間確認：最終局所修正後は未実施

意匠精査候補では24 station／36断面分割、root 2.800 × 3.500、front／underside非対称断面、root面積proxy 46.623%削減、underside relief 1.400を実装した。Desktop／390×844 runtimeは全check合格、位置1／位置2禁止干渉0／0、通常path／Phase 3C.1-only pathはpixel exact、性能は各viewport 3反復中央値で`DIFFERENTIAL_PASS`、console error／warning 0である。ブロッキング5項目は技術的に`RESOLVED`だが、人間の意匠確認前にReady化・マージ・既定採用しない。

通常pathとPhase 3C.1-only pathにはPhase 3C.2 Object3D／Material／DOMを追加していない。承認Base `4de3c018...`と候補を同一Browser、同一固定状態で再取得し、両経路ともPNG bytes／SHA-256まで一致した。

全体CG感は`DEFERRED_GLOBAL_RENDERING_POLISH_TO_ISSUE_2`である。小秒選択性、A.5前後面明度差、Issue #2の照明・影・透過品質、PR #5、D2c3は本PRで変更していない。
