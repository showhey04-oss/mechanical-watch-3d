# Issue #2 Phase 3C.3 統合引継ぎ

## 状態

Phase 3C.3では照明、影、PMREM、environment、exposure、tone mapping、fog、材質、DPR、global transparencyを変更していない。PR #5はOpen／Draft、Issue #2はOpen、D2c3は未採用のまま維持する。

## 引継ぎ項目

1. 中央矩形影
2. 100%から99%への`transparent`急変
3. 55%から54%への`depthWrite`急変
4. A5前後面輝度差
5. PC／iPhone照明差
6. ケース・ラグ・尾錠の金属階調
7. 革・文字板・内部機構の暗部
8. オープンハート内のテンプ視認性
9. 全体CG感
10. D2c3の物理iPhone未確認
11. navy／obsidianを含む全テーマ
12. front／back／side、near／far、opacity全条件

## 分離した判断

小秒文字板の選択性はPhase 3C.3の非描画proxyで局所改善した。これは描画品質対応ではなく、Issue #2へ混在させない。

表裏分離・断面クリップのUI整理も本PRでは行わない。Issue #2後に見え方を再確認してから、詳細表示への移動、初期折りたたみ、廃止を比較する。

## 次の検証

- 同一状態のPC／物理iPhone比較
- 100／99、56／55／54／53、25／16／8%の連続性
- front／back／sideの金属階調と暗部
- 物理iPhoneでD2c3の照明候補を確認

Phase 3C.3のGeometry、機構、カメラ、UI、音響を変更せず、描画品質だけを独立候補として評価する。
