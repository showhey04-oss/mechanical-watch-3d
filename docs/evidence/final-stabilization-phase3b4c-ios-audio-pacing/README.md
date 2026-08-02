# Final Stabilization Phase 3B.4c-R1.1 evidence

このフォルダは、R1の音響連続性合格後に検出した機構／音響位相発散と、
`studyBeat`を正本へ戻したR1.1の自動技術証跡を保存する。

## 由来

- R1確認済みHead:
  `0d0dd4cadce3f5929563360c15c6f31ea16e2a48`
- R1.1 scheduler／位相計測実装:
  `3de2886011dafaea540f2ea2650d2ab326cf3216`
- branch:
  `feature/final-stabilization-phase3b4c-ios-audio-pacing`
- APP_VERSION:
  `v3.15.0`
- browser capture:
  same-origin unsandboxed iframe harness、actual Web Audio、GPU対応in-app Browser

## 判断

開始状態:

```text
PHASE3B4C_R1_AUDIO_CONTINUITY_GATE_PASSED
PHASE3B4C_R1_MECHANISM_AUDIO_PHASE_DIVERGENCE_DETECTED
PHASE3B4C_R1_TECHNICAL_ACCEPTANCE_BLOCKED
PHYSICAL_IPHONE_RETEST_DEFERRED_PENDING_MECHANISM_SYNC_CLOSURE
```

R1.1自動判定:

```text
PHASE3B4C_R1_1_AUTOMATED_MECHANISM_SYNC_CLOSURE_PASSED
```

- Technical Finalist: false
- Human Accepted: false
- default adopted: false
- physical iPhone retest: 未実施、別途Human承認が必要

## 原因と修正

R1は0.2秒cadenceを維持するため、AudioContext clockだけで
`lastTargetBeat + 1`を進めた。iOS不規則free-running 15分では
mechanism crossing 2,275に対しaudible 4,501、差+2,226を許容していた。

R1.1はOption Aだけを実装した。

- free-runningは`studyBeat`の次の整数beatを0.25-beat window内だけ予約
- live-syncは`studyBeat`から最大3beatを予約
- catch-up、duplicate、audio-only beat identityなし
- 発音時は隣接正本機構frameまたはlive-sync wall projectionから位相を評価
- accepted phase errorは50ms × 5Hz = 0.25 beat
- pendingを除くcount divergenceを累積させない

global timebase、機構、描画、UI、音源、gain、閾値は変更していない。

## 主要結果

- 9 frame pattern × free/live × 15分: 18/18
- phase contract: 18/18
- duplicate／backlog／3beat連続欠落／inventory leak: 0
- desktop actual Web Audio: 50/50、位相誤差+0.0606〜-0.0895 beat
- 390×844 actual Web Audio: 50/50、位相誤差+0.0607〜-0.0493 beat
- performance differential:
  desktop FPS -0.27%／p95 +0.30ms、
  mobile FPS -0.35%／p95 -0.10ms
- Node: 318/318

## Reports

- `free-running-starvation-reproduction.json`:
  R1以前のfree-running音声停止再現
- `mechanism-audio-phase-before-after-r1-1.json`:
  R1の+2,226 beat発散とR1.1の15分結果
- `mechanism-audio-phase-timeline-r1-1.json`:
  `studyBeat`、`targetBeat`、projection、audible位相誤差、累積差の時系列
- `virtual-fifteen-minute-r1.json`:
  18本の15分仮想行列と機構同期contract
- `free-running-live-sync-r1.json`:
  同一不規則frameのbefore／after
- `scheduler-starvation-r1.json`:
  原因、棄却仮説、Option A修正
- `scheduler-timeline-r1.json`:
  free-running／live-sync各60秒のclock・予約・発音ログ
- `scheduler-contract.json`:
  projection、audible phase、count divergence、parity、pending
- `simulation-audio-epoch.json`:
  capped simulationとAudioContext wall clockの分離
- `pending-source-inventory.json`:
  cap、cancel、cleanup、終了inventory
- `audio-context-watchdog.json`:
  rAF上のclock／mechanism-beat starvation監視
- `beat-sequence-integrity.json`:
  duplicate、missing、backlog、parity
- `browser-r1.json`:
  actual Web Audio、UI／HUD／audio、console分類
- `performance.json`:
  desktop／390×844の候補・保護経路各3回
- `physical-iphone-baseline.json`:
  既存Human不合格報告
- `physical-iphone-candidate.json`:
  R1.1再試験未実施・未承認
- `regression-results.json`:
  Node、Browser、保護経路、機構不変
- `decision-summary.json`:
  R1.1自動同期閉鎖と採用禁止

旧Phase 3B.4c／R1のreportとmediaは履歴比較として維持する。

## Manifest

`evidence-manifest.json`は自身を除く全証跡を列挙し、bytesとSHA-256を保持する。
missing／unexpected／SHA mismatchはすべて0とする。物理iPhone再試験が
別途承認・完了するまで、この証跡はHuman acceptanceや採用証明ではない。
