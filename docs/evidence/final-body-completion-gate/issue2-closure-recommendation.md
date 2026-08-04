# Issue #2 Closure Recommendation

## Recommendation

`CLOSE_AS_NOT_PLANNED_ACCEPTED_LIMITATION`

Humanは上記分類によるcloseを承認済みである。PR #28をmainへ統合し、final mainのNode／product-tree gateが合格した後だけ、最終コメントを追加して`state_reason=not_planned`でcloseする。

## Reasoning

- D2c3はPR #27でcompleted-watch defaultへ採用され、PC、Native Safari、物理iPhoneでHuman受入済みである
- 中央矩形影、mobile full-length視認、foreground stabilityは後続Phase 3B.3～3B.4で実用上の受入状態へ到達したが、中央シャドウ境界とmobile full-length時のfog暗化はaccepted limitationとして残る
- 100%→99%の`transparent`不連続と55%→54%の`depthWrite`不連続は、軽量方式の候補を比較したが技術finalistがなく、Humanが既知制約として受容した
- OITは未実装であり、後継版へ引き継ぐ
- 字義上のIssue要件をすべて満たしていないため`CLOSE_AS_COMPLETED`とはしない

## Accepted limitations

- 中央シャドウ境界
- 100/99、55/54の透過方式不連続
- 透過時の暗部・深度順
- PC／iPhone照明差
- mobile full-length時のfog暗化
- clean-process absolute性能未測定

これらは隠さず文書化済みであり、本体完成を永久にブロックする未解決製品不具合とは扱わない。
