# Final Stabilization Phase 3B.4c-R2.4 — WebKit platform recovery

## 結論

Phase 3B.4c-R2.4は、R2.3のlifecycle ownerを維持しながら、WebKitで起こり得る`running`偽陽性、`resume()`のhang／reject、`interrupted`、出力停止を明示分類し、既存スピーカーボタンの1回のtrusted gestureだけで完結する限定回復経路を実装した。

正式状態は次のとおり。

- `PHASE3B4C_R2_4_RESUME_HANG_PATH_CLOSED`
- `PHASE3B4C_R2_4_RUNNING_STALLED_PATH_CLOSED`
- `PHASE3B4C_R2_4_INTERRUPTED_PATH_CLOSED`
- `PHASE3B4C_R2_4_SINGLE_GESTURE_FRESH_CONTEXT_PATH_CLOSED`
- `PHASE3B4C_R2_4_INDEPENDENT_REVIEW_PASSED`
- `PHASE3B4C_R2_4_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW`

P3はquery限定の単一候補であり、既定採用、Human受入、Ready化、マージ、Issue #2クローズ、Phase 3B.4d開始を意味しない。物理iPhone再試験は`FROZEN`のままで、本工程では確認URLや手順を作成しない。

## 原因

`AudioContext.state === "running"`だけでは、WebKit上の実出力と`currentTime`進行を保証できない。また、`resume()`が解決しない、rejectする、解決後も`suspended`のまま、または`interrupted`となる経路をR2.3の可視状態復帰だけでは閉じられなかった。

R2.3の単一`visibilitychange` ownerは正しいため、owner追加や毎frame監視ではなく、既存ownerから呼ぶbounded platform recoveryへ限定した。

## 候補比較

| 候補 | 変更 | 判定 |
| --- | --- | --- |
| P0 | R2.3のvisibility suspend／resume | baseline保持 |
| P1 | feature detectionできる場合だけAudioSessionを`playback`へ設定し、hiddenではgain 0・source停止、voluntary suspendなし | 診断候補 |
| P2 | P1＋`running`時の`currentTime`停止に対する1回のbounded suspend／resume | 診断候補 |
| P3 | P2＋明示的にrecovery-requiredとなった後、既存スピーカーボタンの1回のtrusted gestureでfresh Contextを1回だけ構築 | ChatGPT review用の単一候補 |

P0～P3はいずれもR2 query内だけで有効で、通常pathへ影響しない。

## 実装

- `resume()`を450ms、最大2,000msの明示上限で評価する。
- 80msの`currentTime` probeで`RUNNING_AND_ADVANCING`と`RUNNING_BUT_CURRENT_TIME_STALLED`を区別する。
- `SUSPENDED`、`INTERRUPTED`、`RESUME_REJECTED`、`RESUME_PROMISE_TIMEOUT`、`CONTEXT_UNUSABLE`を別状態として記録する。
- staleな非同期完了はgeneration／transition tokenで拒否し、gainを復元できない。
- fresh Contextでは保持済みraw asset 6件をすべて再decodeし、完全な6 bufferとgraphができてからatomic swapする。
- Context生成、decode、stale completionの失敗時は旧graphをmutedのまま保持する。旧Contextの`close()`失敗はcommit済み新graphを巻き戻さない。
- catch-up burst、過去beat一括再生、毎frame retry、logical OFF→ONの強制、test threshold変更を行わない。

## 実ブラウザ検証

Chromium in-app BrowserとPlaywright WebKit 26.5の実Web Audioで、P0～P3×2 viewportを各100 hidden／visible cycle実行し、8/8条件ずつ合格した。P3について`running-stalled`、`resume-hang`、`resume-rejected`、`resume-resolves-suspended`、`interrupted`を各viewportで実行し、10/10条件ずつ合格した。

全条件で6 buffer完全性、raw asset 6件、duplicate 0、backlog burst 0、application console error／warning 0を確認した。native Safariは現在の自動化環境で`safaridriver` sessionを開始できず、`NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT`とした。CodexはSafari設定を変更せず、代替実行をnative Safari合格とは扱わない。

## 回帰と性能

Nodeは411/411。Desktop／Mobileのaudio integrationは各23/23。R2.4固有のbrowser failureは0だった。Desktop総合81/86、Mobile総合83/88、Desktop UI 17/20の未達は作業開始Headにも同じIDで存在し、`PASSED_WITH_COMMON_BASELINE_ENVIRONMENT_FAILURES`として明示保持する。全回帰completeや絶対PASSとは記載しない。

pointer／wheelの4差分条件は、平均FPS悪化5%以内、p95悪化2ms以内、reversal 0、stop-then-jump 0、wheel monotonic、transform invariantを変更なしの閾値で満たした。最初のMobile pointer計測は同時software-WebGL負荷の影響でp95が3ms悪化したため、不変条件のまま単独再実行しp95差0msを確認した。初回値も証跡へ残す。A.6絶対性能合格は主張しない。

## 保護範囲

通常pathとPhase 3C.1-only pathは作業開始Headとのactual WebGL PNG byte／SHA exactを確認した。mechanism timebase、input、S86、Phase 2C、A.7、Geometry、Light、Material、opacity、camera、DPR、UI、sample、gain、APP_VERSION、試験閾値を変更していない。

証跡は[Phase 3B.4c-R2.4 evidence](evidence/final-stabilization-phase3b4c-r2-4-webkit-platform-recovery/README.md)に保存する。
