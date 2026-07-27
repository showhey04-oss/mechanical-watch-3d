# Post-Issue #2 Geometry Cleanup Notes

## 位置付け

- 状態: `DEFERRED_POST_ISSUE2_GEOMETRY_CLEANUP`
- 仮称: `FINAL_GEOMETRY_CLEANUP_POST_ISSUE2`
- 実施時期: Issue #2の最終描画候補を人間承認した後、本体完成判断の前
- 現工程: 診断項目の記録だけ。Geometryは変更しない

これらは照明、影、fog、透過調整とは別問題であり、Issue #2 Final Polish Phase 3B.1へ混在させない。証跡に現象が見えても原因を推測で断定せず、独立工程で実Geometryを診断する。

## 1. 時針・分針と中央リング状部品の干渉疑い

- 状態: `DEFERRED_CENTER_HAND_RING_GEOMETRY_INTERFERENCE`
- 現象: 中央の矩形影が除去された候補で、時針または分針が中央付近のリング状部品と干渉しているように見える
- 現時点の判断: screen-space overlapか実Geometry交差か未確認。干渉Object名も未確定

### 後続監査

- 時針側／分針側の干渉Object
- triangleとworld position
- screen-space overlapと実Geometry交差の分離
- 最小clearance
- 時刻: 10:10:30、03:00:00、06:30:00、12:00:00
- view: 正面、斜め正面、側面
- opacity: 100%、16%
- selected／unselected

候補としてhour hand boss、minute hand boss、hour pipe、cannon tube、cannon pinion、中央の装飾ringまたは保持ringを診断してよいが、原因確定前に修正しない。

### 保護対象

- 針中心、針位相、三針拘束、回転方向
- 歯車比
- S86
- Phase 2C
- A.7

## 2. ミニッツホイール軸の文字板表出

- 状態: `DEFERRED_MINUTE_WHEEL_ARBOR_DIAL_PROTRUSION`
- 現象: ミニッツホイール軸が文字板表面側へ表出して見える
- 現時点の判断: 実時計機構上必要な突出か、教育表示上の簡略化か、軸長だけの局所修正で閉鎖できるか未確認

### 後続監査

- arbor Object名とworld Y最小／最大
- dial front／rear Y datum
- dialとの実交差量
- 文字板の穴・開口Geometry
- 正面での露出面積、斜めでの露出量
- opacity 100%／16%
- 実時計機構上必要な突出か
- 教育表示上の簡略化か
- 軸長だけの局所修正で閉鎖できるか

### 保護対象

- ミニッツホイール中心、径、歯数
- 噛合い、回転比
- 日の裏輪列配置
- Phase 2C
- A.7

## 想定順序

1. Issue #2最終候補決定
2. PC／物理iPhone描画確認
3. 時分針中央干渉診断
4. ミニッツホイール軸表出診断
5. 局所Geometry修正
6. 時計機能、選択、表示、性能回帰
7. 本体完成前の最終統合確認
