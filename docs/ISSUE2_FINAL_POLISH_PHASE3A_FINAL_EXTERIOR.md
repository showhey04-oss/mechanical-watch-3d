# Issue #2 Final Polish Phase 3A — 完成外装基準比較

## 結論

- 状態: `ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED`
- 正式監査判断: `ISSUE2_PHASE3A_AUDIT_ACCEPTED_CANDIDATES_REJECTED_NO_ADOPTION`
- Phase判断: `RETAIN_COMPARISON_HISTORY_NO_ADOPTION`
- 完成外装基準: Phase 3C.3 Head `2b94f51acf71a62b8fdca59f64de39566d6e23ee`
- 人間承認記録を含む比較開始基準: `191ff2682398356da59e747e608c82120dacebd9`
- PR #5参照Head: `79feee0f81bc719de0118042b356a2b63007090c`
- APP_VERSION: `v3.15.0`

Phase 3C.3で完成した時計全体に対して、現行baseline、PR #5のD2a、D2c3をquery限定で再構成して比較した。比較監査自体は合格とする。D2a／D2c3は矩形影を除去し暗部を持ち上げるが、既存A.5ライト契約、前後輝度差、同一環境の性能差分を満たさないため、通常表示へ採用しない。D2aは視覚参考として棄却し、D2c3は最終手段のfallbackとしてquery実装と比較履歴を残すが未採用とする。PR #5とIssue #2はOpen／Draftの保留状態を維持する。

## query境界

候補は次の完成外装queryが完全一致する場合だけ有効になる。

```text
?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3&rendering=issue2-baseline
?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3&rendering=issue2-d2a
?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3&rendering=issue2-d2c3
```

queryなし、Phase 3C.1-only、Phase 3C.2-only、Phase 3C.3-onlyは変更しない。明示baselineとPhase 3C.3-onlyは1280×720／390×844でPNG byte・SHA-256が一致した。

## 候補

| 候補 | 実装 | 判定 |
| --- | --- | --- |
| issue2-baseline | Phase 3C.3の既定照明を無変更で明示実行 | `RETAIN_AS_COMPLETED_EXTERIOR_BASELINE` |
| issue2-d2a | PR #5 D2aのworld-fixed PMREM studioと2灯RectAreaLight | `RETAIN_AS_VISUAL_REFERENCE_REJECT_FOR_ADOPTION` |
| issue2-d2c3 | PR #5 D2c3の中間調再配分、2灯＋lower bounce | `RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED` |

大面積MeshへalphaHashを使用せず、opacity閾値による影ON/OFFも追加していない。候補はlegacy DirectionalLightのshadow carrierを無効にした比較であり、shadow、tone mapping、DPR、材質、透明方式の通常値は変更しない。

## 実ブラウザ比較

- viewport: 1280×720、390×844
- 候補: 3
- 各候補・各viewport: 33シナリオ
- 実Three.js WebGL PNG: 198枚
- coverage分類: `DIMENSIONAL_COVERAGE_SET_NOT_FULL_CARTESIAN`
- theme: navy、obsidian、walnut、gallery
- view: front、dial mechanism、side、back、movement mechanism、keyless、escapement、balance、full length、near、far
- opacity: 100、99、75、56、55、54、53、50、25、16、8%
- state: running、paused、外装OFF、split、explode、selected、unselected
- console error／warning: 0
- 位置1／位置2禁止干渉: 全条件0/0
- transform invariant: true

矩形影はbaselineで再現し、D2a／D2c3ではDirectionalLight shadow carrierを外すため消えた。100→99%の`transparent`切替と55→54%の`depthWrite`切替は現行実装として再現し、Phase 3Aでは修正していない。

baselineの390×844 `full length`／`far`は、実WebGL captureが背景色だけになる黒つぶれを再現した。D2a／D2c3の同条件はnon-flatである。2枚を生成不良として除外せず、baselineの描画品質失敗証跡としてmanifestへ含める。

198枚は候補棄却に必要な主要寸法を覆うが、全theme・view・opacity・stateの完全直積ではない。したがって候補棄却には十分である一方、最終候補採用の証跡としては不足する。技術ゲートを満たす後続候補では重要条件の直積比較を追加する。

## 輝度

silhouette領域のfront／back平均輝度差は次のとおり。画面maskは比較用の決定論的領域であり、material ID segmentationではない。

| 候補 | 1280×720 | 390×844 |
| --- | ---: | ---: |
| baseline | 0.0684 | 0.1474 |
| D2a | 0.3620 | 0.3441 |
| D2c3 | 0.3285 | 0.3070 |

D2c3はD2aより前後差を抑えるが、完成外装baselineより大きい。金属中間調と暗部は改善する一方、前後均衡を満たさない。

## 性能

同一in-app Browserでbaselineと候補を比較した。差分ゲートは平均fps悪化5%以内、p95悪化2ms以内で、絶対A.6閾値の代替ではない。

| viewport | 候補 | idle平均fps | idle p95 | 差分判定 |
| --- | --- | ---: | ---: | --- |
| 1280×720 | baseline | 23.56 | 50.30ms | 環境基準 |
| 1280×720 | D2a | 15.75 | 67.40ms | FAIL |
| 1280×720 | D2c3 | 13.60 | 83.40ms | FAIL |
| 390×844 | baseline | 26.35 | 50.10ms | 環境基準 |
| 390×844 | D2a | 22.40 | 50.60ms | FAIL |
| 390×844 | D2c3 | 20.75 | 50.90ms | FAIL |

全候補でモデルtransform invariant、回転反転0、停止後跳躍0、wheel zoom monotonicを維持した。ただしD2a／D2c3は性能差分ゲートを満たさないため採用不可である。in-app Browserではbaseline自身も既存A.6絶対性能を未達であり、閾値は変更していない。

## 回帰

- Node: 210/210
- 完成外装統合回帰: 3候補×2 viewportの6/6
- UI: desktop 20/20、mobile 22/22
- HUD: desktop 45/45、mobile 57/57
- 音声: 実pointer gestureで6buffer完全読込、baseline／D2c3とも同じ`audio-resume-does-not-replay-a-backlog` 1件を未達。候補固有失敗0
- browser総合: baselineは既知A.5輝度差とin-app環境A.6を未達。D2a／D2c3はさらに既存A.5ライト構成契約を満たさない
- S86、Phase 2C、A.7、三針拘束、りゅうず、巻上げ、時刻合わせ、秒停止、外装ON/OFF、split／explode／restore: 合格
- 試験閾値変更: なし

## 次の判断

Phase 3Aの3候補から採用候補は選ばない。D2aは視覚比較履歴として棄却し、D2c3は`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`として削除せず保持する。D2c3の妥協採用を人間へ再提示できるのは、後続のbaseline-preserving候補が成立せず、視認性を人間が明確に優先し、性能悪化を明示的に許容し、PC・物理iPhone・15分連続操作と温度を確認し、Ready化・マージ・既定採用を別途承認した場合だけである。

Issue #2を解決する次候補は、完成外装baselineの前後均衡とA.5契約を保ち、RectAreaLightによる性能悪化を避ける別設計として新たに評価する。物理iPhone評価と15分発熱再試験は、技術ゲートを満たす新候補ができるまで実施しない。

時針・分針と中央リング状部品の干渉疑い、およびミニッツホイール軸の文字板表出は、照明・影・fog・透過調整へ混在させない。現象と後続診断条件は[POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md](POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md)へ`DEFERRED_POST_ISSUE2_GEOMETRY_CLEANUP`として記録する。
