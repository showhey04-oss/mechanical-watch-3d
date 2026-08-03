# Phase 3C.1 正式時計本体意匠 証跡

## 由来

- Base：`feature/final-exterior-balanced-phase3b2`
- Base SHA：`98d83781aa7aa001836a0d57f1ad6e3d058a15c4`
- 最終微修正実装・browser harness基準：`50d651bea6d91b4be978e9e3b40a73053497c104`
- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- APP_VERSION：`v3.15.0`
- query：`?exterior=balanced&watchHead=phase3c1`
- capture mode：same-origin Browser harness、actual Three.js WebGLRenderTarget PNG capture、actual in-app Browser screenshot
- 初回／第2候補／第3候補人間確認：非承認
- 状態：`PHASE3C1_FINAL_MINOR_REVISION_PENDING_HUMAN_CONFIRMATION`
- 第4候補：PC／物理iPhone人間確認合格
- 最終微修正：`FINAL_MINOR_REVISION_AUTOMATED_VERIFICATION_COMPLETE`
- 採用状態：`FINAL_MINOR_REVISION_NOT_DEFAULT_PENDING_HUMAN_CONFIRMATION`

`desktop-*.png`、`mobile-390-*.png`、opacity、crown、normal-path画像は実Three.js sceneを同一origin harnessから描画・取得した。`panel-*.png`と`part-selection-ui.png`は実in-app Browser screenshotである。`tests/generate-phase3c1-evidence.py`は正本runtime captureを生成せず、正本と承認済みPhase 3B.2画像を入力に比較板、注記図、close-up、review GIFを生成する。

`before-revision-*.png`は初回、`before-third-*.png`は第2候補、`before-fourth-*.png`は第3候補の固定履歴である。現在の`comparison-*.png`は第3候補と第4候補を同一条件で比較する。矩形影境界はIssue #2の既知事項を隠さず、通常正面へ残している。

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
- 外装安定シルバー：`#E7EAED`、metalness 0.52、roughness 0.20、envMapIntensity 0.35。対象46 Meshはcandidate-local cloneでbase共有0
- 分目盛：中心半径14.200、同径60点、通常index clearance 0.437、12時double bar最小clearance 0.381178、表示開口clearance 0.575、重複0
- 非屈折ドーム風防：opacity 0.10、transmission 0、roughness 0.025、edge contrast保持率Desktop 96.460%／390×844 96.394%
- 6時index：1.820×0.440×0.230、バー総数13、実Geometry禁止干渉0。小秒凹面／目盛／針掃引／major dot／表示開口clearanceは1.968／2.479975／2.949939／0.435226／1.260226
- 外装表示グループ：25部品、OFF時管理対象visible 0／ON復元25。針3本とりゅうずはOFF対象外でsplit／explode family・操作・選択を維持
- UI：ラベル「外装」、helper DOM 0、操作領域44px、横overflow 0
- 選択：文字板priority 1、空白4点4／4、opacity 50%文字板、風防側面、index、針、opacity 16%内部選択。global Raycaster変更0
- desktop全テーマ前後面明度差：最大37.996%（A.5未達、閾値変更なし）
- 390×844全テーマ前後面明度差：最大28.901%
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
- `crystal-hidden-front.png`
- `exterior-off.png`
- `exterior-internal-selection.png`
- `exterior-split-off.png`
- `exterior-explode-off.png`
- `exterior-opacity16-off.png`
- `exterior-off-hands-t0.png`
- `exterior-off-hands-t1.png`
- `exterior-off-hands-t2.png`
- `exterior-off-crown-position1.png`
- `exterior-off-crown-position2.png`

## 実in-app Browser

- `part-selection-ui.png`
- `index-selection-ui.png`
- `hand-selection-ui.png`
- `crystal-selection-ui.png`
- `opacity16-internal-selection-ui.png`
- `panel-open-browser.png`
- `panel-collapsed-browser.png`

`panel-open-browser.png`と各選択UI画像は実Browser viewport 1280×720、既存の`panel-collapsed-browser.png`は履歴証跡として664×814である。固定390×844についてはWebGL captureとUI 22/22を保存した。HUDはfocus-visible／時刻blur順の3項目が同一環境のPhase 3B.2 Baseでも未達であり、今回固有の回帰ではない。

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
- `crystal-edge-comparison.png`
- `minute-track-close.png`
- `stable-silver-close.png`
- `exterior-group-board.png`
- `six-index-front.png`
- `six-index-small-second-clearance.png`
- `six-index-minute-clearance.png`
- `exterior-off-operational-parts.png`
- `exterior-ui-label.png`
- `dial-selection-four-points.png`
- `crystal-side-selection.png`
- `index-selection.png`
- `hand-selection.png`
- `opacity16-internal-selection.png`

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
- `video-10-exterior-group.gif`
- `video-11-exterior-on-off-on.gif`
- `video-12-exterior-off-hand-motion.gif`
- `video-13-exterior-off-crown-cycle.gif`
- `video-14-selection-sequence.gif`
- `video-15-split-explode-composition.gif`

