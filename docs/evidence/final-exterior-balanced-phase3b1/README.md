# Phase 3B.1 E-BALANCEDコア外装候補 証跡

## 由来

- sourceBaseCommit：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- sourceImplementationCommit：`4368f2e5d283e3030dc5597a5caf58b7d3d6802d`
- sourceCaptureCommit：`b4b05b364188574cb3caa2540f021f84cbb4516c`
- sourceBranch：`feature/final-exterior-balanced-phase3b1`
- APP_VERSION：v3.15.0
- captureMode：same-origin unsandboxed iframe harness + actual in-app Browser Three.js WebGLRenderTarget PNG
- candidate：E-BALANCED / `IMPLEMENTATION_CANDIDATE_NOT_DEFAULT`

画像は`tests/final-exterior-phase3b1-harness.html`から同一origin・sandboxなしのiframeへ実アプリを読み込み、実際のThree.js WebGL表示をPNGとして取得した。比較ボード左側の固定mainは開始SHAを同じ`127.0.0.1:8000`ルートから別実行し、既存dimension harnessの1280×720 iframe領域を無加工で切り出した。右側は同一条件のE-BALANCED query候補である。

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
| `bezel-section-29.0-vs-29.8.png` | 旧29.000開口と新29.800テーパーベゼル断面 | 1280×720 |
| `total-thickness-9.845-vs-8.695.png` | 旧／新外装総厚と前後突出の比較 | 1280×720 |
| `movement-holder-before-after.png` | 保持リングなし／あり比較 | 2560×772 |
| `opacity-100.png` / `opacity-50.png` / `opacity-16.png` | 第2候補の透過率固定比較 | 1280×720 |

desktop／mobile、位置1／位置2、透過、選択、修正前固定Headの各raw画像は実ランタイムキャプチャである。close-up注記、比較ボード、局所逃げ・gap・壁厚図は実WebGL PNGを背景として測定値を重ねた診断画像である。ベゼル断面と総厚比較だけは設定値から生成した独立模式図で、本番Sceneへ診断Geometryは追加していない。

## reports

- `approved-config.json`：Phase 3A承認値とPhase 3B.1仮定
- `runtime-dimensions.json`：desktop／mobileの実測Box3とconfig差
- `exterior-proportions.json`：旧9.845／29.000と新8.695／29.800の外装比率比較
- `exterior-interference.json`：意図接触、禁止干渉14組、位置1／位置2、保持リング
- `case-body-relief-report.json`：実りゅうず包絡、必要／採用逃げ量、gap、壁厚、閉合性
- `crown-tube-report.json`：中空チューブ、巻真クリアランス、局所シート候補
- `movement-holder-report.json`：保持リング寸法、クリアランス、閉合性、pick priority
- `selection-report.json`：外装pointer選択、解除、透過越し内部選択
- `material-report.json`：外装専用材、構造透過、既存描画設定の保護
- `normal-path-diff.json`：queryなし追加0と固定main pixel exact
- `performance-results.json`：通常path／候補の10秒実測
- `regression-results.json`：Node、desktop、mobile、UI、HUD、音声、S86、A.7
- `decision-summary.json`：採用状態、未確認事項、次工程
- `evidence-manifest.json`：manifest自身を除くclosed-world SHA-256一覧

## 判定

- runtime実装：`FUNCTIONAL_PASS_WITH_BROWSER_ENVIRONMENT_LIMITATIONS`
- 通常path差分：0
- forbidden interference：位置1 0／位置2 0
- 外装総厚：旧9.845／第2候補8.695
- ベゼル表示開口：旧29.000／第2候補29.800
- 保持リング：外径37.650、内径36.750、Y=4.035～4.485、禁止干渉0
- ケース胴局所逃げ：必要0.298836、採用0.310872、上限差0.019128
- 実Geometry：位置1gap 0.030088、位置2gap 1.380088、最小壁厚0.589128
- 旧0.150：物理食い込み0.121192、目標gap込み不足0.151192
- ケース胴：単一閉合Mesh、CSGなし、内周半径18.900不変
- 既定採用：`NOT_APPROVED_FOR_DEFAULT_ADOPTION`
- 指掛かり／pull・push操作性：第1候補の物理iPhone人間確認で合格
- 透過50%：`HUMAN_REVIEW_PENDING`
- in-app Browser絶対性能：通常path／候補とも未達。候補差分はfps -2.81%、p95 -0.30msで差分基準内、閾値変更なし
- 動画：実行環境にリポジトリ保存可能なWebM経路がなく未取得。A.6診断、位置サイクル診断、PNGを代替証跡とする

次はPCと物理iPhoneで第2候補のケース胴シルエット、前後比率、ベゼル、保持リング、透過50%を人間確認する。合格前にPhase 3B.2または既定採用へ進めない。
