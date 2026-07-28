# Issue #2 Final Polish Phase 3B.1b

## 結論

Phase 3B.1bでは、完成時計の4離散状態ごとにfrontKeyのshadow cameraをタイトフィットするquery限定候補を比較した。Stage 1の768条件は完了したが、技術候補は0件である。512／1024はいずれも中央矩形影を除去した一方、透過面へ広い斜め縞が生じたため`REJECTED_SHADOW_RESOLUTION`とした。Stage 2、PC候補選択、物理iPhone確認は実施しない。通常表示への採用はない。

正式判定は`ISSUE2_PHASE3B1B_AUDIT_ACCEPTED_TIGHT_SHADOW_ROUTE_CLOSED`とする。比較監査と証跡は合格とする一方、tight 512／1024はともに不採用であり、shadow camera fit、margin、mapSize増加による追加探索を終了する。mapSize 2048、camera追従fit、per-frame／pointer／wheel連動fitは実施しない。

Phase 3B.1の人間評価は次を正式状態として引き継ぐ。

- baseline: `HUMAN_REJECTED_RENDERING_BASELINE`
- shadow-off: `HUMAN_DESIGN_HOLD_TECHNICALLY_NONFINAL`
- D2c3: `RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`
- mobile全長表示: `DEFERRED_MOBILE_FULL_LENGTH_FRAMING_AND_ZOOM_LIMIT`

Issue #2はOpen、PR #5はOpen／Draft、D2c3は未採用のまま維持する。

## 候補と適用条件

共通queryは`exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3`である。

| 候補 | rendering | map size | 変更 |
|---|---|---:|---|
| baseline | `issue2-phase3b1b-baseline` | 既定 | 比較基準、変更なし |
| shadow-off | `issue2-phase3b1b-shadow-off` | 既定 | frontKey `castShadow=false`だけ |
| state-tight-512 | `issue2-state-tight-512` | 512 | 離散状態別タイトフィット |
| state-tight-1024 | `issue2-state-tight-1024` | 1024 | 離散状態別タイトフィット |

すべてquery限定かつ既定OFFである。Geometry、Material、fog、透過、カメラ基盤、DPR、UI、音響、APP_VERSION、試験閾値は変更していない。

## タイトフィット方式

対象はvisibleかつfiniteで、`castShadow`または`receiveShadow`が有効な実Meshである。diagnostic、selection proxy、guide、helperは除外した。各Geometryのbounding-box cornerへ`matrixWorld`を適用し、その点をfrontKey light-viewへ直接変換してunionした。world-space AABBの8隅を再変換する近似は使用していない。

caster／receiverは別集計し、全状態で各553 Meshだった。XYのmarginは12 texelで、depth marginは実測depthから独立算出した。shadow cameraの適用とshadow refreshは初期化およびsplit／explodeの離散状態遷移だけで行い、idle、pointer、wheel、camera preset、回転、zoomでは更新しない。

### 1024候補のlight-space fit

| 状態 | left | right | bottom | top | near | far | fitted WUPT X/Y |
|---|---:|---:|---:|---:|---:|---:|---:|
| normal | -51.566692 | 59.366696 | -56.399841 | 85.152702 | 3.565693 | 148.210036 | 0.108333 / 0.138235 |
| split | -51.566692 | 59.366696 | -56.399841 | 85.152702 | 3.565693 | 148.210036 | 0.108333 / 0.138235 |
| explode | -61.002058 | 64.937675 | -57.378427 | 103.595571 | 4.028955 | 158.311251 | 0.122988 / 0.157201 |
| split＋explode | -61.002058 | 64.937675 | -57.378427 | 103.595571 | 4.028955 | 158.311251 | 0.122988 / 0.157201 |

全4状態でprojection boundary intersectionは0件である。512候補は同じfit範囲を512 texelで保持する。

## Stage 1

4候補 × 2 viewport × 2 theme × 4 view × 3 opacity × 4 state、合計768枚の実Three.js offscreen WebGL captureを保存した。console error／warningは0件である。

人間同一倍率確認では、baselineの中央矩形影、shadow-offの影消失、512／1024の斜め縞を明瞭に確認した。1024は512よりtexelが細かいが、斜め縞を解消しない。tight候補は前後面差ゲートも満たさず、最大relative mean differenceは512が0.463941、1024が0.464086だった。

| 候補 | 判定 | 主理由 |
|---|---|---|
| baseline | `RETAINED_DIAGNOSTIC_ONLY` | 人間評価でbaseline不合格 |
| shadow-off | `RETAINED_DIAGNOSTIC_ONLY` | 軽量対抗案だが意匠未確定、前後面ゲート未達 |
| state-tight-512 | `REJECTED_SHADOW_RESOLUTION` | 透過面の広い斜め縞、前後面ゲート未達 |
| state-tight-1024 | `REJECTED_SHADOW_RESOLUTION` | 斜め縞未解消、前後面ゲート未達、Desktop性能差分未達 |

技術候補が0件なのでStage 2は実施していない。

## 性能とrefresh

差分判定はaverage FPS悪化5%以内、p95悪化2ms以内、reversal 0、stop-then-jump 0、wheel zoom monotonic、transform invariantを維持した。baseline、shadow-off、512は両viewportで差分ゲートに合格した。1024は390×844で合格したが、1280×720のsplit＋explodeとexterior-offで不合格だった。

tight候補のidle／pointer／wheel中のshadow refreshは0、split／explode／組合せ遷移は各1回以下である。毎frame更新はない。

## 最有力原因仮説

Phase 3B.1bの結果から、次を断定ではなく最有力仮説として記録する。

`OPAQUE_SHADOW_DEPTH_FOR_TRANSPARENT_STRUCTURAL_MESHES_SUSPECTED`

構造Meshは通常描画で低opacityになるが、`castShadow`／`receiveShadow`は維持され、shadow depth passは通常Material opacityを連続的に反映しない。中央矩形境界をshadow camera fitで除去しても広い斜めbandが残り、mapSizeを512から1024へ増加しても人間目視上の改善がなかった。現行`bias`／`normalBias`は0である。このため、shadow camera解像度ではなく、透過構造Meshがshadow depth側で不透明casterとして寄与する可能性をPhase 3B.1cのStage 0で検証する。

## 回帰と保護path

- Node: 238/238
- UI: Desktop 20/20、Mobile 22/22
- HUD: Mobile 57/57
- audio: 信頼済み実クリック23/23
- 禁止干渉: 機構位置1／2 0/0、外装位置1／2 0/0
- Stage 1 console error／warning: 0
- protected path: 26/26 byte／SHA-256一致

Browser総合ではbaselineと1024に共通する既知3件があり、Desktopでは両者に前後面契約1件も共通した。Mobileでは1024だけに前後面契約1件が追加された。技術候補の採用判断には使用せず、差分として記録した。試験閾値は変更していない。

## 保留

100／99、55／54の透過不連続、shadow-offの立体感、D2c3性能、mobile全長framingは本工程で変更しない。時分針中央部の見かけ上の干渉とミニッツホイール軸表出は[POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md](./POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md)へ分離した。

Phase 3B.1b候補を既定採用、Ready化、マージしてはならない。次工程は別ブランチ・別Draft PRのPhase 3B.1cであり、Phase 3B.1b HeadからStage 0 caster attributionを先に実施する。
