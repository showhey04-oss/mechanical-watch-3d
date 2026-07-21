# Issue #2 レンダリング品質 Phase 1 証跡

## 判定

このフォルダはv3.13.0基準とCandidate A/B/Cを同一条件で比較するための証跡である。候補は`issue2Candidate`クエリでのみ有効になり、既定描画へ統合されていない。

- Candidate A：shadow frustumは実モデルboundsを包含するが、透過面の全面暗化により現方式を不採用
- Candidate B：材質状態は全評価点で連続するが、100%表示の深度順破綻により現方式を不採用
- Candidate C：強度0.02のdistance-invariant fillは有望だが、物理iPhone未確認のため未採用
- 最終統合：なし
- `alphaHash`：不使用
- Issue #2：Open、ユーザー確認待ち

## ディレクトリ

| パス | 内容 |
| --- | --- |
| `baseline/` | v3.13.0既定描画の透過、照明、診断、性能、撮影manifest |
| `candidate-a-shadow/` | tight-fit shadow coverage候補の透過マトリクス、frustum診断、性能 |
| `candidate-b-transparency/` | 単一材質状態候補の透過マトリクス、状態遷移・画像差分、比較用画像 |
| `candidate-c-lighting/` | 強度0.02 fill候補の4テーマ・5視点・4 viewport照明マトリクス、診断、性能 |
| `comparisons/` | 同条件Before／Candidate比較、スライダー／視点GIF、画像差JSON |
| `performance/summary.json` | 基準と3候補、2 viewport、3実入力シナリオの10秒性能集約 |
| `browser-report.json` | 専用検証、既存回帰、UI／HUD、A.7結果と性能レポート参照の機械可読集約 |
| `evidence-manifest.json` | 証跡全ファイルの相対パス、byte数、SHA-256 |

最終生成時に存在するファイルを正とし、診断途中のscoutは`scout/`または`theme-scout/`へ分離する。

## 固定条件

- 基準コミット：`b7496af8e9d4a5cf8f462f64700a38661e44c59a`
- 時刻：10:10:30
- 状態：停止、非分解、表裏分離なし
- 透過テーマ：navy
- 透過率：100、99、75、56、55、54、53、50、25、16、8%
- 透過視点：front、back、oblique
- 透過viewport：1280×720、390×844
- 照明テーマ：navy、obsidian、walnut、gallery
- 照明視点：front、back、side、winding、motion-works
- 照明viewport：1280×720、1440×900、390×844、393×852

navyは16%透過時に固定±5のshadow coverage境界が他テーマより判別しやすく、形状の暗部とも区別しやすかったため透過比較へ採用した。

## 候補の有効化

開発用比較は次のURLパラメータを使う。通常アクセスでは`baseline`となり、v3.13.0の描画状態を維持する。

```text
?issue2Candidate=shadow
?issue2Candidate=transparency
?issue2Candidate=lighting
```

Candidate Aのfrustum可視化は開発用の`issue2ShadowHelper=1`でのみ追加され、通常UIには表示しない。

## 機械可読レポート

`diagnostics/`のJSONには次を含む。

- shadow：map type／size、bias、normalBias、radius、camera範囲、world bounds、ライト空間8頂点の内外、world units per texel
- materials：opacity、transparent、depthWrite／depthTest、side、blending、alphaTest、premultipliedAlpha、cast／receiveShadow、renderOrder、visible、material UUID／version
- opacity diff：100→99、56→55、55→54、54→53の全体・局所・中央境界帯の画像差と材質状態差
- lighting：color space、tone mapping／exposure、ライト構成、viewport／DPR／drawing buffer、平均輝度、暗部率、クリップ率、代表材質サンプル
- performance：pointer回転、wheelズーム、透過アイドルのp50／p95／p99、33ms／50ms超過数

診断の主要結果は`docs/ISSUE2_RENDERING_QUALITY_PHASE1.md`に集約する。

## 主比較ファイル

- Candidate A desktop：[16% Before／After](comparisons/shadow-candidate-a-before-after-1280x720.png)
- Candidate A mobile：[16% Before／After](comparisons/shadow-candidate-a-before-after-390x844.png)
- Candidate A：[ライト空間frustum可視化](candidate-a-shadow/frustum/1280x720_side_opacity-16_shadow-frustum-helper.jpg)
- Candidate B desktop：[100/99・55/54境界比較](comparisons/transparency-candidate-b-boundaries-1280x720.png)
- Candidate B mobile：[100/99・55/54境界比較](comparisons/transparency-candidate-b-boundaries-390x844.png)
- Candidate B：[全11透過率desktop GIF](comparisons/transparency-candidate-b-transparency-front-1280x720.gif)／[mobile GIF](comparisons/transparency-candidate-b-transparency-front-390x844.gif)
- Candidate C desktop：[front/back/side Before／After](comparisons/lighting-candidate-c-before-after-1280x720.png)
- Candidate C mobile：[front/back/side Before／After](comparisons/lighting-candidate-c-before-after-390x844.png)
- 機械可読：[画像比較](comparisons/comparison-report.json)／[10秒性能](performance/summary.json)／[全ブラウザ回帰](browser-report.json)

比較画像・GIFとJSONは`scripts/generate_issue2_phase1_evidence.py`で、保存済みの固定条件JPEG／性能JSONから再生成できる。ブラウザ静止画は実体に合わせて`.jpg`とし、100↔99・55↔54等の微小差の定量判定はJPEGではなく`diagnostics/opacity-diff-*.json`のWebGL framebuffer生値を正とする。

## 比較時の注意

- Candidate Aは中央の四角い境界だけでなく、透過構造が落とす全面影の暗化も同時に確認する
- Candidate Bは55%／54%だけでなく、100%で構造面の前後関係を確認する
- Candidate CはChromiumの390×844／393×852だけで採用判断せず、物理iPhone Safariで確認する
- `scout/`内の試行画像は候補選定過程であり、最終マトリクスと区別する
- 既定描画、Candidate A/B/Cを同一ウィンドウで比較し、テーマ、時刻、視点、透過率を変更しない
