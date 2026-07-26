# Phase 3C.1 正式時計本体意匠 証跡

## 由来

- Base：`feature/final-exterior-balanced-phase3b2`
- Base SHA：`98d83781aa7aa001836a0d57f1ad6e3d058a15c4`
- 第3候補実装・browser harness基準：`7b660b768580d7dd1a7abe7c2c8520dc9f066985`
- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- APP_VERSION：`v3.15.0`
- query：`?exterior=balanced&watchHead=phase3c1`
- capture mode：same-origin Browser harness、actual WebGL canvas capture、actual in-app Browser screenshot
- 初回／第2候補人間確認：非承認
- 状態：`HUMAN_REVIEW_FAILED_PHASE3C1_SECOND_REVISION_REQUIRED`
- 第3候補：`THIRD_CANDIDATE_AUTOMATED_REVIEW_PENDING_PC_AND_PHYSICAL_IPHONE`
- 採用状態：`THIRD_IMPLEMENTATION_CANDIDATE_NOT_DEFAULT`

`desktop-*.png`、`mobile-390-*.png`、opacity、crown、normal-path画像は実Three.js sceneを同一origin harnessから描画・取得した。`panel-*.png`と`part-selection-ui.png`は実in-app Browser screenshotである。`tests/generate-phase3c1-evidence.py`は正本runtime captureを生成せず、正本と承認済みPhase 3B.2画像を入力に比較板、注記図、close-up、review GIFを生成する。

`before-revision-*.png`は初回、`before-third-*.png`は第2候補の固定履歴である。`comparison-*.png`は第2候補と第3候補を同一条件で比較する。矩形影境界はIssue #2の既知事項を隠さず、通常正面へ残している。

## 実測要約

- テンプ中心：world [7.700, 1.730, 1.800]
- 文字板投影：[7.700, 1.800]
- 12時基準角：76.842457°（実モデル約2時34分方向）
- 開口：直径6.600、縁0.260、文字板面積比3.5559%
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
- 主文字板：`#F2EDE5`、小秒文字板：`#F5F1EA`
- 共通シルバー：`#E9EDF0`、metalness 0.78～0.80、roughness 0.19～0.23
- desktop全テーマ前後面明度差：最大38.887%（A.5未達、閾値変更なし）
- 390×844全テーマ前後面明度差：最大29.899%
- Geometry監査：17対象、winding mismatch／reversed normal／退化／non-manifoldすべて0

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
- `display-normal.png`
- `display-split-100.png`
- `display-explode-100.png`
- `display-restored.png`

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
- `comparison-open-heart.png`
- `comparison-indices.png`
- `comparison-hands.png`
- `comparison-small-second.png`
- `comparison-domed-crystal.png`
- `comparison-crown.png`
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
- `revision-reference-alignment.png`
- `issue2-shadow-boundary.png`
- `dial-outside-shadow-close.png`
- `silver-case-side.png`
- `domed-crystal-oblique.png`
- `unified-silver-material-audit.png`
- `display-transform-board.png`

## Review GIF

- `video-01-watch-head-views.gif`
- `video-02-dial-close-review.gif`
- `video-03-open-heart-review.gif`
- `video-04-small-second-review.gif`
- `video-05-hands-review.gif`
- `video-06-crystal-side-review.gif`
- `video-07-crown-position-cycle.gif`
- `video-08-mobile-review.gif`
- `video-09-split-explode-restore.gif`

GIFは実runtime captureを順序付けたreview animationであり、連続WebM録画ではない。入力連続性はA.6 pointer／wheel診断、モデル不変はtransform invariantで検証する。

## Reports

- `reports/phase3c1-config.json`
- `reports/open-heart-audit.json`
- `reports/geometry-report.json`
- `reports/selection-opacity-report.json`
- `reports/material-runtime-audit.json`
- `reports/phase3c1-display-group-report.json`
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
- `reports/audio-suite-phase3b2-base-mobile.json`
- `reports/performance-raw.json`
- `reports/normal-path-capture.json`
- `reports/capture-metadata.json`

`evidence-manifest.json`は自身を除くclosed-world一覧で、各ファイルのbytesとSHA-256を持つ。

## 試験状態

初回と第2候補の人間非承認を維持し、第3候補を`THIRD_CANDIDATE_AUTOMATED_REVIEW_PENDING_PC_AND_PHYSICAL_IPHONE`として評価する。

- Phase 3C.1 runtime harness：Desktop／390×844とも合格。FRONT／CORE／BACK／PLATEのsplit／explodeと誤差1e-7以内の復元を含む
- Node：154/154
- Desktop総合：85/86。白系文字板によりA.5前後面明度差のみ未達（Phase 3B.2 Baseは86/86）
- 390×844総合：88/88
- UI：20/20、22/22
- HUD：45/45、57/57
- 音声：trusted clickを与えたが候補とPhase 3B.2 Baseの双方で同じintegration wait timeout。Node音声試験は合格
- 通常path：237,334 byte／SHA-256 `a114aca62e07f03c9d67e7ada497b05f8007030a8b003f2171e4a8d82555ee5c`でBaseと一致
- Desktop／390×844のidle・pointer・wheel：絶対閾値と差分基準に合格
- 閾値変更：なし
- Issue #2対象のlighting／shadow／transparent／depthWrite／D2c3変更：なし
- `PHYSICAL_IPHONE_MILD_WARMING_AFTER_15_MIN`：非ブロッキング観察事項。最終統合レビューでは15分連続確認を必須とする

## 人間確認

PCと物理iPhoneは未確認である。次を確認するまで既定採用、Ready化、マージを行わない。

- 白系アイボリー色と統一シルバーの既存照明下での階調
- 実テンプ位置へ合わせた開口の見え方
- 小秒、インデックス、3針の主従関係
- 100／50／16%透過、選択と解除
- 表裏分離100%、分解100%、復元後の全Phase 3C.1部品
- 回転、ズーム、位置1／2、巻上げ、時刻合わせ、秒停止、作動音
- 既存Issue #2へ分離した影範囲境界
- 100%→99%のtransparent不連続、55%→54%のdepthWrite不連続、透過時の暗部・深度順、PC／iPhone照明差はIssue #2のままであること
- Phase 3C.2の黒革ストラップ・尾錠意匠が未実装であること
