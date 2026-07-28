# Issue #2 Phase 3B.3 — Human PC Review

## 状態

- review completed: `false`
- selected candidate: `null`
- adoption decision: `null`
- required status: `AWAITING_HUMAN_PC_AND_PHYSICAL_IPHONE_FINAL_CANDIDATE_DECISION`

## 実行条件

- 固定commit URLを使用する
- Chrome／Safari等、同じブラウザで候補を交互に確認する
- viewport、DPR、theme、時刻、操作順を揃える
- 比較ボード以外のWebGLタブを閉じる
- 各候補の前に完全再読込し、初期化後10秒待つ
- Console error／warningを記録する

## 確認順

1. Shadow-off navy front
2. D2c3 navy front
3. D2c3 navy movement back
4. Shadow-off navy movement back
5. 4 themeのfront／back
6. opacity 100／99、55／54、16
7. selected、split、explode、exterior OFF
8. near、full-length、far
9. 回転、zoom、wheel、選択解除

## 記録票

| 項目 | Shadow-off | D2c3 | 備考 |
|---|---|---|---|
| front視認性 | 未確認 | 未確認 | |
| movement back視認性 | 未確認 | 未確認 | |
| 前後面バランス | 未確認 | 未確認 | |
| 金属中間調 | 未確認 | 未確認 | |
| opacity 16内部視認 | 未確認 | 未確認 | |
| 100／99既知不連続の許容 | 未確認 | 未確認 | |
| 55／54既知不連続の許容 | 未確認 | 未確認 | |
| selected | 未確認 | 未確認 | |
| split／explode／restore | 未確認 | 未確認 | |
| exterior ON／OFF | 未確認 | 未確認 | |
| 回転／zoom／wheel | 未確認 | 未確認 | |
| console error／warning | 未確認 | 未確認 | |

## PC判断

- preferred candidate: `null`
- both unacceptable: `null`
- proceed to physical iPhone: `false`
- notes:

PC比較完了前に物理iPhone最終判断、Ready化、マージ、既定採用を行わない。
