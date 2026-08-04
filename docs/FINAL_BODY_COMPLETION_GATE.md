# Final Body Completion Gate

## 結論

Humanが物理iPhoneでPR #29 R3を合格とし、時刻入力blockerは解消された。PR #29 merge後mainを統合したPR #28でNode 477/477・fail 0・skip 0、製品tree exact、APP_VERSION v3.15.0、閾値変更0を確認した。

正式状態は次のとおりである。

- `MECHANICAL_WATCH_3D_BODY_COMPLETED_V3_15_0`
- `BODY_COMPLETION_BLOCKING_COUNT_ZERO`
- `POST_ADOPTION_NODE_ACCEPTANCE_STATE_ALIGNED`
- `POST_ADOPTION_NODE_GATE_PASSED`
- `CURRENT_PROTOTYPE_FEATURE_DEVELOPMENT_FROZEN`
- `SUCCESSOR_REBUILD_HANDOFF_PENDING`

blocking countは0、blockersは空である。本体完成宣言は製造用CAD、修理資料、完全デジタルツイン、OITまたは後継版の完成を意味しない。

## 解消済み時刻入力blocker

| Revision | Human結果 | 記録 |
|---|---|---|
| R1 | outer frame FAIL、overall FAIL | 履歴として保持 |
| R2 | outer frame、radii、native picker、指定／現在時刻、core overflow PASS | core修正受入 |
| R3 | `HH:MM:SS`、上下・左右中央、二重表示なし、native picker、picker後表示、指定／現在時刻、overall PASS | `human-review-r3.json` |

Human reviewed product Headは`cf1751265410a160715db2bd9566b1703d916bac`、PR #29 merge commitは`25f852a0218486f695a5e2b88c7fc9b665c8c362`である。正式分類は`IPHONE_TIME_INPUT_COMPLETION_BLOCKER_RESOLVED`とする。

## モード別判定

| モード | 判定 | 根拠 | 制約 |
|---|---|---|---|
| 時計モード | `PASS` | completed-watch default、巻上げ、時刻合わせ、秒停止、作動音、PR #29時刻入力をPC／物理iPhoneで受入済み | なし |
| 機構観察モード | `PASS_WITH_ACCEPTED_LIMITATION` | 全方向camera、表裏、透過、split、explode、選択、動力経路、脱進機、テンプを統合済み | 透明・影・端末差をaccepted limitationとして保持 |
| 学習モード | `PASS` | 部品名称、機能、動力経路、HUD／学習タブ同期を実装・確認 | 厳密な組立順序と組立／分解手順は完成条件外 |

## Accepted rendering limitations

Issue #2の中央シャドウ境界、100%／99%の`transparent`切替、55%／54%の`depthWrite`切替、透過時の暗部・深度順序、PC／iPhone照明差、モバイル全長時のfog暗化は存在を隠さずaccepted limitationとする。深度順序はOIT未実装に起因する。現行v3.15.0では追加改修せず、Issue #2を`not planned`でcloseする承認を得ている。

## Successor rebuild handoff

次は現行prototypeの完成blockerではなく`DEFER_TO_SUCCESSOR_REBUILD`とする。

- Geometry：時針／分針と中央リング状部品、ミニッツホイール軸の文字板側表出、緩急目盛とテンプ受、浮遊する灰色板状Object 2枚を診断する
- UI copy：Phase／PR／候補等の開発文言、「選択部品情報」「選択部品：」を通常UIから除き、部品名を直接見出し、説明を1～2文へ簡潔化する
- Crown UI：`ADOPT_UNIFIED_TWO_OPTION_SEGMENTED_CONTROL`として「巻上げ／時刻合わせ」とりゅうず回転sliderを説明欄下へ統合する
- Mobile blank tap：drag／pan／pinch／UI操作を除く空白tapで、選択、説明、bottom sheetを閉じる
- Lifecycle／rendering：Phase 3B.4dとOIT
- 将来改善：厳密な組立／分解手順、PWA／offline、高級仕上げ、Blender／GLB、3時位置りゅうず起点の内部再配置

## 最終統合条件

- Node 477件以上、fail 0、skip 0
- `index.html`、`js/**`、`assets/audio/**`、`package.json`、`package-lock.json`がPR #29 merge後mainとexact
- changed JSON parse、Markdown link、manifest、`git diff --check`合格
- APP_VERSION v3.15.0
- Independent review Critical／Major／Minor 0／0／0
- PR #28をmerge commit方式で統合したfinal mainでも同じNode gateを再実行

final main gate合格後にのみIssue #2をaccepted limitation／not planned、PR #5をsuperseded／without mergeとしてcloseする。PR #30は別工程でfinal mainへ整合する。
