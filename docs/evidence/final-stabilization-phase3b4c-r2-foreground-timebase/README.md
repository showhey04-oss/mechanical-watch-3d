# Final Stabilization Phase 3B.4c-R2 evidence

このフォルダは、R1.1の物理iPhone free-running不合格を受けて、
foreground機構時間を描画deltaから分離したquery限定R2候補の証跡を保存する。

## Provenance

- Base: `b6b89f68020d399bb8dc5cbf8fd01f64401454f3`
- timebase consumer inventory: `53b92e8`
- mechanism elapsed implementation: `db40e6a`
- browser diagnostic source: `a50cb5006a5f221485d5a042b836eabde00e1293`
- Branch: `feature/final-stabilization-phase3b4c-ios-audio-pacing`
- APP_VERSION: `v3.15.0`

## 状態

```text
PHASE3B4C_R1_1_PHYSICAL_IPHONE_FREE_RUNNING_RETEST_FAILED
PHASE3B4C_R1_1_NOT_ACCEPTED
PHASE3B4C_R2_AUTOMATED_FOREGROUND_TIMEBASE_GATE_PASSED_PHYSICAL_IPHONE_RETEST_PENDING
```

R2はquery-only、未採用、Human未承認である。Ready化、マージ、
Phase 3B.4dは行っていない。

## Reports

- `timebase-consumer-inventory.json`: dt／clock consumer分類
- `human-physical-iphone-r1-1.json`: Human／ChatGPT報告。Codex動画解析ではない
- `virtual-fifteen-minute-r2.json`: 9 pattern × 2 mode、各15分
- `foreground-wall-mechanism-timeline-r2.json`: capped before／R2 after
- `study-beat-timeline-r2.json`: authoritative studyBeat
- `small-seconds-wall-progression-r2.json`: 小秒のwall progression
- `balance-escapement-cadence-r2.json`: テンプ／脱進機の共有正本
- `mechanism-audio-phase-r2.json`: R1.1位相contract
- `power-reserve-timeline-r2.json`: 900秒で0.25時間消費
- `lifecycle-r2.json`: hidden interval非復元
- `browser-r2.json`: Desktop／Mobile actual Web Audioと総合回帰
- `performance-r2.json`: protected／R2差分
- `regression-results.json`: 回帰結果
- `decision-summary.json`: 未採用の自動判定
- `evidence-manifest.json`: closed-world SHA-256

## Captures

`protected-*`と`candidate-*`はpaused、navy、10:10:30、opacity 100%、
panel collapsed、同一cameraで取得したin-app Browser実画面である。

- `protected-desktop-1280x720.jpg`
- `candidate-desktop-1280x720.jpg`
- `protected-mobile-390x844.jpg`
- `candidate-mobile-390x844.jpg`

各viewport内で保護pathとR2候補はbyte／SHA exactである。DesktopとMobileは
異なるviewportなので相互のSHAは異なる。

## 再生成

決定論的JSONとmanifestは次から生成する。

```bash
node tests/generate-final-stabilization-phase3b4c-r2-evidence.mjs
```

実ブラウザのactual Web Audio、回帰、性能、captureはブラウザ実測値であり、
generatorが推測値へ置換しない。
