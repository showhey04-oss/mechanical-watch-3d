# Issue #2 Final Polish Phase 3B.4a — Mobile Full-Length Framing

## 結論

Phase 3B.4aでは、Phase 3B.3で人間選定されたD2c3のモバイル全長表示について、完成時計の実Geometryからcamera fit距離を算定し、明示query時だけモバイルの`maxDistance`を120から204.1へ拡張した。

判定は次とする。

`HUMAN_ACCEPT_MOBILE_FULL_LENGTH_FRAMING_FIX`

Phase状態は`PHASE3B4A_ACCEPTED_PENDING_FINAL_INTEGRATION`とする。この候補はquery限定・未採用である。初期表示、camera target、FOV、near／far、Desktop、Geometry、Light、fog、Material、透過処理、UI、audio、APP_VERSION、試験閾値は変更していない。Ready化、マージ、既定採用、Issue #2のクローズは行わない。

## 候補query

```text
?exterior=balanced
&watchHead=phase3c1
&strapStyle=phase3c2
&integration=phase3c3
&rendering=issue2-d2c3
&continuity=issue2-current
&framing=issue2-mobile-full-length-fit
```

`framing=issue2-mobile-full-length-fit`は、上記完成外装query、D2c3またはShadow-off、viewport幅420以下がすべて一致したときだけ適用する。User-Agent判定、動的fit、毎frameのbounds計算は追加していない。

## Stage 0 — 実Geometry fit

390×844、FOV 42度、near 0.1、far 300、target `[0, 0.5, 0]`を維持して、表示中の407,428 world-space Geometry頂点を測定した。

- raw fit distance: 199.068109
- safety margin: 2.5%
- distance with safety: 204.044811
- static candidate maxDistance: 204.1
- current maxDistance: 120
- safe camera budget: 240
- far-distance upper bound: 228.791472
- near/far feasible: true
- limiting part: `Phase 3C.2 6時側黒革ストラップ`

完成時計の実測bounds:

- watch head: `[-19.799999, -3.46, -48.253441]` ～ `[19.799999, 29.224998, 39.908573]`
- strap and attachments: `[-12.4, -0.802857, -83.671776]` ～ `[12.4, 71.095528, 71.496239]`
- combined: `[-19.799999, -3.46, -83.671776]` ～ `[19.799999, 71.095528, 71.496239]`
- bounding sphere radius: 88.322986
- buckle: `[-9.5, 41.697933, 66.974953]` ～ `[9.5, 57.252251, 69.620918]`

## 最大zoom-out

390×844、距離204.1の投影結果はD2c3／Shadow-offと4テーマで一致した。

- left margin: 22.4924%
- right margin: 21.5012%
- top margin: 9.3176%
- bottom margin: 4.0265%
- projected width occupancy: 56.0065%
- projected height occupancy: 86.6559%
- near margin: 200.012453
- far margin: 24.691472
- clipping: false

必要最小3%を全辺で満たし、過剰な距離sweepは行っていない。

## 初期表示とDesktop保護

currentとfit候補の初期／復帰状態を、2 rendering、2 viewport、4 theme、計32比較で照合した。全比較でPNG byte／SHA-256一致である。

Desktopではfit queryを指定しても候補を適用せず、`maxDistance=120`、初期camera、front／back／side、near／far、pointer、wheel、selectionを維持した。選択ハイライトを除く48固定画像はPNG byte exactである。selected画像は時間位相を持つハイライトのためpixel同値判定から除外し、8条件で選択対象、camera、transformのexact一致を別確認した。通常path、Phase 3C.1-only、Phase 3C.2-only、Phase 3C.3-only、Phase 3A～3B.3の既存queryも変更していない。

## 操作

実pointer／wheel／二点touch相当入力で次を確認した。

- pinch zoom out／in: monotonic
- wheel zoom out／in: monotonic
- reversal: 0
- stop-then-jump: 0
- target drift: `[0, 0, 0]`
- transform invariant: true
- 最大距離で`設定車2`を選択可能
- 空白入力で選択解除
- 初期距離へexact restore
- D2c3／Shadow-offで同一camera fit

分類は次とする。

`MOBILE_FRAMING_FIX_CONFIRMED_CANDIDATE_INDEPENDENT`

## 性能

Desktop／390×844でcurrentとfitを各3反復し、idle、pointer、wheelの中央値を比較した。全6比較で平均fps悪化5%以内、p95悪化2ms以内に合格した。最大悪化はDesktop pointerの平均fps 4.028371%、p95 0.8msである。

Mobileでfit側が大幅に速い測定値は実行順・ブラウザ環境の影響を含むため、性能改善とは主張しない。結論は候補固有の差分悪化なしに限定する。per-frame bounds計算は0、閾値変更は0である。

## 回帰

- Node: 全件合格
- UI: 22/22
- HUD: 57/57
- trusted audio: 23/23
- S86: 合格
- Phase 2C: 不変
- A.7: 9/9
- 禁止干渉: 0/0
- console application error／warning: 0/0

Desktop／Mobile comprehensiveで残るA.5照明契約とA.6絶対性能の未達は、選定D2c3で既に記録済みのtradeoffであり、Phase 3B.4a固有失敗は0件である。試験閾値は変更していない。

## Stage 1証跡

- 2 framing × 2 rendering × 2 viewport × 4 theme × 7 capture
- actual Three.js WebGL PNG: 224枚
- motion frame: 26枚
- comparison board: 6枚
- GIF: 3本
- performance: 2 viewport × 2 framing × 3 scenario × 3反復

## 人間確認

iPhone 16／iOS 26.5.2、Safari／ホーム画面、輝度50%、低電力モードOFF、ケースあり、室温25℃で15分確認した。

- 従来D2c3との初期構図・明るさ・初期操作感: 合格
- ケース、上下ストラップ端、尾錠、上下左右余白、過剰縮小なし、clippingなし: 合格
- 全長時のfog暗化: `MOBILE_FULL_LENGTH_FOG_DARKENING_ACCEPTED_AS_IS`
- 初期距離復帰、front／back／side、最大距離回転、設定車2選択、HUD／学習同期、空白タップ解除、split／explode／restore: 合格
- progressive frame drop: 報告上なし
- WebGL表示消失: なし
- 発熱: 軽微・許容

正式判断は`HUMAN_ACCEPT_MOBILE_FULL_LENGTH_FRAMING_FIX`、`PHASE3B4A_ACCEPTED_PENDING_FINAL_INTEGRATION`である。

一般tap異常は明確に報告されていない。一方、2～3分後に二本指pan、pinch in／out、二本指を含むrotationが不自然になり、手動reloadで復旧した。これは`HUMAN_REPORTED_IOS_MULTITOUCH_GESTURE_DEGRADATION_AFTER_2_TO_3_MINUTES`としてPhase 3B.4bへ分離する。自動reloadは`NOT_REPORTED`である。

`IOS_BALANCE_AUDIO_PACING_SLOWDOWN_REPRODUCED`も記録するが、本工程では修正しない。

## 未変更・保留

- D2c3はquery限定、`defaultAdopted=false`
- Shadow-offは比較履歴として維持
- 100%／99%、55%／54%の既知不連続
- OIT
- iOSテンプ音ペーシング
- 時分針中央干渉
- ミニッツホイール軸表出
- Geometry、Light、fog、Material、shadow、透過処理
- camera target、FOV、near／far、Desktop maxDistance
- UI、audio、APP_VERSION、試験閾値

Issue #2はOpen、PR #5はOpen／Draftのまま維持する。
