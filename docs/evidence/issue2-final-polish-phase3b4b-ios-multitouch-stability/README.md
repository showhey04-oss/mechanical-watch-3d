# Issue #2 Final Polish Phase 3B.4b evidence

## 状態

`PHASE3B4B_ACCEPTED_PENDING_FINAL_INTEGRATION`

query限定のevent-driven multi-touch cleanup候補は自動技術ゲートに合格した。物理iPhoneではAが49秒、Bが55秒で劣化を再現し、候補Cは15分以上再現しなかったため、`IOS_MULTITOUCH_STABILITY_TECHNICAL_FINALIST`かつ`HUMAN_ACCEPT_IOS_MULTITOUCH_STABILITY_FIX`とした。候補はquery限定・未採用のままである。

## 由来

- source base: `ece9d99c4e0ff95afd155475ef963e2984c5d05f`
- source audit: `fac59b714d66215ee0c60b688c0201fea1d9fde4`
- branch: `feature/issue2-final-polish-phase3b4b-ios-multitouch-stability`
- APP_VERSION: `v3.15.0`
- capture: same-origin unsandboxed iframe harness and in-app Browser

## 内容

- `reports/code-audit.json`: Pointer Events／Arcball lifecycle監査
- `reports/event-state-timeline.json`: event単位の入力・camera状態
- `reports/active-pointer-inventory.json`: active pointer／capture／idle不変条件
- `reports/reset-reason-summary.json`: cancel、lost capture、ID reuse、lifecycle cleanup
- `reports/framing-comparison.json`: A／B／C短時間自動比較
- `reports/synthetic-pointer-results.json`: Desktop 24 cycle／Mobile 60 cycle
- `reports/camera-state.json`: desired／actual camera有限性とtransform
- `reports/selection.json`: 設定車2、HUD／学習同期、空白解除
- `reports/performance.json`: current／candidate各3反復の差分
- `reports/regression-results.json`: Node、browser、UI、HUD、audio、S86、A.7、干渉
- `reports/protected-paths.json`: Baseとのpixel／state保護
- `reports/physical-iphone-review.json`: A／B再現とC 15分合格の物理iPhone記録
- `reports/human-review-status.json`: 人間受入と未報告項目の境界
- `reports/decision-summary.json`: 技術finalist／人間受入／未採用判断
- `raw/`: 実ブラウザDesktop／MobileとA／B／C raw capture
- `boards/`: A／B／C、Desktop／Mobile、入力状態遷移
- `motion/`: 実ブラウザ操作frameとGIF
- `evidence-manifest.json`: 自己参照を除くclosed-world bytes／SHA-256

## 自動結果

- gesture終了後idle復帰: 100%
- pointercancel／lostpointercapture後idle復帰: 100%
- pointer ID再利用衝突: 0
- active pointer／capture残留: 0
- stale pointer age超過: 0
- camera NaN／Infinity: 0
- transform invariant: true
- selection／HUD／学習／解除: 合格
- performance differential: Desktop／Mobile、idle／pointer／wheel 6/6
- deterministic protected captures: 6/6 PNG byte／SHA exact
- candidate-specific regression: 0
- application console error／warning: 0／0

selected captureはBase自身に時間位相のあるhighlight差があるため、pixel exactではなく機能状態一致で確認した。A.5 lighting contractとA.6絶対性能の既知例外を候補固有回帰として扱わない。

## 物理確認

iPhone 16／iOS 26.5.2でA／Bの再現と候補Cの15分以上の無再現を確認した。framingなし／ありの両方で症状が出たため`CANDIDATE_INDEPENDENT_CAMERA_GESTURE_STATE_ISSUE`、候補Cは`HUMAN_ACCEPT_IOS_MULTITOUCH_STABILITY_FIX`とする。presetとselectionの手動結果は`NOT_REPORTED`であり、自動回帰結果で代替しない。

Ready化、マージ、D2c3／framing／input候補の既定採用、Issue #2のクローズは行わない。
