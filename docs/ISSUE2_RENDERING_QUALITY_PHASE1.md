# Issue #2 レンダリング品質改善 Phase 1

> 追補（Phase 2A）：Candidate Cは物理iPhoneで明るさは概ね問題なかったが、光源色差と硬い・局所的な見え方が受入不可のため不採用となった。本資料の「有望／未確認」はPhase 1時点の履歴であり、最新判定とD1/D2/D3比較は[Phase 2A](ISSUE2_RENDERING_QUALITY_PHASE2A.md)を参照する。

## 位置づけ

この資料は、v3.13.0（基準コミット`b7496af8e9d4a5cf8f462f64700a38661e44c59a`）を基準に、Issue #2の次の3課題を分離して診断・比較した結果を記録する。

1. 構造透過時に見える中央の四角いシャドウ境界
2. 透過率100%→99%および55%→54%の描画不連続
3. 物理スマートフォンで報告された通常表示100%の黒潰れ、強いハイライト、視点・端末間の差

Phase 1は最終方式を決定する段階ではない。Candidate A/B/Cは比較用クエリで個別に有効化し、既定表示へ統合していない。Issue #2はOpenのまま維持し、Draft Pull Requestの比較証跡をユーザーが確認するまでReady化・マージ・Issue closeを行わない。

## 基準固定と診断条件

透過比較は中央境界が最も判別しやすかった`navy`を固定し、時刻10:10:30、停止状態、同一カメラ、同一DPR条件で取得した。

- 透過率：100、99、75、56、55、54、53、50、25、16、8%
- 視点：文字板正面、ムーブメント裏面、斜め側面
- Viewport：1280×720、390×844

通常表示100%の照明比較は4テーマ、5視点、4 viewportを固定条件で取得した。

- テーマ：navy、obsidian、walnut、gallery
- 視点：文字板正面、ムーブメント裏面、斜め側面、巻上げ拡大、日の裏輪列拡大
- Viewport：1280×720、1440×900、390×844、393×852

画像、撮影manifest、材質遷移、シャドウ範囲、画像差分、照明・フレームバッファ、性能の機械可読レポートは`docs/evidence/issue2-rendering-quality-phase1/`へ保存した。

## 原因診断

### 中央の四角いシャドウ境界

基準の`frontKey`は`PCFShadowMap`、512×512で、OrthographicCamera範囲がleft/right/top/bottom ±5に固定されていた。実モデルのworld boundsは約39.30×7.04×37.47で、ライト空間へ変換した外接8頂点は全点が既定frustum外だった。したがって中央の四角形は、モデル形状ではなくshadow coverageの端が透過面上へ投影されたものと判断した。

### 100%→99%と55%→54%の不連続

基準では110個の構造材質を確認した。100%→99%で105材質の`transparent`が切り替わり、110材質のprogram versionが更新された。55%→54%では110材質の`depthWrite`が切り替わり、同じく110材質のprogram versionが更新された。

1280×720の斜め側面では、55%→54%の局所平均画像差が約0.00355で、56%→55%の約0.00020、54%→53%の約0.00024に対して不連続に大きい。これは透過率そのものではなく、材質状態の二値切替がポッピングの主因であることを示す。

### モバイルの暗部

既定リグでは距離減衰するカメラ追従PointLightと固定キーライトの組合せが、画面サイズと視点によって代表部の明るさへ異なる影響を与える。Chromium 390×844で数値化できる差は確認したが、報告対象である物理iPhoneのSafari、OLED/P3表示はこのPhase 1では未確認である。したがって、エミュレートviewportだけを根拠に解消とは判断しない。

## Candidate比較

| Candidate | 比較内容 | 確認できた効果 | 副作用・判定 |
| --- | --- | --- | --- |
| A：shadow coverage | モデルboundsをライト空間でtight fitし、4% margin、texel snapping、`PCFSoftShadowMap`、desktop 2048／mobile 1024を使用 | モデル外接8頂点がfrustum内となり、固定±5に由来する中央境界を除去 | 透過した大面積構造Meshが全面を不透明な影として覆い、16%表示を大きく暗化する。幾何学的な範囲修正は正しいが、現方式は画質受入不可のため不採用 |
| B：transparency continuity | 構造材質を初期化時から`transparent=true`、`depthWrite=false`へ固定し、スライダー中はopacityだけを変更 | 100→99、56→55、55→54、54→53の材質状態変更とprogram version増分が0になり、閾値ポッピングを除去 | 100%表示でも深度書込みがなく、構造面の前後関係が破綻する。単一passの現方式は不採用 |
| C：distance-invariant fill | カメラ追従・影なしのDirectionalLightを強度0.02で追加。主キー比約1.02% | Chromiumでは黒潰れを抑え、navyの表裏差を1280×720で約15.6%、390×844で約4.0%に収め、広範なクリップを発生させなかった | 候補として有望。ただし物理iPhone未確認のため未採用。端末実画面で金属階調、接触感、白飛びを確認してから判断する |

