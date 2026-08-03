# Final Stabilization Phase 3B.4c-R2 — foreground mechanism timebase stability

## 結論

R1.1の物理iPhone free-running再試験は不合格だった。作動音ON後約15秒から
テンプ音、テンプ、脱進機が同時に遅くなったため、音響scheduler単独ではなく、
50msに制限された描画deltaがforeground機構時間の正本にも使われていたことを
主原因と判定した。

R2は完全時計queryとR1.1 audio queryが揃った場合だけ、visible foregroundの
monotonic raw elapsedを時計、輪列、脱進機、パワーリザーブの正本へ渡す。
描画、camera、入力、crown transitionなどの数値積分には従来の50ms capを
維持する。hidden、pagehide、pageshow、bfcache相当のintervalはre-anchorし、
復元しない。

現在の状態は次のとおりである。

```text
PHASE3B4C_R1_1_PHYSICAL_IPHONE_FREE_RUNNING_RETEST_FAILED
R1_1_MECHANISM_AUDIO_SYNCHRONIZATION_CONFIRMED_DURING_SLOWDOWN
FOREGROUND_FREE_RUNNING_MECHANISM_TIMEBASE_SLOWDOWN_REPRODUCED
AUDIO_SCHEDULER_NOT_PRIMARY_CAUSE
PHASE3B4C_R1_1_NOT_ACCEPTED
PHASE3B4C_R2_AUTOMATED_FOREGROUND_TIMEBASE_GATE_PASSED_PHYSICAL_IPHONE_RETEST_PENDING
```

R2はTechnical Finalist、Human Accepted、既定採用ではない。物理iPhone R2再試験、
Ready化、マージ、Phase 3B.4d開始は行っていない。

## Human物理iPhone結果の扱い

R1.1のHuman報告は、free-runningで完全な音声消失はないが、約15秒後から
音響cadence、テンプ、脱進機が同時に低下したというものである。
ChatGPT側の動画解析値として、小秒の相対進行は7–15秒で約0.96倍、
20–25秒で約0.88倍、25–30秒で約0.66倍と報告された。

動画ファイルはCodexのローカル作業ツリーに存在しない。この数値はHuman報告と
ChatGPT側解析として記録し、Codexが動画を直接解析したとは扱わない。

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
&mechanismTiming=phase3b4c-r2-foreground-stability
```

通常path、不完全query、不正値、R1.1-only pathは既存のcapped mechanism deltaを
維持する。APP_VERSIONはv3.15.0である。

## timebase consumer inventory

監査結果は
`reports/timebase-consumer-inventory.json`へ保存した。

- Authoritative mechanism time:
  `watchTimeSec`、`trainTimeSec`、`studyBeat`、輪列角、脱進機beat identity、
  power reserve、履歴、歩度反映
- Visual / numerical integration time:
  テンプ・ヒゲゼンマイ描画、spring Geometry、crown transition、入力、
  UI、camera smoothing、adaptive quality、selection表示
- Lifecycle / suspended time:
  hidden、pagehide、pageshow、visibility復帰、bfcache相当の停止interval

global `dt`は置換していない。authoritative consumerだけが
`authoritativeMechanismDeltaSeconds`を受け、visual consumerは
`renderIntegrationDeltaSeconds = min(raw elapsed, 50ms)`を受ける。

## 実装

`ForegroundMechanismTimebase`は次を分離して計測する。

```text
foregroundMechanismElapsed
= visible foreground monotonic raw elapsed

renderIntegrationDelta
= min(raw frame elapsed, 50ms)
```

- `watchTimeSec`、`trainTimeSec`、power reserve、historyはauthoritative deltaを使用
- 脱進機と小秒はauthoritative `trainTimeSec`／`studyBeat`を共有
- R2 query時のテンプ視覚位相も同じ`studyBeat`から導出
- R1.1 schedulerは`studyBeat`をbeat identityの正本として維持
- foreground long frameでは機構beatに追従した最大4beatの既存pending枠を使い、
  duplicate、catch-up burst、3beat連続欠落を防ぐ
- hidden/page lifecycleの経過は加算せずre-anchor
- paused、crown position 2、power reserve 0では機構進行を加算しない

Geometry、lighting、transparency、camera、iOS multi-touch、UI、音源、gain、
APP_VERSION、試験閾値は変更していない。

## 15分決定論的matrix

9 frame pattern × free-running／live-syncの18本を各900秒実行した。

- 18/18でwall elapsed 900秒
- authoritative mechanism elapsed 900秒
- watch／train progression 900秒
- power reserve消費0.25時間
- cumulative elapsed divergence 0
- duplicate 0
- backlog burst 0
- 3beat連続欠落0
- pending上限4以内
- 発音位相誤差±0.25 beat以内

iOS irregular free-runningは旧capped経路で約455秒までしか進まない条件に対し、
R2では900秒進んだ。小秒、テンプ、脱進機は同じauthoritative train timeに
追従する。

## lifecycle

visible foregroundの500ms／1000ms frameはauthoritative機構時間へ加算する。
hidden、pagehide／pageshow相当のintervalは加算せず、復帰時にre-anchorする。
Phase 3B.4dのsuspended-time restorationは実装していない。

## 実ブラウザ

GPU対応in-app BrowserとHTTP localhostでDesktop 1280×720、Mobile 390×844を
実行した。

| viewport | authoritative elapsed | divergence | audible | duplicate / backlog / missing | phase error |
|---|---:|---:|---:|---:|---:|
| 1280×720 | 約15.001秒 | 0 | 75 | 0 / 0 / 0 | +0.068 / -0.078 beat |
| 390×844 | 約14.974秒 | 0 | 75 | 0 / 0 / 0 | +0.055 / -0.076 beat |

actual Web Audio、UI 22/22、HUD 57/57、trusted audio 23/23に合格した。
application consoleはerror 0／warning 0である。

総合回帰はDesktopで候補／保護pathとも81/86、Mobileで候補／保護pathとも
84/88だった。共通未達はD2c3の既知A.5照明契約と、実行環境依存のA.6絶対性能で
あり、R2固有の機能回帰は検出されなかった。

## 性能差分

同じin-app Browserで保護pathとR2を比較した。

| viewport / scenario | FPS差 | p95差 | 判定 |
|---|---:|---:|---|
| Desktop pointer | -1.49% | +0.0ms | pass |
| Desktop wheel | +0.50% | +0.1ms | pass |
| Mobile pointer | -1.44% | +0.1ms | pass |
| Mobile wheel | -1.76% | +0.3ms | pass |

既存差分条件（FPS悪化5%以内、p95悪化2ms以内）を変更せず全4条件で合格した。
reversal 0、stop-then-jump 0、wheel zoom monotonic、transform invariant trueである。

## protected paths

paused、同一camera、同一時刻、同一themeで保護pathとR2を比較した。

- Desktop 1280×720: byte／SHA exact
- Mobile 390×844: byte／SHA exact
- queryなし、不完全query、不正query: R2 disabled
- R1.1-only: existing capped mechanism deltaを維持

## 回帰と判断

- Node全件合格
- R2決定論的matrix 18/18
- A.7 9/9
- 位置1／位置2禁止干渉0/0
- S86、Phase 2C、三針拘束不変
- console error／warning 0/0
- protected path exact
- candidate-specific regression 0
- manifest missing／unexpected／SHA mismatch 0/0/0

自動技術gateは合格したが、物理iPhone R2再試験は未実施である。
Humanの明示承認後にfree-running／live-syncを再試験し、それまでPR #26を
Open／Draft、Issue #2をOpen、候補をquery-onlyのまま維持する。
