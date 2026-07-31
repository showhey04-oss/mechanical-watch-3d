# Final Stabilization Phase 3B.4c-R1 evidence

このフォルダは、iOS free-runningでテンプ音が短時間に停止した事象の
決定論的再現、bounded scheduler修正、自動回帰、実Web Audio確認を保存する。

## 由来

- 物理iPhone不合格時候補:
  `82d55516a2bd6ebd2791c872f96569a741e88b02`
- R1実装基準:
  `02b127be8591f25a066e76f33df9b0a9b7ad42e9`
- branch:
  `feature/final-stabilization-phase3b4c-ios-audio-pacing`
- APP_VERSION: `v3.15.0`
- capture:
  same-origin unsandboxed iframe harness、actual Web Audio、GPU対応in-app Browser

## 判断

- Phase 3B.4c物理iPhone: `PHASE3B4C_PHYSICAL_IPHONE_REVIEW_FAILED`
- free-running dropout決定論的再現: 合格
- R1の自動技術ゲート: 合格
- R1物理iPhone再試験: 未実施
- 現在状態:
  `PHASE3B4C_R1_TECHNICAL_FIX_PENDING_PHYSICAL_IPHONE_REVIEW`
- Human Accepted: false
- default adopted: false

物理iPhone動画はローカル証跡に含まれない。baselineの数値はHuman報告および
ChatGPT側解析値であり、Codexが動画を確認したという意味ではない。

## 原因と修正

free-runningはsimulation deltaを50msへ制限する一方、AudioContextはraw wall elapsedで
進む。long frameが続くと両clockが乖離し、旧continuous absolute gridの近傍beatが
late dropへ移行し続け、audible event供給が停止した。

R1は機構beatを正本のまま、最大3beatのbounded rolling projection、
escapement-only far-future取消、booking成功後state commit、rAF watchdog、
source期限整理、単調audible cursorを導入した。独立timer／oscillator／audio-only
clockは使っていない。

## 主要結果

- 修正前free-running 60秒:
  56 audible、最終11.222秒、末尾無音48.778秒、late drop 122
- 修正前live-sync 60秒:
  303 audible、末尾無音0
- 修正後15分相当:
  9 frame pattern × free/live = 18/18合格
- 最大許容look-ahead:
  0.600秒＋epsilon 0.002秒
- 連続3beat欠落、duplicate、backlog、pending leak:
  すべて0
- actual Web Audio:
  desktop/mobile foreground、lifecycle、current-time合格
- performance:
  desktop FPS -0.04%／p95 +0.2ms、
  mobile FPS -2.37%／p95 +0.3ms
- candidate-specific browser failures:
  0

## Reports

- `free-running-starvation-reproduction.json`:
  修正前に独立commitしたfree/live差の決定論的再現
- `free-running-live-sync-r1.json`:
  同一iOS不規則入力のbefore／after
- `virtual-fifteen-minute-r1.json`:
  18本の15分相当仮想行列
- `scheduler-starvation-r1.json`:
  確定原因、棄却仮説、修正、復旧結果
- `scheduler-timeline-r1.json`:
  free-running／live-sync各60秒のclock・beat・epoch・予約・source時系列。
  15分行列の全結果は`virtual-fifteen-minute-r1.json`へ分離
- `scheduler-contract.json`:
  mechanism authority、horizon、booking、parity、cancel範囲
- `simulation-audio-epoch.json`:
  capped simulationとAudioContext wall clockの対応
- `pending-source-inventory.json`:
  cap、far-future、stale cleanup、終了inventory
- `audio-context-watchdog.json`:
  rAF上のclock／starvation監視
- `beat-sequence-integrity.json`:
  duplicate、missing、backlog、parity
- `browser-r1.json`:
  actual Web Audio、comprehensive、UI、HUD、audio
- `performance.json`:
  desktop／390×844の候補・保護経路各3回
- `physical-iphone-baseline.json`:
  Human報告の不合格内容
- `physical-iphone-candidate.json`:
  R1物理iPhone再試験待ち
- `regression-results.json`:
  Node、Browser、保護経路、機構不変
- `decision-summary.json`:
  採用禁止と次のHuman gate

旧Phase 3B.4cの3分、current-time、mixed、lifecycle、protected path reportも
履歴比較として維持する。

## Media

- `motion/ios-audio-pacing-listening.webm`:
  旧Phase 3B.4c候補の実Web Audio聴感用録画
- `motion/ios-audio-pacing-listening-r1.webm`:
  R1のfree-running escapementを10.5秒収録した、実Web Audio＋Three.js
  canvasのWebM。物理iPhone試験の代替ではない
- `raw/desktop-audio-on.jpg`:
  query限定候補の音声ON実画面
- `raw/protected-*.jpg`:
  protected pathのbase／candidate比較

## Manifest

`evidence-manifest.json`は自身を除く全ファイルを列挙し、bytesとSHA-256を保持する。
検証結果はmissing／unexpected／SHA mismatchすべて0とする。

R1の物理iPhone 15分確認が終わるまで、この証跡は採用証明ではない。
