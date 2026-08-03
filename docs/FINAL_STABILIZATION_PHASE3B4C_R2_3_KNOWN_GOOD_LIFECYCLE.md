# Final Stabilization Phase 3B.4c-R2.3

## 判定

```text
PHASE3B4C_R2_3_ROOT_CAUSE_ISOLATED
PHASE3B4C_R2_3_KNOWN_GOOD_LIFECYCLE_RESTORED
PHASE3B4C_R2_3_WEBKIT_AND_STRESS_GATE_PASSED
PHASE3B4C_R2_3_INDEPENDENT_REVIEW_PASSED
PHASE3B4C_R2_3_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW
```

R2.2は自動output-livenessゲートに合格した一方、物理iPhoneの画面スリープ復帰と
ホーム復帰で実音を回復できず、スピーカーボタンや画面の反復タップでも復旧しなかった。
R2.3ではR2.2へ処理を追加せず、物理iPhone受入済みv3.14.0のvisibility-owned
lifecycleを原器として復元し、現在schedulerとの最小接続だけを残した。

この判定は非実機技術ゲートと独立差分レビューの合格である。物理iPhone再試験は
ChatGPT再確認まで凍結し、本資料は物理発音の合格、Ready化、マージ、既定採用、
Issue #2クローズ、Phase 3B.4d開始を承認しない。

## 原因

R2.2は、既知合格の単一所有lifecycleを次の多段復旧機構へ置き換えていた。

- foreground recovery cycle／history
- pipeline liveness検証とoutput timestamp必須判定
- silent priming Route B
- AudioContext／graph再構築Route C
- visibility、pageshow、focusからの複数音響所有
- recovery verification timeoutとrecovery-failed UI

これらはsynthetic source progressionを確認できても、物理iPhoneの出力復旧を証明できなかった。
R2.3の二分比較ではL0を履歴比較だけとし、状態機械撤去、visibility単一所有、scheduler
再アンカー、bounded fallbackを段階化した。最終候補L4だけが、現在schedulerに必要な差分を
含みながら、Context再構築を行わない最小候補として残った。

## 実装

### visibility単一所有

`visibilitychange`だけがAudioContext、gain、source、schedulerを変更する。
`pagehide`、`pageshow`、`blur`、`focus`は診断とtimebase bookkeepingだけを行う。

hidden遷移では次を各1回実行する。

1. scheduler pending source cancelを伴うregular re-anchor
2. legacy audio event reset
3. `mechanicalAudio.setVisible(false)`によるgain 0、source停止、Context suspend

visible遷移では次を各1回実行する。

1. `mechanicalAudio.setVisible(true)`
2. Contextがrunningへ復帰したことを確認
3. scheduler regular re-anchor
4. legacy audio event reset

古い非同期visible完了は、より新しいhidden遷移後にgainを戻したりschedulerを再アンカー
したりできない。Context generationは1のまま、6bufferを再読込みしない。

### bounded fallback

自動resumeが失敗した場合だけ、既存スピーカーボタンのtrusted handler内で1回の明示復旧を
許可する。同じContextと既存bufferを再利用し、Context再構築、論理OFF／ON、silent priming、
無限retry、catch-up burstを行わない。失敗時はresume-required表示を保ち、Contextがrunningに
なる前にON表示またはmaster gain 0.36へ戻さない。

### 診断

`audioLifecycleTrace=1`だけで簡潔なlifecycle状態と「診断をコピー」を表示する。通常pathでは
DOMと記録を追加しない。個人情報、token、端末固有識別情報は含めない。

## 検証

### lifecycle stress

- Chromium actual Web Audio: 1280×720／390×844、それぞれ100 hidden-visible cycle合格
- Playwright WebKit 26.5 actual Web Audio: 同じ2 viewportで各100 cycle合格
- resume: visible transitionごとに1回、各結果100回
- lifecycle re-anchor: hidden 1回＋successful visible 1回、各結果200回
- pagehide／pageshow／blur／focusによるaudio mutation: 0
- Context generation: 開始1、終了1
- 6buffer完全、duplicate 0、backlog burst 0、pending上限内
- application console error／warning: 0／0

SafariDriverはSafari設定のremote automationが無効でsessionを作成できず、Codexは設定を
変更していない。Xcode full installationと`simctl`も利用できなかった。WebKit試験を物理iPhone
またはiOS Simulatorの代替とは扱わない。

### browser回帰

同一in-app BrowserでR2.2開始HeadとR2.3を比較した。

- Desktop総合: 81／86、両Head共通5失敗、R2.3固有0
- Mobile 390×844総合: 83／88、両Head共通5失敗、R2.3固有0
- Desktop UI: 17／20、両Head共通3失敗、R2.3固有0
- Mobile UI: 22／22
- Mobile HUD: 57／57
- Mobile audio: 23／23

共通失敗はA.5照明契約3件とA.6 pointer／wheel 2件、およびDesktop UIのin-app Browser
keyboard/layout 3件である。絶対合格へ読み替えず、R2.3差分回帰0として分離記録した。

### performance

同一環境で`baseline → candidate → candidate → baseline → baseline → candidate`の順に、
Desktop／390×844のpointer／wheelを各3回測定した。全4条件で平均FPS悪化5%以内、p95悪化
2ms以内、reversal 0、stop-then-jump 0、wheel monotonic、transform invariantを満たした。
A.6絶対失敗は環境制約として保持し、閾値は変更していない。

### protected paths

R2.2開始Headから次をbyte-identicalで維持した。

- `js/final-stabilization-phase3b4c-audio.js`
- `js/final-stabilization-phase3b4c-r2-timebase.js`
- `js/issue2-final-polish-phase3b4b-input.js`
- `js/dial-display-config.js`

通常pathとPhase 3C.1-only pathは同一Browser captureでbyte／SHA exactである。Geometry、
rendering、lighting、transparency、camera、multi-touch、audio samples、fixed gain、
APP_VERSION v3.15.0、試験閾値を変更していない。

## 独立レビュー

実装コミット後に`48ec7b7..ebf69a2`を前提リセットして読取レビューした。v3.14 lifecycle差分、
visibility ownership、Context lifetime、trusted gesture境界、非同期race、scheduler再アンカー、
source／buffer所有、不要状態機械、protected path、試験の独立性を確認し、critical／major／minor
指摘はいずれも0件だった。

## 証跡

証跡は`docs/evidence/final-stabilization-phase3b4c-r2-3-known-good-lifecycle/`に保存した。
closed-world manifestは自身を除外し、missing／unexpected／SHA mismatchを0件とする。

## 維持事項

- R2 foreground authoritative timebaseとR2.1 timeline discontinuity reset
- free-running／live-sync cadence、hidden elapsed非復元
- 時刻設定、位置1／位置2、winding／reverse／crown pull／push
- A.7、S86、Phase 2C、三針拘束、禁止干渉
- sound初期OFF、音源6件、master gain 0.36と各bus gain
- PR #26 Open／Draft、Issue #2 Open、PR #5 Open／Draft、D2c3未採用

最終候補はChatGPT再確認用の単一候補であり、Human確認のURLや手順は本資料へ含めない。
