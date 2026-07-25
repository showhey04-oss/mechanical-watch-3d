# Phase 3B.1 E-BALANCEDコア外装候補 証跡

## 由来

- sourceBaseCommit：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- sourceImplementationCommit：`fc5cc0220004dbcfbff14d4bbca4165e797665ea`
- sourceCaptureCommit：`fc5cc0220004dbcfbff14d4bbca4165e797665ea`
- sourceBranch：`feature/final-exterior-balanced-phase3b1`
- APP_VERSION：v3.15.0
- captureMode：same-origin unsandboxed iframe harness + actual in-app Browser Three.js WebGLRenderTarget PNG
- candidate：E-BALANCED / `IMPLEMENTATION_CANDIDATE_NOT_DEFAULT`

画像は`tests/final-exterior-phase3b1-harness.html`から同一origin・sandboxなしのiframeへ実アプリを読み込み、実際のThree.js WebGL表示をPNGとして取得した。最終A/Bは承認Head a3cd646と実装コミットfc5cc022をともに1280×720／390×844のライブ画面、同一時刻・テーマ・camera presetで取得し、UIを含む同じフレーミング方式へ統一した。固定main／通常pathのpixel-exact確認は同じWebGLRenderTarget方式を使用する。

## 画像

| ファイル | 内容 | 寸法 |
|---|---|---:|
| `desktop-front.png` | desktop正面、位置1、透過100% | 1280×720 |
| `desktop-back.png` | desktopムーブメント裏面 | 1280×720 |
| `desktop-side.png` | desktop側面 | 1280×720 |
| `mobile-390-front.png` | mobile正面 | 390×844 |
| `mobile-390-side.png` | mobile側面 | 390×844 |
| `desktop-oblique-front.png` | desktop正面斜視 | 1280×720 |
| `crown-position-1.png` | りゅうず位置1の未注記実画面 | 1280×720 |
| `crown-position-2.png` | りゅうず位置2の未注記実画面 | 1280×720 |
| `crown-position-1-close-up.png` | 位置1の実画面crop close-up | 1280×720 |
| `crown-position-2-close-up.png` | 位置2の実画面crop close-up | 1280×720 |
| `opacity-100-front.png` | 構造透過100% | 1280×720 |
| `opacity-50-front.png` | 構造透過50% | 1280×720 |
| `opacity-16-front.png` | 構造透過16% | 1280×720 |
| `case-body-selection.png` | ケース胴選択・HUD | 1280×720 |
| `opacity-16-internal-selection.png` | 透過16%越し設定車2選択 | 1280×720 |
| `main-baseline-front.png` | 固定main正面 | 1280×720 |
| `main-baseline-side.png` | 固定main側面 | 1280×720 |
| `before-profile-desktop-side.png` | 旧一定半径ケース胴の固定Head実画面 | 1280×720 |
| `before-profile-desktop-oblique-front.png` | 旧一定半径ケース胴の正面斜視 | 1280×720 |
| `live-second-desktop-front.png` | 第2候補の同一フレーミング正面実画面 | 1280×720 |
| `live-second-desktop-oblique-front.png` | 第2候補の同一フレーミング斜め正面実画面 | 1280×720 |
| `live-second-desktop-side.png` | 第2候補の同一フレーミング側面実画面 | 1280×720 |
| `live-second-desktop-back.png` | 第2候補の同一フレーミング裏面実画面 | 1280×720 |
| `live-third-desktop-front.png` / `live-third-desktop-oblique-front.png` | 第3候補の正面／斜め正面実画面 | 1280×720 |
| `live-third-desktop-side.png` / `live-third-desktop-back.png` | 第3候補の側面／裏面実画面 | 1280×720 |
| `live-third-mobile-390-front.png` / `live-third-mobile-390-side.png` | 第3候補の390×844実画面 | 390×844 |
| `live-fourth-desktop-front.png` / `live-fourth-desktop-oblique-front.png` | 第4候補の正面／斜め正面実画面 | 1280×720 |
| `live-fourth-desktop-side.png` / `live-fourth-desktop-back.png` | 第4候補の側面／裏面実画面 | 1280×720 |
| `live-fourth-mobile-390-front.png` / `live-fourth-mobile-390-side.png` | 第4候補の390×844実画面 | 390×844 |
| `live-fourth-opacity-50.png` / `live-fourth-mobile-390-opacity-50.png` | 第4候補のdesktop／mobile透過50%実画面 | 1280×720 / 390×844 |
| `live-final-desktop-front.png` / `live-final-desktop-oblique-front.png` | 最終候補の正面／斜め正面実画面 | 1280×720 |
| `live-final-desktop-side.png` / `live-final-desktop-back.png` | 最終候補の側面／裏面実画面 | 1280×720 |
| `live-final-mobile-390-front.png` / `live-final-mobile-390-side.png` | 最終候補の390×844実画面 | 390×844 |
| `live-final-desktop-opacity-50.png` / `live-final-mobile-390-opacity-50.png` | 最終候補のdesktop／mobile透過50%実画面 | 1280×720 / 390×844 |
| `baseline-vs-balanced-front.png` | 固定mainと候補の正面A/B | 2560×772 |
| `baseline-vs-balanced-side.png` | 固定mainと候補の側面A/B | 2560×772 |
| `case-body-profile-before-after-side.png` | 旧外形／新外形の側面A/B | 2560×772 |
| `case-body-profile-before-after-oblique-front.png` | 旧外形／新外形の正面斜視A/B | 2560×772 |
| `case-body-wireframe-relief.png` | 実側面へ局所逃げ範囲を重ねた診断図 | 1280×720 |
| `crown-minimum-gap-annotated.png` | 実側面へ最小gap位置・XYZを注記 | 1280×720 |
| `case-minimum-wall-annotated.png` | 実側面へ最小壁厚位置・XYZを注記 | 1280×720 |
| `second-candidate-before-after-front.png` | Head 43c8165と第2候補の正面A/B | 2560×772 |
| `second-candidate-before-after-oblique-front.png` | Head 43c8165と第2候補の斜め正面A/B | 2560×772 |
| `second-candidate-before-after-side.png` | Head 43c8165と第2候補の側面A/B | 2560×772 |
| `second-candidate-before-after-back.png` | Head 43c8165と第2候補の裏面A/B | 2560×772 |
| `third-candidate-before-after-front.png` | Head 24ee892と第3候補の正面A/B | 2560×772 |
| `third-candidate-before-after-oblique-front.png` | Head 24ee892と第3候補の斜め正面A/B | 2560×772 |
| `third-candidate-before-after-side.png` | Head 24ee892と第3候補の側面A/B | 2560×772 |
| `third-candidate-before-after-back.png` | Head 24ee892と第3候補の裏面A/B | 2560×772 |
| `third-candidate-bezel-taper-comparison.png` | 第2／第3候補ベゼル断面 | 1280×720 |
| `third-candidate-caseback-taper-comparison.png` | 第2／第3候補裏蓋断面 | 1280×720 |
| `third-candidate-case-profile-comparison.png` | 第2／第3候補ケース胴プロファイル | 1280×720 |
| `third-opacity-50.png` | 第3候補の透過50%実画面 | 1280×720 |
| `third-crown-position1.png` / `third-crown-position2.png` | 第3候補のりゅうず位置1／2 | 1280×720 |
| `fourth-candidate-before-after-front.png` / `fourth-candidate-before-after-oblique-front.png` | 第3／第4候補の正面／斜め正面A/B | 2560×772 |
| `fourth-candidate-before-after-side.png` / `fourth-candidate-before-after-back.png` | 第3／第4候補の側面／裏面A/B | 2560×772 |
| `fourth-candidate-bezel-section.png` | ベゼル全面テーパー断面 | 1280×720 |
| `fourth-candidate-caseback-section.png` | 裏蓋リング全面テーパー断面 | 1280×720 |
| `fourth-candidate-bezel-profile.png` / `fourth-candidate-caseback-profile.png` | 実測Y―半径プロファイル | 1280×720 |
| `fourth-candidate-flat-taper-annotation.png` | 保持座・主テーパー・外周閉合の色分け注記 | 1280×720 |
| `fourth-opacity-50.png` | 第4候補の透過50%注記実画面 | 1280×720 |
| `final-candidate-before-after-front.png` / `final-candidate-before-after-oblique-front.png` | 第4／最終候補の正面／斜め正面A/B | 2560×772 |
| `final-candidate-before-after-side.png` / `final-candidate-before-after-back.png` | 第4／最終候補の側面／裏面A/B | 2560×772 |
| `final-candidate-case-profile-comparison.png` | 最大径帯と前後テーパー長の比較 | 1280×720 |
| `final-candidate-visible-height-annotation.png` | 実側面へ見付け高さ・同一総厚を注記 | 1280×720 |
| `final-candidate-bezel-section.png` / `final-candidate-caseback-section.png` | 全面テーパー維持確認 | 1280×720 |
| `final-opacity-50.png` | 最終候補の透過50%注記実画面 | 1280×720 |
| `final-candidate-mobile-390-front.png` / `final-candidate-mobile-390-side.png` | 第4／最終候補のmobile A/B | 780×896 |
| `bezel-section-29.0-vs-29.8.png` | 旧29.000開口と新29.800テーパーベゼル断面 | 1280×720 |
| `total-thickness-9.845-vs-8.695.png` | 旧／新外装総厚と前後突出の比較 | 1280×720 |
| `movement-holder-before-after.png` | 保持リングなし／あり比較 | 2560×772 |
| `opacity-100.png` / `opacity-50.png` / `opacity-16.png` | 第2候補の透過率固定比較 | 1280×720 |

