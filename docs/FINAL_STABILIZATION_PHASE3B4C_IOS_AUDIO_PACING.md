# Final Stabilization Phase 3B.4c-R1 — iOS free-running audio dropout

## 結論

Phase 3B.4c候補は物理iPhoneで不合格となった。free-runningでは約15秒以内に
テンプ音が消失し、sound OFF／ONで一時復旧しても再び停止した。一方、
live-syncでは約51秒間、約0.2秒cadenceが継続した。

正式な人間確認状態は次のとおりである。

```text
PHASE3B4C_PHYSICAL_IPHONE_REVIEW_FAILED
HUMAN_REJECT_PHASE3B4C_STABILITY_CANDIDATE_AS_INCOMPLETE
IOS_INITIAL_FREE_RUNNING_ESCAPEMENT_AUDIO_DROPOUT_REPRODUCED
IOS_LIVE_SYNC_AUDIO_CONTINUITY_SHORT_RUN_PASS
AUDIO_TOGGLE_TEMPORARILY_RECOVERS_THEN_DROPS_OUT_AGAIN
PHASE3B4C_REOPENED_FOR_IOS_SCHEDULER_STARVATION_DIAGNOSIS
```

R1では同じ差を決定論的に再現し、機構beatを正本とするquery限定候補のまま
audio schedulerを修正した。15分相当の全仮想試験と実Web Audioブラウザ試験には
合格したが、修正版の物理iPhone 15分確認は未実施である。したがって現在の判断は
`PHASE3B4C_R1_TECHNICAL_FIX_PENDING_PHYSICAL_IPHONE_REVIEW` であり、
Human Accepted、既定採用、Ready化、マージのいずれでもない。

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

`audioTiming`がない通常経路、不完全query、値が不正な経路は既存音響処理を維持する。
APP_VERSIONはv3.15.0のままである。

## 人間報告

free-running動画は約21.1秒で、約1.36〜10.37秒の間に約46打、
発音間隔中央値約0.1996秒、その後約5.7秒の完全無音を示した。sound OFF／ON後は
約1.2秒だけ再発音し、再度停止した。

live-sync動画は約54.6秒で、約3.61〜54.42秒の間に約255打、
発音間隔中央値約0.1996秒、0.3秒を超える異常無音なしで終了まで継続した。

動画ファイルはCodexのローカル作業ツリーには存在しない。この記録はHuman報告と
ChatGPT側解析値であり、Codexが物理動画を確認・解析したという意味ではない。

## 決定論的再現と原因

再現試験では、AudioContext clockをraw wall elapsedで進め、free-running側だけ
simulation deltaを50msへ制限した。10秒後から16.7／16.7／100／16.7／150msの
rAF列を繰り返すと、修正前は次の状態になった。

| 状態 | 60秒中のaudible event | 最終発音 | 末尾無音 | late drop |
|---|---:|---:|---:|---:|
| free-running | 56 | 11.222秒 | 48.778秒 | 122 |
| live-sync | 303 | 60.600秒 | 0秒 | 0 |

確定原因は、free-runningのcapped simulation clockとAudioContext wall clockが乖離し、
epoch drift後も古い連続absolute gridを維持したため、近傍beatが永続的にlate扱いとなり
audible event供給が停止したことである。live-syncはraw elapsedで機構参照を補正するため、
同じ乖離を蓄積しなかった。

恒常的な音源・スピーカー故障、AudioContext clock stall、tick／tock parity不良、
source ended欠落だけ、pending上限値だけを直接原因とする仮説は棄却した。

## 修正

- AudioContextの現在時刻から最大3beat（0.600秒＋epsilon）だけを予約する
- 許容horizon外のescapement sourceだけを破棄する
- 古い連続gridではなく、現在時刻近傍へ1〜3beatをbounded rolling projectionする
- `audioEngine.play()`成功後にだけtarget beat、start time、event sequenceを確定する
- active／sound ON／visible／AudioContext runningで3beat無音をstarvationと記録する
- watchdogはrAF上の監視だけとし、独立timerや独立oscillatorを使わない
- buffer durationとAudioContext時刻から終了済みsource recordを整理する
- 実発音判定を全履歴走査から単調カーソルへ変更し、経過時間依存の負荷を除く

再アンカー直後も直前の実発音から0.2秒のcadence下限を守り、過去beatの
catch-up burstや短間隔二重発音を行わない。

## Scheduler contract

```text
requestedStartTime - AudioContext.currentTime
<= derivedMaximumLookaheadSeconds + epsilon
```

