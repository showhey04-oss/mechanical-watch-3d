# Phase 3C.1 正式時計本体意匠 証跡

## 由来

- Base：`feature/final-exterior-balanced-phase3b2`
- Base SHA：`98d83781aa7aa001836a0d57f1ad6e3d058a15c4`
- 監査コミット：`9d9e6c83395adb0ec72ad269c3bac1a7f7c3a0d9`
- 実装・browser harness基準：`6d7eeac2b243609a7c7b4e9c734b235459376469`
- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- APP_VERSION：`v3.15.0`
- query：`?exterior=balanced&watchHead=phase3c1`
- capture mode：same-origin Browser harness、actual WebGL canvas capture、actual in-app Browser screenshot
- 状態：`IMPLEMENTATION_CANDIDATE_NOT_DEFAULT`

`desktop-*.png`、`mobile-390-*.png`、opacity、crown、normal-path画像は実Three.js sceneを同一origin harnessから描画・取得した。`panel-*.png`と`part-selection-ui.png`は実in-app Browser screenshotである。`tests/generate-phase3c1-evidence.py`は正本runtime captureを生成せず、正本と承認済みPhase 3B.2画像を入力に比較板、注記図、close-up、review GIFを生成する。

## 実測要約

- テンプ中心：world [7.700, 1.730, 1.800]
- 文字板投影：[7.700, 1.800]
- 12時基準角：76.842457°（実モデル約2時34分方向）
- 開口：直径6.600、縁0.320、文字板面積比3.5559%
- 中心誤差：0
- 小秒clearance：3.1894
- 最近接index clearance：1.3605
- 物理プレート窓：半径1.320×2、中心offset 1.900
- 中央軸受land clearance：0.100
- actual +Y Raycaster：709 samples
- 機構first-hit率：0.165021
- テンプfirst-hit率：0.133992
- 脱進機first-hit率：0.001410
- 機構移動／非表示／透明化による偽装：なし

## 正本runtime capture

- `desktop-front.png`
- `desktop-oblique-front.png`
- `desktop-side.png`
- `desktop-back.png`
- `desktop-oblique-back.png`
- `opacity-50.png`
- `opacity-16.png`
- `crown-position-1.png`
- `crown-position-2.png`
- `mobile-390-front.png`
- `mobile-390-oblique-front.png`
- `mobile-390-side.png`
- `mobile-390-opacity-16.png`
- `normal-base-phase3b2.png`
- `normal-branch.png`

## 実in-app Browser

- `part-selection-ui.png`
- `panel-open-browser.png`
- `panel-collapsed-browser.png`

パネル画像は実Browser viewport 664×814である。固定390×844については、WebGL captureとUI 22/22／HUD 57/57の実測結果を別途保存している。

## 監査・比較画像

- `actual-balance-position.png`
- `dial-plane-projection.png`
- `obstruction-section.png`
- `open-heart-candidate.png`
- `line-of-sight.png`
- `open-heart-before-after.png`
- `comparison-front.png`
- `comparison-oblique-front.png`
- `comparison-side.png`
- `comparison-back.png`
- `comparison-oblique-back.png`
- `open-heart-close.png`
- `small-second-close.png`
- `indices-close.png`
- `hands-close.png`
- `domed-crystal-side.png`
- `crown-position-1-close.png`
- `crown-position-2-close.png`
- `opacity-board.png`
- `mobile-board.png`
- `panel-board.png`

## Review GIF

- `video-01-watch-head-views.gif`
- `video-02-open-heart-review.gif`
- `video-03-dial-detail-review.gif`
- `video-04-opacity-cycle.gif`
- `video-05-crown-position-cycle.gif`
- `video-06-mobile-review.gif`
- `video-07-selection-review.gif`
- `video-08-phase3c2-backlog.gif`

GIFは実runtime captureを順序付けたreview animationであり、連続WebM録画ではない。入力連続性はA.6 pointer／wheel診断、モデル不変はtransform invariantで検証する。

## Reports

- `reports/phase3c1-config.json`
- `reports/open-heart-audit.json`
- `reports/geometry-report.json`
- `reports/selection-opacity-report.json`
- `reports/normal-path-diff.json`
- `reports/performance-results.json`
- `reports/regression-results.json`
- `reports/image-evidence-report.json`
- `reports/desktop-runtime.json`
- `reports/mobile-390-runtime.json`
- `reports/browser-suite-phase3b2-base-desktop.json`
- `reports/browser-suite-desktop.json`
- `reports/browser-suite-mobile.json`
- `reports/ui-suite-desktop.json`
- `reports/ui-suite-mobile.json`
- `reports/hud-suite-desktop.json`
- `reports/hud-suite-mobile.json`
- `reports/audio-suite-mobile-trusted-gesture.json`
- `reports/performance-raw.json`
- `reports/normal-path-capture.json`
- `reports/capture-metadata.json`

`evidence-manifest.json`は自身を除くclosed-world一覧で、各ファイルのbytesとSHA-256を持つ。

## 試験状態

`AUTOMATED_PASS_PENDING_PC_AND_PHYSICAL_IPHONE_HUMAN_REVIEW`

- Desktop総合：86/86
- 390×844総合：88/88
- UI：20/20、22/22
- HUD：45/45、57/57
- 音声：実スピーカー操作で23/23
- 通常path：237,334 byte／SHA-256 `a114aca62e07f03c9d67e7ada497b05f8007030a8b003f2171e4a8d82555ee5c`でBaseと一致
- Desktop／390×844のidle・pointer・wheel：絶対閾値と差分基準に合格
- 閾値変更：なし

## 人間確認

PCと物理iPhoneは未確認である。次を確認するまで既定採用、Ready化、マージを行わない。

- アイボリー色と既存照明下の金属階調
- 実テンプ位置へ合わせた開口の見え方
- 小秒、インデックス、3針の主従関係
- 100／50／16%透過、選択と解除
- 回転、ズーム、位置1／2、巻上げ、時刻合わせ、秒停止、作動音
- 既存Issue #2へ分離した影範囲境界
- Phase 3C.2の黒革ストラップ・尾錠意匠が未実装であること