desktop／mobile、位置1／位置2、透過、選択、修正前固定Headの各raw画像は実ランタイムキャプチャである。close-up注記、比較ボード、局所逃げ・gap・壁厚図は実WebGL PNGを背景として測定値を重ねた診断画像である。ベゼル断面と総厚比較だけは設定値から生成した独立模式図で、本番Sceneへ診断Geometryは追加していない。

## reports

- `approved-config.json`：Phase 3A承認値とPhase 3B.1仮定
- `runtime-dimensions.json`：desktop／mobileの実測Box3とconfig差
- `exterior-proportions.json`：旧9.845／29.000と新8.695／29.800の外装比率比較
- `exterior-interference.json`：意図接触、禁止干渉14組、位置1／位置2、保持リング、環状部品interface
- `annular-taper-report.json`：ベゼル／裏蓋リング断面、被覆率、単調勾配、水平区間、閉合性
- `case-body-relief-report.json`：実りゅうず包絡、必要／採用逃げ量、gap、壁厚、閉合性
- `crown-tube-report.json`：中空チューブ、巻真クリアランス、局所シート候補
- `movement-holder-report.json`：保持リング寸法、クリアランス、閉合性、pick priority
- `selection-report.json`：外装pointer選択、解除、透過越し内部選択
- `material-report.json`：外装専用材、構造透過、既存描画設定の保護
- `normal-path-diff.json`：queryなし追加0と固定main pixel exact
- `fourth-candidate-capture-metadata.json`：第4候補の履歴capture metadata
- `final-visual-thinness-capture-metadata.json`：最終候補8画像のviewport、byte、browser SHA、state invariant
- `performance-results.json`：通常path／候補の10秒実測
- `regression-results.json`：Node、desktop、mobile、UI、HUD、音声、S86、A.7
- `decision-summary.json`：採用状態、未確認事項、次工程
- `evidence-manifest.json`：manifest自身を除くclosed-world SHA-256一覧

