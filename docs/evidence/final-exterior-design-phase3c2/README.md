# Phase 3C.2 正式黒革ストラップ・尾錠 証跡

## 由来

- Base：`feature/final-exterior-balanced-phase3c1-watch-head`
- Base SHA：`4de3c018f52ea88d1cbe5f4ad0c44166f7f89914`
- 最終ディテール実装・browser harness基準：`8dee0aed74a1041631fd2223505c3e01a2098294`
- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- branch：`feature/final-exterior-balanced-phase3c2-strap-buckle`
- APP_VERSION：`v3.15.0`
- query：`?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2`
- capture mode：same-origin unsandboxed iframe harness、actual Three.js WebGLRenderTarget PNG capture
- Phase 3C.1：`HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS`
- Phase 3C.2：`PENDING_PC_AND_PHYSICAL_IPHONE_HUMAN_CONFIRMATION`

正本の`desktop-*`／`mobile-390-*`は実Three.js sceneをoffscreen WebGLRenderTargetへ描画したPNGである。`part-selection-ui.png`、`opacity16-internal-selection-ui.png`、`mobile-panel-open-browser-raw.png`は実in-app Browser screenshotである。

`tests/generate-phase3c2-evidence.py`は正本captureを新規生成せず、実captureを入力としてclose-up、全長review板、UI crop、GIFを生成する。`desktop-full-length.png`は上側・本体・下側の実runtime segmentを並べたreview boardであり、単一camera frameとは主張しない。GIFは実captureを時系列に並べたreview animationで、連続WebM録画ではない。pointer／wheelの連続性はperformance harnessで別に検証する。

## 実測

- 中心線長：12時側75.000、6時側115.000
- 幅：19.700 → 16.000
- 厚さ：2.600 → 2.300 → 2.050
- 6時側穴：7個、直径2.000、pitch 7.000、自由端から24.000〜66.000
- spring-bar pocket：内径1.800相当、半径方向clearance 0.150
- keeper clearance：0.150
- 尾錠枠：19.000 × 15.500、開口16.600 × 12.800
- 取付バー：径1.200、長さ17.000
- つく棒：長さ13.000
- 禁止干渉：位置1／位置2とも0
- 登録部品：10
- 外部画像asset：0
- CSG：不使用

## 静止画

正本runtime capture：

- `images/desktop-front.png`
- `images/desktop-oblique-front.png`
- `images/desktop-side.png`
- `images/desktop-back.png`
- `images/desktop-top-strap.png`
- `images/desktop-bottom-strap.png`
- `images/top-strap-back.png`
- `images/bottom-strap-back.png`
- `images/buckle-detail.png`
- `images/hole-detail.png`
- `images/desktop-full-length-z2.png`
- `images/desktop-opacity-50.png`
- `images/desktop-opacity-16.png`
- `images/desktop-exterior-off.png`
- `images/desktop-split.png`
- `images/desktop-explode.png`
- `images/crown-position1.png`
- `images/crown-position2.png`
- `images/mobile-390-front.png`
- `images/mobile-390-side.png`
- `images/mobile-390-exterior-off.png`
- `images/mobile-390-split.png`
- `images/mobile-390-explode.png`
- `images/mobile-390-internal-selection.png`

実captureからの注記・比較：

- `images/desktop-full-length.png`
- `images/mobile-390-full-length.png`
- `images/lug-12-connection.png`
- `images/lug-6-connection.png`
- `images/spring-bar-wraps.png`
- `images/seven-hole-row.png`
- `images/six-free-tip.png`
- `images/buckle-frame-tang-bar.png`
- `images/keepers.png`
- `images/stitch-edge-grain.png`
- `images/strap-top-seam-closeup.png`
- `images/lug-12-wrap-closeup.png`
- `images/lug-6-wrap-closeup.png`
- `images/buckle-wrap-connection.png`
- `images/leather-grain-stitch-edge-closeup.png`
- `images/hardware-silver-closeup.png`
- `images/mobile-390-panel-open.png`

選択・経路差分：

- `images/part-selection-ui.png`
- `images/opacity16-internal-selection-ui.png`
- `images/normal-path-base.png`
- `images/normal-path-current.png`
- `images/phase3c1-path-base.png`
- `images/phase3c1-path-current.png`

## Review GIF

- `videos/01-complete-watch-rotation.gif`
- `videos/02-twelve-spring-bar-wrap.gif`
- `videos/03-six-spring-bar-wrap.gif`
- `videos/04-hole-row-to-free-tip.gif`
- `videos/05-buckle-frame-tang-bar.gif`
- `videos/06-fixed-floating-keepers.gif`
- `videos/07-exterior-on-off-on.gif`
- `videos/08-split-explode-restore.gif`
- `videos/09-mobile-rotate-zoom.gif`
- `videos/10-crown-operation-and-audio.gif`

## Reports

- `reports/phase3c2-config.json`
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

- Node：173/173（証跡追加後は全件再実行して最終件数をmanifestと合わせる）
- runtime harness：Desktop／390×844合格
- Geometry：有限・indexed・closed。退化、重複・反転triangle、non-manifold edge、winding mismatch、非有限法線、coplanar overlap、z-fighting 0
- 表面連続性：周期bump＋centerline UVでtop seam除去、巻込みtongueをラグ側0.900／尾錠側0.800だけ本体へ重ねて接続
- Material：革は100%時にopacity 1／transparent false／depthWrite true。color mapなし、silver金具refinement適用
- 選択：10/10で強調・HUD・学習同期、opacity 16%内部選択合格
- 空白クリック：追加blank hit target 0、症状を再現できなかったためglobal Raycaster変更なし
- 外装表示：ON／OFF、split、explode、復元合格
- 通常path：同一環境再取得SHA-256 `f3bdd25d543c11a4ae1dc08a3020a60358a85d5d20a90ccff9b8242bc35bd003`でBaseと一致
- Phase 3C.1-only path：同一環境再取得SHA-256 `083c16d2fa561f1c1c605e19fa2195cc75a0ffb827a6a83209686508acac803e`で承認Headと一致
- Desktop／390×844 idle・pointer・wheel：候補差分合格、閾値変更なし
- Desktop総合：A.5前後面明度差だけ未達し、承認済みPhase 3C.1にも同じIDで再現。Phase 3C.2固有回帰0
- Mobile総合、UI、HUD、trusted-gesture音声：合格
- console error／warning：0
- PC／物理iPhone人間確認：未実施

小秒選択性とIssue #2の照明・影・透過品質は保留を維持し、Phase 3C.2へ混在させていない。