Candidate A/B/Cは相互に独立しており、複合した「最終案」は存在しない。Aのfrustum計算をそのまま採用する、Bの単一pass固定状態を採用する、Cのfillを既定リグへ追加する、のいずれもこのPhase 1では行わない。

## 10秒実入力性能

基準と3候補について、1280×720／390×844でpointer回転、wheelズーム、透過16%アイドルを各10秒計測した。全24ケースの最小平均fpsは59.84、最大p50は16.70ms、最大p95は18.60ms、最大p99は18.70msだった。33.3ms超は基準で1フレーム、各Candidateでは0、50ms超とlong taskは全ケース0だった。

| 対象 | 最小平均fps | 最大p50 | 最大p95 | 最大p99 | 33.3ms超 | 50ms超 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| v3.13.0基準 | 59.84 | 16.70ms | 18.60ms | 18.70ms | 1 | 0 |
| Candidate A | 59.90 | 16.70ms | 18.00ms | 18.40ms | 0 | 0 |
| Candidate B | 59.90 | 16.70ms | 17.60ms | 18.40ms | 0 | 0 |
| Candidate C | 59.90 | 16.70ms | 17.10ms | 18.50ms | 0 | 0 |

A.6のデスクトップ平均55fps、p50 18ms、p95 25ms、p99 40ms、およびモバイル平均45fps、p95 33.3ms、50ms超2%未満の基準を緩和せず維持した。詳細は[performance/summary.json](evidence/issue2-rendering-quality-phase1/performance/summary.json)を正とする。

## 採用していない方式

- 大面積の文字板・地板へ粒状ノイズを生む`alphaHash`は使用していない
- 透過率の閾値で`castShadow`／`receiveShadow`をON/OFFしていない
- モバイルだけのCSS filter、brightness、User-Agent別露出補正を使用していない
- 影の全廃、既定露出・tone mapping・材質の変更を行っていない
- A.7の機構、カメラ／ArcballControls、選択仕様、PR #4のHUD・時刻入力を変更していない

## 現時点の推奨

1. Candidate Aのライト空間bounds計算とtexel snappingは、shadow coverage修正の幾何学的な土台として保持する。ただし透過構造の影表現を分離できる方式と組み合わせるまで既定化しない。
2. Candidate Bの「スライダー中に材質状態を切り替えない」という要件は維持し、100%の深度を壊さない限定depth pre-pass／color passなどを別候補として検討する。
3. Candidate Cは3候補のうち次の実機比較へ進める価値がある。物理iPhoneで4テーマ、表／裏／側面、代表材質、選択ハイライトを同一条件比較し、ユーザー確認後に採否を決める。

## ユーザー確認ゲート

現段階の判定は次のとおり。

- Candidate A：現方式は不採用
- Candidate B：現方式は不採用
- Candidate C：有望だが未採用
- 最終統合：なし
- Issue #2：Openを維持

次の作業へ進むには、比較画像・GIF、性能レポートと物理iPhoneでのCandidate C確認についてユーザー判断が必要である。ユーザー確認前に「完成」「合格」とは扱わない。

## 物理iPhoneで残る確認

- Safariの実画面で通常表示100%を4テーマ比較する
- 文字板正面、ムーブメント裏面、斜め側面、巻上げ、日の裏輪列の暗部とハイライトを確認する
- 黄銅、鋼、ルビー、文字板、針の材質差と接触影を確認する
- Candidate Cの0.02 fillで黒潰れが減り、白飛び・平板化・色転びが増えないことを確認する
- 部品選択と選択ハイライトが暗部・明部の双方で判別できることを確認する

証跡の索引と条件は`docs/evidence/issue2-rendering-quality-phase1/README.md`を参照する。

主なユーザー確認用ファイルは次のとおり。

- Candidate A：[16% desktop Before／After](evidence/issue2-rendering-quality-phase1/comparisons/shadow-candidate-a-before-after-1280x720.png)／[mobile](evidence/issue2-rendering-quality-phase1/comparisons/shadow-candidate-a-before-after-390x844.png)
- Candidate B：[100/99・55/54 desktop比較](evidence/issue2-rendering-quality-phase1/comparisons/transparency-candidate-b-boundaries-1280x720.png)／[全透過率GIF](evidence/issue2-rendering-quality-phase1/comparisons/transparency-candidate-b-transparency-front-1280x720.gif)
- Candidate C：[desktop Before／After](evidence/issue2-rendering-quality-phase1/comparisons/lighting-candidate-c-before-after-1280x720.png)／[mobile](evidence/issue2-rendering-quality-phase1/comparisons/lighting-candidate-c-before-after-390x844.png)
- 数値：[画像比較JSON](evidence/issue2-rendering-quality-phase1/comparisons/comparison-report.json)／[10秒性能JSON](evidence/issue2-rendering-quality-phase1/performance/summary.json)／[ブラウザ回帰JSON](evidence/issue2-rendering-quality-phase1/browser-report.json)
