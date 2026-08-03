# Final Stabilization Phase 3B.4c-R2.2

## 判定

```text
PHASE3B4C_R2_2_AUTOMATED_OUTPUT_LIVENESS_GATE_PASSED
PHASE3B4C_R2_2_PHYSICAL_IPHONE_RETEST_REQUIRED
```

R2.1の物理iPhone確認で、`AudioContext.state === "running"`と緑色の作動音ON表示にも
かかわらず実音が復旧しないfalse positiveが再現された。R2.2はforeground復帰を
lifecycle cycleとして管理し、実出力pipelineの進行を確認するまでON表示へ戻さない。

自動試験とactual Web Audio試験は合格したが、JavaScriptは物理スピーカーの発音を
証明できない。Codex Browser自動操作も`isTrusted=false`であるため、物理iPhoneの
1 gesture復旧をHumanが再確認するまで技術受入、Ready化、マージ、既定採用を行わない。

## Human R2.1結果

次を正式な入力結果として保持する。

- `PHASE3B4C_R2_1_PHYSICAL_IPHONE_BASIC_SANITY_PASS`
- `PHASE3B4C_R2_1_PHYSICAL_IPHONE_TIME_SETTING_RECOVERY_PASS`
- `PHASE3B4C_R2_1_FOREGROUND_AUTO_RESUME_FAILED`
- `PHASE3B4C_R2_1_SINGLE_TRUSTED_GESTURE_RECOVERY_FAILED`
- `PHASE3B4C_R2_1_AUDIO_UI_RUNNING_FALSE_POSITIVE_REPRODUCED`
- `PHASE3B4C_R2_1_NOT_ACCEPTED`

添付動画の所見はHuman／ChatGPT観察として記録する。動画ファイルはworktreeに存在せず、
Codexが独立解析したとは主張しない。

## 原因

R2.1は`context.state === "running"`へ到達するとgainとUIを復帰できた。しかしiOSでは、
contextのstateだけが復旧しても、scheduler generation、新規source lifecycle、出力時刻、
gain経路が進んでいない場合がある。この状態を実音復旧として扱っていた。

また、自動resumeが処理中の間に最初のtrusted gestureが来ると、そのgesture内で
`context.resume()`を直ちに呼ばず、既存Promiseの完了後へ持ち越す競合があった。

## 実装

### Foreground recovery cycle

hiddenからvisibleへ戻るたびにcycle IDを発行し、次をcycle単位で記録する。

- context generation
- scheduler generation before／after
- scheduler re-anchor claim count
- source lifecycle baseline／progress
- context time／output timestamp progress
- master gain復帰指令
- duplicate／backlog burst
- recovery route、verification frame、failure reason

同じcycleのvisibility、pageshow、focus重複はschedulerを1回だけre-anchorする。

### Output-pipeline liveness

次をすべて満たした場合だけ`pipelineLiveness=true`とする。

1. AudioContextがrunning
2. scheduler generationが確立
3. 新しいescapement sourceがstartされる
4. source lifecycleが進む
5. context timeまたはoutput timestampが進む
6. master gain 0.36の復帰指令が発行済み
7. duplicate 0、backlog burst 0

`running`のみ、gain 0、source 0、timestamp停止はfalse positiveとして拒否する。

### One-gesture recovery

trusted gestureは自動resume処理中でも、そのイベントハンドラ内で`context.resume()`を
直ちに呼び出す。復旧経路は次の順でboundedに実行する。

- Route A: resume＋scheduler re-anchor
- Route B: silent priming sourceを1回
- Route C: decoded 6 bufferを再利用したgraph/context再構築をcycleあたり最大1回

Route C失敗時は旧context／gain／bus／generationをatomicに復元する。buffer再読込、
OFF／ON自動切替、catch-up burst、独立timerを使わない。

## 検証

- Node決定論的試験：running false positive、gain 0、timestamp停止、Route C上限、
  atomic rollback、古いasync cycle、重複lifecycle、明示失敗、trusted gesture競合
- actual Web Audio：Desktop 1280×720、Mobile 390×844
- 自動resume、running false positive、スピーカー1回操作、source progression
- 6buffer完全性、duplicate 0、backlog 0、禁止干渉0
- UIはliveness確認前にONへ戻らない
- application console error／warning 0
- 10秒idle性能とmodel transform invariant
- R2 foreground timebaseを開始Headとbyte-identical確認

性能測定はin-app Browser環境依存として値を保存し、A.6絶対合格は主張しない。
閾値変更は行っていない。

## 変更しない範囲

- R2 foreground timebase、R2.1 timeline discontinuity reset
- `trainTimeSec`、`watchTimeSec`、power reserve、rate、escapement、balance
- Geometry、lighting、transparency、camera、iOS multi-touch
- audio sample、master gain 0.36、各bus gain
- UI基盤、APP_VERSION v3.15.0、試験閾値

## 物理iPhone再試験

次を各3サイクル確認する。

- 画面スリープ復帰
- ホーム復帰
- 別アプリ往復

期待結果は自動復旧、またはスピーカーボタン1回での復旧である。2回目のタップや
OFF／ONサイクルを要求してはならず、緑色ONのまま無音も不可とする。加えて
free-running 1分、live-sync 1分、時刻合わせ復旧をsanity確認する。

証跡は`docs/evidence/final-stabilization-phase3b4c-r2-2-output-liveness/`に保存する。