## 判定

- runtime実装：`FUNCTIONAL_PASS_WITH_BROWSER_ENVIRONMENT_LIMITATIONS`
- 通常path差分：0
- forbidden interference：位置1 0／位置2 0
- 外装総厚：第2候補から8.695を維持
- ベゼル：保持座0.400、主テーパー3.200、閉合0.900、被覆率0.888889、意図しない水平区間0
- 裏蓋リング：保持座0.200、主テーパー4.426、閉合0.600、被覆率0.956766、意図しない水平区間0
- 環状Mesh：両方とも閉合、退化三角形0、非多様体edge 0、関連禁止干渉0
- 保持リング：外径37.650、内径36.750、Y=4.035～4.485、禁止干渉0
- ケース胴最大径帯：3.450から1.950へ1.500短縮
- 前側／後側テーパー：1.510→2.160、2.535→3.385
- ケース胴局所逃げ：必要0.249174、採用0.304118、上限差0.025882
- 実Geometry：位置1gap 0.030063、位置2gap 1.380063、最小壁厚0.550000
- 旧0.150：物理食い込み0.070748、目標gap込み不足0.100748
- ケース胴：単一閉合Mesh、CSGなし、内周半径18.900不変
- 既定採用：`NOT_APPROVED_FOR_DEFAULT_ADOPTION`
- 指掛かり／pull・push操作性：第1候補の物理iPhone人間確認で合格
- 透過50%：`HUMAN_REVIEW_PENDING`
- in-app Browser単独タブ10秒idle：通常59.909fps／候補59.910fps、候補差分fps +0.002%、p95 +0.400msで絶対／差分基準内、閾値変更なし
- 動画：実行環境にリポジトリ保存可能なWebM経路がなく未取得。A.6診断、位置サイクル診断、PNGを代替証跡とする

次はPCと物理iPhoneで最終候補の視覚的薄型化、維持したベゼル／裏蓋リング全面テーパー、透過50%を人間確認する。合格前にPhase 3B.2または既定採用へ進めない。
