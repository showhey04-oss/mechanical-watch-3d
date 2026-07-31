# Final Stabilization Phase 3B.4c-R1.1 — mechanism/audio phase contract

## 結論

R1はfree-runningの音声消失を止めた一方、15分のiOS不規則frame試験を
機構約2,276 beat、音響4,501 beatのまま合格させていた。R1開始時の正式状態は
次のとおりである。

```text
PHASE3B4C_R1_AUDIO_CONTINUITY_GATE_PASSED
PHASE3B4C_R1_MECHANISM_AUDIO_PHASE_DIVERGENCE_DETECTED
PHASE3B4C_R1_TECHNICAL_ACCEPTANCE_BLOCKED
PHYSICAL_IPHONE_RETEST_DEFERRED_PENDING_MECHANISM_SYNC_CLOSURE
```

R1.1はglobal timebaseを変更せず、scheduler内のOption Aだけで
`studyBeat`をbeat identityと発音位相の正本に戻した。9 frame pattern ×
free-running／live-syncの18本、実Web Audioのdesktop／390×844、
性能差分、Node 318/318で機構同期契約に合格した。

現在の自動判定は
`PHASE3B4C_R1_1_AUTOMATED_MECHANISM_SYNC_CLOSURE_PASSED` である。
これはTechnical Finalist、Human Accepted、既定採用、Ready化、マージを意味しない。
物理iPhone再試験は本作業では実施せず、別途Human承認を要する。

## 対象query

```text
?exterior=balanced
&watchHead=phase3c1
&strapStyle=phase3c2
&integration=phase3c3
&rendering=issue2-d2c3
&continuity=issue2-current
&framing=issue2-mobile-full-length-fit
&input=issue2-ios-multitouch-stability
&audioTiming=phase3b4c-stability
```

queryなし、不完全query、不正値は既存経路を維持する。APP_VERSIONはv3.15.0である。

## R1で見逃した位相発散

R1試験は音声イベントの間隔、欠落、duplicate、backlogだけを確認し、
`mechanismAuthoritative: true`を数値的不変条件として検証していなかった。
iOS不規則frame／free-runningの900秒では次の状態だった。

| 値 | R1 |
|---|---:|
| wall time | 900秒 |
| final simulation time | 約455.1832秒 |
| final `studyBeat` | 約2,275.916 |
| mechanism integer crossing | 2,275 |
| audible event | 4,501 |
| count divergence | +2,226 |

原因は、音響側が`lastTargetBeat + 1`をAudioContext clockだけで継続し、
50msに制限されたfree-running機構より先へbeat identityを進めたことである。
R1の連続性試験はこの状態でも0.2秒cadenceが続くためPASSになっていた。

## R1.1 scheduler

Option Aとして、次だけを変更した。

- free-runningは現在の`studyBeat`から導出した次の整数beatだけを対象とする
- free-running予約は`targetBeat - studyBeat <= 0.25`のcrossing window内だけ行う
- live-syncの最大3beat先予約も、各frameの`studyBeat`から導出する
- audio clockだけによる無制限な`lastTargetBeat + 1`を廃止する
- 機構が遅れる場合は音響も機構を待ち、過去beatのcatch-up burstを行わない
- starvationはwall秒数ではなく、未発音の機構beat数で評価する
- tick／tock parity、booking成功後state commit、pending上限4を維持する
- 発音時の機構beatは、free-runningでは隣接する正本機構frame間を補間する
- live-syncではwall-clock機構projectionを発音時正本値として使用する

global `animate()`、`trainTimeSec`、`watchTimeSec`、power reserve、rate、
escapement、balance、beat errorは変更していない。B（機構timebaseをwall clock化）と
C（描画deltaと機構deltaを分離）は実装していない。

## 機構同期contract

予約時:

```text
0 < targetBeat - studyBeat <= maximumProjectionBeats
```

発音時:

```text
abs(audibleTargetBeat - authoritativeMechanismBeatAtAudioTime)
<= 0.25 beat
```

