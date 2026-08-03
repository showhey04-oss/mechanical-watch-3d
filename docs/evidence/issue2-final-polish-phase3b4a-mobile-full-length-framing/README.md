# Issue #2 Final Polish Phase 3B.4a evidence

## 状態

`HUMAN_ACCEPT_MOBILE_FULL_LENGTH_FRAMING_FIX`

選定D2c3のモバイル全長構図を、実Geometryから算定した静的`maxDistance=204.1`で検証した証跡である。iPhone 16／iOS 26.5.2の15分人間確認で`PHASE3B4A_ACCEPTED_PENDING_FINAL_INTEGRATION`とした。候補はquery限定・未採用である。

## 由来

- source base: `3e56772b2ec1ef1ff19a2d1bfe46f1fc9e36b4fb`
- source implementation: `fc57b90118a4a8fa757e64b0ecfcbb9ba3ba2b05`
- branch: `feature/issue2-final-polish-phase3b4a-mobile-full-length-framing`
- APP_VERSION: `v3.15.0`
- capture: same-origin unsandboxed iframe harness with actual Three.js WebGL render-target PNG capture

## 実測値

- measured vertices: 407,428
- raw fit distance: 199.068109
- 2.5% safety distance: 204.044811
- candidate maxDistance: 204.1
- safe budget: 240
- minimum viewport margin: 4.0265%
- near/far clipping: 0

## 内容

- `raw/`: 2 framing × 2 rendering × 2 viewport × 4 theme × 7 capture = 224 actual WebGL PNG
- `motion/`: pinch 10 frame、maximum rotation 10 frame、restore 6 frame
- `boards/`: before／after、4 theme、Desktop同値性、候補独立性、margin、frustum
- `reports/`: camera fit、bounds、margin、interaction、performance、回帰、protected path、判断
- `evidence-manifest.json`: 自己参照を除くclosed-world bytes／SHA-256一覧

## 技術結果

- 初期／復帰camera: 32/32 PNG byte exact
- Desktop固定画像: 48/48 PNG byte exact
- Desktop selected: 8/8 selection／camera／transform exact（時間位相を持つハイライト画像はpixel同値判定外）
- Mobile margin: left 22.4924%、right 21.5012%、top 9.3176%、bottom 4.0265%
- pinch／wheel reversal: 0
- target drift: 0
- transform invariant: true
- 最大距離selection／clear／restore: 合格
- performance differential: 6/6合格
- per-frame bounds calculation: 0
- framing-specific regression: 0

comprehensive suiteに残るA.5照明契約とA.6絶対性能の未達は、選定D2c3の既知tradeoffとして分離する。Phase 3B.4aの試験閾値は変更していない。

## 人間確認

`reports/physical-iphone-review.json`へ、Safari／ホーム画面、輝度50%、低電力OFF、ケースあり、室温25℃、15分の結果を保存した。初期構図、全長、余白、preset、最大距離回転、設定車2選択、HUD同期、解除、split／explode／restoreは合格し、fog暗化は許容した。軽微な発熱は許容、progressive frame dropと自動reloadは報告なしである。

2～3分後の二本指pan／pinch／rotation劣化と手動reloadによる復旧はPhase 3B.4bへ、iOS音響ペーシング低下は別工程へ分離する。既定採用、Ready化、マージ、Issue #2クローズを行わない。