5Hz時の導出値はminimum lead 0.018秒、maximum look-ahead 0.600秒、
late tolerance 0.050秒、pending上限4件である。

- beat identityとrateは機構の`studyBeat`／`escapementBeatRate`を正本とする
- even target beatはtick、odd target beatはtockとする
- booking失敗を成功beatとして消費しない
- 3beat以上の連続欠落を許容しない
- starvation復旧時もcatch-upしない
- cancel対象はtick／tockだけで、巻上げ・空転・pull／pushを止めない
- stale source recordを無期限保持しない

## 15分相当試験

free-runningとlive-syncの双方について、16.7ms、33.3ms、50ms、
80〜150ms断続、単発500ms、単発1秒、反復500ms、foreground劣化、
iOS不規則rAFの9パターンを各15分相当実行した。

- 18/18 run合格
- 末尾無音0
- 意図しない無音0.602秒以下
- 連続3beat欠落0
- duplicate 0
- backlog burst 0
- pending上限超過0
- 終了後inventory 0
- tick／tock parity維持

sound OFF／ON、pause／resume、stop seconds／release、hidden／visible、
AudioContext suspend／running、current-time再設定後も、catch-upなしで
許容horizon内へ復帰した。

## 実ブラウザ

GPU対応in-app Browserのsame-origin iframe harnessで実Web Audioを開始した。

| 条件 | audible | 最大間隔 | 連続欠落 | starvation | duplicate / backlog |
|---|---:|---:|---:|---:|---:|
| desktop 30秒 | 151 | 0.200秒 | 0 | 0 | 0 / 0 |
| 390×844 30秒 | 150 | 0.206秒 | 1 | 0 | 0 / 0 |
| lifecycle 20秒 | 98 | 0.313秒 | 1 | 0 | 0 / 0 |
| current-time 65秒 | 326 | 0.200秒 | 0 | 0 | 0 / 0 |

UIはdesktop 20/20・mobile 22/22、HUDは45/45・57/57、trusted audioは
23/23・23/23、位置1／位置2禁止干渉は0/0だった。
Node全件は317/317で合格した。さらにR1のfree-running escapementを
実Web Audio＋Three.js canvasのWebMとして10.5秒収録し、EBML signature、
録画完了、Audio ONを確認した。これは物理iPhone試験の代替ではない。

comprehensiveはdesktop 81/86、mobile 83/88。A.5照明3件とA.6 pointer／wheel
2件は同一環境の候補なし保護経路でも同じIDで失敗し、R1固有失敗は0件だった。
Browser instrumentation由来のMutationObserver警告を除くapplication consoleは
error 0／warning 0である。

## 性能

10秒audio-on idleを候補／保護経路で各3回測定し、中央値で比較した。

| viewport | 経路 | average FPS | p50 | p95 |
|---|---|---:|---:|---:|
| desktop | protected | 20.952 | 50.0ms | 50.8ms |
| desktop | R1 | 20.944 | 50.0ms | 51.0ms |
| 390×844 | protected | 43.712 | 16.8ms | 33.9ms |
| 390×844 | R1 | 42.674 | 17.1ms | 34.2ms |

desktopはFPS -0.04%／p95 +0.2ms、mobileはFPS -2.37%／p95 +0.3msであり、
既存差分ゲート（FPS悪化5%以内、p95悪化2ms以内）に合格した。A.6絶対性能未達は
候補なし側と共通で、閾値は変更していない。

## 未変更

Geometry、機構、歯車比、脱進機、テンプ振幅、歩度、ビートエラー、
パワーリザーブ、global animate dt、trainTimeSec、watchTimeSec、live-sync仕様、
D2c3照明、PMREM、fog、shadow、透過、camera、mobile maxDistance、
iOS multi-touch、UI、音声sample、master/bus gain、sound初期OFF、APP_VERSION、
試験閾値を変更していない。

Issue #2はOpen、PR #5はOpen／Draft、D2c3・framing・multi-touch・R1候補は
既定未採用を維持する。Phase 3B.4dは開始していない。

## 次の人間確認

固定commitで物理iPhoneを用い、free-running 15分、live-sync 15分、
current-time一回設定、pause／resume、秒停止／解除、sound OFF／ON、
hidden／visible、位置1／2、巻上げ、逆転空転を確認する。

各遷移後1beat以内に約0.2秒cadenceへ戻り、完全消失、連続3beat欠落、
duplicate、backlog burstがないことを確認する。合格するまでPR #26はDraftとする。
