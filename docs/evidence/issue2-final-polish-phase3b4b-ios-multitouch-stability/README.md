# Issue #2 Final Polish Phase 3B.4b evidence

## 状態

`STOPPED_PHYSICAL_IPHONE_REPRODUCTION_INCONCLUSIVE`

query限定のevent-driven multi-touch cleanup候補は自動技術ゲートに合格した。物理iPhoneのA／B／C各5分と候補Cの連続15分確認は未実施であり、候補は未採用である。

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
- `reports/physical-iphone-review.json`: 必須15分確認の未実施記録
- `reports/decision-summary.json`: 未採用判断
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

物理iPhoneは未実施である。A、B、C各5分および候補C 15分を完了するまで、framing固有性、物理root cause、manual reload不要、技術finalist、人間合格を確定しない。

Ready化、マージ、D2c3／framing／input候補の既定採用、Issue #2のクローズは行わない。
