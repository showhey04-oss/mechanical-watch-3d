# Final Stabilization Phase 3B.4c evidence

このフォルダは、iOSで約1分後から聞こえるテンプ音の遅れに対する
query限定診断・修正候補の証跡である。

## 由来

- source base commit:
  `d6718e59a2438152a4a203fa579b66ce6e91ecd3`
- source audit commit:
  `025e2fd0f2d5d09a1183060c326177f8e74b94c4`
- source branch:
  `feature/final-stabilization-phase3b4c-ios-audio-pacing`
- APP_VERSION: `v3.15.0`
- capture mode:
  same-origin unsandboxed iframe harness in GPU-capable in-app Browser

## 結論

- cause: `FRAME_CROSSING_AUDIO_EVENT_DELAY`
- automated technical gates: PASSED
- physical iPhone candidate: NOT RUN
- final decision:
  `STOPPED_PHYSICAL_IPHONE_AUDIO_REPRODUCTION_INCONCLUSIVE`
- default adoption: false

基準3分測定は610イベント、平均cadence誤差47.360%、p95偏差101.859ms。
候補3分測定は900イベント、平均0.060%、p95偏差20.590ms。
候補のduplicate、late-drop、backlog burst、AudioContext stallはいずれも0。

## reports

- `code-audit.json`: 現行音響と候補のコード監査
- `scheduler-contract.json`: 機構正本、absolute scheduling、beat由来閾値
- `simulation-audio-epoch.json`: simulationからAudioContextまでのepoch対応
- `three-minute-baseline.json`: 3分diagnostics実測
- `three-minute-candidate.json`: 3分stability実測
- `current-time-setting.json`: 60秒＋現在時刻設定＋120秒
- `operation-mixed.json`: 巻上げ、空転、位置1／2混在
- `lifecycle.json`: visible／hidden／visible
- `audio-context-watchdog.json`: clock stall監視
- `beat-sequence-integrity.json`: duplicate／missing／backlog
- `pending-source-inventory.json`: pending上限と取消契約
- `physical-iphone-baseline.json`: 人間報告済み再現条件
- `physical-iphone-candidate.json`: 物理iPhone未実施
- `performance.json`: desktop／390×844各3回と中央値
- `regression-results.json`: Node・Browser・UI・HUD・audio回帰
- `protected-paths.json`: Part A固定commitとのpixel exact
- `decision-summary.json`: 採用境界とPhase 3B.4d引継ぎ

## media

- `motion/ios-audio-pacing-listening.webm`:
  実Web Audio出力を含む10.5秒の聴感確認用録画
- `raw/desktop-audio-on.jpg`:
  stability query、音声ONの実画面
- `raw/protected-*-base.jpg` と `raw/protected-*-candidate.jpg`:
  protected pathのbase／candidate比較

## manifest

`evidence-manifest.json` は自身を除くフォルダ内全ファイルをclosed-world対象とし、
各ファイルのbytesとSHA-256を記録する。

物理iPhone候補確認が完了するまで、この証跡は採用証明ではなく
自動技術ゲート合格と停止理由の記録である。
