# Phase 3B.1 E-BALANCEDコア外装候補 証跡

## 由来

- sourceBaseCommit：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- sourceImplementationCommit：`5e3081447c23fd94d3ed6c6bc91a7ca4cdc98995`
- sourceBranch：`feature/final-exterior-balanced-phase3b1`
- APP_VERSION：v3.15.0
- captureMode：same-origin unsandboxed iframe harness
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
| `crown-position-1.png` | りゅうず位置1 | 1280×720 |
| `crown-position-2.png` | りゅうず位置2 | 1280×720 |
| `opacity-100-front.png` | 構造透過100% | 1280×720 |
| `opacity-50-front.png` | 構造透過50% | 1280×720 |
| `opacity-16-front.png` | 構造透過16% | 1280×720 |
| `baseline-vs-balanced-front.png` | 固定mainと候補の正面A/B | 2560×772 |
| `baseline-vs-balanced-side.png` | 固定mainと候補の側面A/B | 2560×772 |

比較ボード以外の10画像は注記や後処理を加えていない実ランタイム画像である。比較ボードは実画像を左右へ配置し、上部ラベルと中央境界だけを追加した。

## reports

- `approved-config.json`：Phase 3A承認値とPhase 3B.1仮定
- `runtime-dimensions.json`：desktop／mobileの実測Box3とconfig差
- `exterior-interference.json`：意図接触、指定10組の禁止干渉、位置1／位置2
- `crown-tube-report.json`：中空チューブ、巻真クリアランス、局所シート候補
- `selection-report.json`：外装pointer選択、解除、透過越し内部選択
- `material-report.json`：外装専用材、構造透過、既存描画設定の保護
- `normal-path-diff.json`：queryなし追加0と固定main pixel exact
- `performance-results.json`：通常path／候補の10秒実測
- `regression-results.json`：Node、desktop、mobile、UI、HUD、音声、S86、A.7
- `decision-summary.json`：採用状態、未確認事項、次工程
- `evidence-manifest.json`：manifest自身を除くclosed-world SHA-256一覧

## 判定

- runtime実装：`PASSED`
- 通常path差分：0
- forbidden interference：位置1 0／位置2 0
- 既定採用：`NOT_APPROVED_FOR_DEFAULT_ADOPTION`
- 指掛かり／pull・push操作性：`UNVERIFIED`
- 動画：実行環境にリポジトリ保存可能なWebM経路がなく未取得。A.6診断、位置サイクル診断、PNGを代替証跡とする

次はPCと物理iPhoneによる人間確認であり、合格前にPhase 3B.2または既定採用へ進めない。