GIFは実runtime captureを順序付けたreview animationであり、連続WebM録画ではない。入力連続性はA.6 pointer／wheel診断、モデル不変はtransform invariantで検証する。

## Reports

- `reports/phase3c1-config.json`
- `reports/open-heart-audit.json`
- `reports/geometry-report.json`
- `reports/selection-opacity-report.json`
- `reports/material-runtime-audit.json`
- `reports/fourth-candidate-visual-audit.json`
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
- `reports/hud-suite-phase3b2-base-desktop.json`
- `reports/audio-suite-mobile-trusted-gesture.json`
- `reports/audio-suite-phase3b2-base-mobile.json`
- `reports/performance-raw.json`
- `reports/normal-path-capture.json`
- `reports/capture-metadata.json`
- `reports/browser-capture-metadata.json`

`evidence-manifest.json`は自身を除くclosed-world一覧で、各ファイルのbytesとSHA-256を持つ。

## 試験状態

初回、第2候補、第3候補の人間非承認と第4候補のPC／物理iPhone合格を維持し、最終微修正を`PHASE3C1_FINAL_MINOR_REVISION_PENDING_HUMAN_CONFIRMATION`として評価する。

- Phase 3C.1 runtime harness：Desktop／390×844とも合格。安定シルバー、60分目盛、風防edge contrast、外装表示グループ、FRONT／CORE／BACK／PLATEのsplit／explodeと誤差1e-7以内の復元を含む
- Node：155/155
- Desktop総合：85/86。白系文字板によりA.5前後面明度差のみ未達（Phase 3B.2 Baseは86/86）
- 390×844総合：88/88
- UI：20/20、22/22
- HUD：focus-visible／時刻blur順3項目がDesktop／390×844で未達。同一環境のPhase 3B.2 Baseにも同じ3 IDを再現し、PR固有回帰0
- 音声：trusted clickを与えたが候補とPhase 3B.2 Baseの双方で同じintegration wait timeout。Node音声試験は合格
- 通常path：237,334 byte／SHA-256 `a114aca62e07f03c9d67e7ada497b05f8007030a8b003f2171e4a8d82555ee5c`でBaseと一致
- Desktop／390×844のidle・pointer・wheel：絶対閾値と差分基準に合格
- 最終微修正desktop idleのBase比はfps -0.001%、p95差0.000ms、390×844 idleは差0.000%／0.000ms
- 閾値変更：なし
- Issue #2対象のlighting／shadow／transparent／depthWrite／D2c3変更：なし
- `PHYSICAL_IPHONE_MILD_WARMING_AFTER_15_MIN`：非ブロッキング観察事項。最終統合レビューでは15分連続確認を必須とする

## 人間確認

第4候補本体のPC／物理iPhone確認は合格済みである。次の最終微修正を確認するまで既定採用、Ready化、マージを行わない。

- 6時バーが小秒へ接触して見えず、他の通常バーと同寸法に見えること
- 外装OFFでも3針とりゅうずが残り、針運動、pull／push、巻上げ、時刻合わせ、秒停止、作動音、選択が維持されること
- 学習タブが補助文なしの「外装」だけで、PC／390×844／物理iPhoneで扱いやすいこと
- 文字板空白、index、分目盛、3針、小秒、open-heart、風防側面、opacity 16%内部部品を通常クリック／タップで区別できること
- split／explode／opacity 16%と外装OFF／ONを合成し、復元後の状態が自然であること
- 既存Issue #2へ分離した影範囲境界
- 100%→99%のtransparent不連続、55%→54%のdepthWrite不連続、透過時の暗部・深度順、PC／iPhone照明差はIssue #2のままであること
- Phase 3C.2の黒革ストラップ・尾錠意匠が未実装であること

表裏分離と断面クリップは削除せず、`UI_SIMPLIFICATION_REVIEW_AFTER_PHASE3C2_AND_ISSUE2`として、分解表示との重複、学習上の価値、詳細表示への移動、初期UIからの折りたたみ、廃止可否をPhase 3C.2とIssue #2完了後に人間判断する。