0.25 beatは試験通過用の拡大値ではない。free-runningの機構進行は
最大50ms／frameで、5Hz × 0.050秒 = 0.25 beatという1正本simulation stepから
導出した。

15分終了時:

```text
audible at duration + pending look-ahead - mechanism integer crossings
```

の絶対値をpending上限4以内とし、時間とともに累積増加しないことを確認する。

全scheduled／audible eventへ、予約時`studyBeat`、`targetBeat`、差分、
requested start、同時刻の予測機構beat、発音観測時`studyBeat`、
発音時正本beat、位相誤差、観測源を記録する。reportは最大正／負誤差、
累積観測誤差、最終crossing／audible／pending／count divergenceも保持する。

## 15分相当の決定論的試験

16.7ms、33.3ms、50ms、80〜150ms断続、単発500ms、単発1秒、
反復500ms、foreground劣化、iOS不規則frameをfree-running／live-syncで
各15分実行した。

- 18/18合格
- free-running／live-sync音声消失0
- duplicate 0
- backlog burst 0
- 3beat連続欠落0
- pending上限超過0
- source inventory leak 0
- mechanism/audio phase contract 18/18合格
- count divergenceは全runでpending上限内
- tick／tock parity維持

free-runningのwall cadenceは機構が遅れるframe patternでは一定0.2秒にならない。
これはOption Aが音響連続性より正本機構同期を優先するためで、欠落判定は
target beat identityで行う。live-syncは従来の0.2秒cadence gateも維持する。

## 実ブラウザ

GPU対応in-app Browserのsame-origin iframe harnessで、スピーカー操作後に
実Web Audioを10秒ずつ測定した。

| viewport | audible | target lead最大 | 位相誤差最大正 | 位相誤差最大負 | duplicate / backlog / 干渉 |
|---|---:|---:|---:|---:|---:|
| 1280×720 | 50/50 | 0.2487 beat | +0.0606 | -0.0895 | 0 / 0 / 0 |
| 390×844 | 50/50 | 0.2067 beat | +0.0607 | -0.0493 | 0 / 0 / 0 |

両viewportで`mechanismAuthoritative`とphase contractはtrueだった。
Browser instrumentation由来のMutationObserver例外はアプリ外として分離し、
application consoleはerror 0／warning 0である。

## 性能

ウォームアップ後に候補／保護経路を交互に各3回、audio-on idle 10秒で測定した。

| viewport | 経路 | average FPS中央値 | p50 | p95 |
|---|---|---:|---:|---:|
| 1280×720 | protected | 26.937 | 33.4ms | 50.1ms |
| 1280×720 | R1.1 | 26.866 | 33.4ms | 50.4ms |
| 390×844 | protected | 36.048 | 33.1ms | 34.3ms |
| 390×844 | R1.1 | 35.923 | 33.2ms | 34.2ms |

desktopはFPS -0.27%／p95 +0.30ms、mobileはFPS -0.35%／p95 -0.10msで、
既存差分ゲート（FPS悪化5%以内、p95悪化2ms以内）に合格した。
reversal 0、stop-then-jump 0、zoom monotonic、transform invariant trueである。
閾値は変更していない。

## 回帰と未変更範囲

- Node 318/318
- A.7 9/9
- 位置1／位置2禁止干渉0/0
- protected path exact
- S86、Phase 2C、三針拘束は不変
- Geometry、lighting、transparency、camera、iOS multi-touch、UIは不変
- 音源、gain、sound初期OFF、APP_VERSIONは不変
- Issue #2はOpen、PR #5はOpen／Draft、D2c3は未採用
- Phase 3B.4dは未開始

## 次のHuman gate

物理iPhoneでfree-running 15分、live-sync 15分、current-time一回設定、
pause／resume、秒停止／解除、sound OFF／ON、hidden／visible、位置1／2、
巻上げ、逆転空転を確認する。今回の作業はその再試験を承認・実施しない。
PR #26はOpen／Draftのまま維持する。
