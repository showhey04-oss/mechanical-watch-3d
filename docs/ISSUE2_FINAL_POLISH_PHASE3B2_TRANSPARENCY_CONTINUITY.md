# Issue #2 Final Polish Phase 3B.2 — Dual-Baseline Transparency Continuity

## 結論

Phase 3B.2は、Shadow-offとD2c3を独立した描画baselineとして、構造透過の`transparent`／`depthWrite`不連続をquery限定で監査した。正式状態は次とする。

`TRANSPARENCY_CONTINUITY_LIGHTWEIGHT_ROUTE_EXHAUSTED_OIT_DECISION_REQUIRED`

固定深度プロパティによる軽量3候補は、13段階のopacityでプロパティ切替0件を達成した。しかし、内部視認性または同一環境性能差分の必須ゲートを満たす候補はなく、技術finalistは0件である。Stage 2、PC人間比較、物理iPhone確認、既定採用は実施しない。OITは本工程へ実装せず、次工程へ進む前に対象範囲・性能予算・採用ゲートの明示判断を必要とする。

## 基準と隔離

- source main: `293626f13a50224924f8e3ac229a1fc4077ad7a7`
- source base: `4f9e3f14f66317c4ce363a3393639b15ca3b05f1`
- implementation commit: `da600b11552185129a9f3e16f2ab55002df8972a`
- branch: `feature/issue2-final-polish-phase3b2-transparency-continuity`
- APP_VERSION: `v3.15.0`
- capture: same-origin unsandboxed iframeによる実Three.js offscreen WebGL
- 共通完成外装query: `exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3`

Phase 3B.2は`rendering=issue2-phase3b1c-shadow-off|issue2-d2c3`かつ`continuity=...`の明示queryだけで有効となる。通常path、Phase 3C.1／3C.2／3C.3、Phase 3A、Phase 3B.1／3B.1b／3B.1cの既存pathへObject3D、Light、Material、DOMの追加を残さない。

## Stage 0: 現行不連続の診断

実ランタイムの構造透過対象は146 Mesh、150 Materialである。分類はplate 43、dial 16、bridge 43、exterior 35、unclassified 13、選択可能117 Mesh、表示中135 Meshだった。

現行方式は同じ13段階の往復系列で次を記録した。

- `transparent` property change: 286
- `depthWrite` property change: 300
- Material replacement: 0
- Material UUID change: 0

これは100%→99%の`transparent`切替と55%→54%の`depthWrite`切替を実ランタイムで再現した記録であり、数値を隠したり閾値を変更したりしていない。

## 候補

| 候補 | property方針 | 最終判断 | 主理由 |
|---|---|---|---|
| `issue2-current` | 現行切替 | `RETAINED_DIAGNOSTIC_ONLY` | 100/99・55/54のproperty不連続を保持 |
| `issue2-stable-depth-off` | 全対象を常時transparent、depthWrite OFF | `REJECTED_PERFORMANCE` | D2c3 wheel中央値でfps 18.61%悪化 |
| `issue2-stable-depth-base` | 全対象を常時transparent、基準depthWrite維持 | `REJECTED_INTERNAL_VISIBILITY` | 低opacityで前面構造が内部機構を遮蔽 |
| `issue2-group-stable-depth` | plate／dial／bridge／exteriorだけdepthWrite OFF | `REJECTED_PERFORMANCE` | D2c3 selected中央値でfps約10.1%・p95約33ms悪化 |

3候補は全opacityで`transparent`／`depthWrite`のproperty toggle 0、Material replacement 0、Material UUID change 0を確認した。`renderOrder`、`castShadow`、`receiveShadow`、`blending`、`visible`は変更していない。

## 隣接opacityの実画面連続性

Shadow-off／D2c3、Desktop 1280×720／Mobile 390×844で100／99／98、56／55／54／53／52を含む13段階を実WebGLで取得した。1/255量子化を許容する隣接差分ゲートでは候補3種が自動合格した。代表的な`group-stable-depth`の差分scoreは次のとおりで、上限2以下である。

| baseline | viewport | 100/99 | 55/54 |
|---|---:|---:|---:|
| Shadow-off | 1280×720 | 0.468296 | 0.582139 |
| Shadow-off | 390×844 | 0.191524 | 0.180578 |
| D2c3 | 1280×720 | 0.399700 | 0.658924 |
| D2c3 | 390×844 | 0.307831 | 0.502243 |

この画面差分合格だけでは候補採用とせず、内部視認、選択、回帰、性能を別ゲートとして評価した。

## 内部視認・選択・深度順

- `stable-depth-base`はopacity 16%のdial mechanism／movement backで構造面が内部部品を遮蔽するため不合格。
- `stable-depth-off`と`group-stable-depth`は低opacityの内部視認を保持した。
- `group-stable-depth`ではopacity 54%／16%とも`設定車2`の選択、HUD／学習同期、空白クリック解除を確認した。
- 3D回転は実pointer操作の120フレームを保存し、split／explode／restoreの実画面GIFも保存した。

## 性能

差分基準は平均fps悪化5%以内、p95悪化2ms以内、reversal 0、stop-then-jump 0、wheel monotonic、transform invariantであり、製品の絶対閾値を変更しない。

- Shadow-offの`stable-depth-off`／`group-stable-depth`は測定シナリオで差分合格。
- D2c3の`stable-depth-off`はwheel 3反復中央値でcurrent 59.690 fps、候補48.582 fpsとなり18.609%悪化した。
- D2c3の`group-stable-depth`はopacity 54%で差分合格したが、selected 3反復中央値でcurrent 16.149 fps／p95 100.6ms、候補14.522 fps／p95 133.6msとなり、fps約10.1%・p95約33ms悪化した。
- 候補固有の停止・跳躍・逆転・transform変更は検出していない。

必須性能ゲートに失敗した時点でearly-stopを適用し、失格候補の不要な全直積再計測は行っていない。

## 回帰とprotected path

- Shadow-off Desktop: current／groupとも85/86、共通A.5前後明度差のみ
- Shadow-off Mobile: current／groupとも87/88、共通A.5前後明度差のみ
- D2c3 Desktop: current／groupとも81/86、共通A.5 3件＋A.6 2件
- D2c3 Mobile: current／groupとも83/88、同一共通5件
- candidate-specific browser failure: 0
- UI: 22/22
- HUD: 57/57
- trusted audio: 23/23、必須buffer 6/6、最終OFF
- A.7: 9/9
- 位置1／位置2禁止干渉: 0/0
- console error／warning: 0/0
- protected path: 42/42 byte-identical

既知baseline未達を候補固有回帰へ誤分類せず、試験閾値は変更していない。

## ステージ判断

Stage 1は13 opacity、normal／selected／split／explode／exterior OFF、両viewportを含む縮約行列で完了した。候補ごとの早期棄却理由が確定したため、全4 themeを含むStage 2直積は実施しない。

技術finalist 0件のため、PC人間比較候補と物理iPhone確認URLは作成しない。Shadow-offとD2c3は既存の未採用比較baselineとして保持し、D2c3は`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`のままとする。

## 次判断

固定depthWriteによる軽量方式は完了とする。次に進める場合は、OITの方式、対象Material、描画pass数、モバイル性能予算、選択・影・split／explodeとの契約、fallback、比較行列を先に承認する。承認なしにweighted blended OIT、depth peeling、透明専用renderer、Material置換へ進まない。

Issue #2はOpen、PR #5はOpen／Draft、D2c3は未採用、APP_VERSIONはv3.15.0を維持する。Ready化、マージ、既定採用は行わない。
