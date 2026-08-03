# Final Stabilization Phase 3B.4c-R2.4.1 — bounded atomic recovery

## 結論

- `PHASE3B4C_R2_4_1_DECODE_HANG_PATH_CLOSED`
- `PHASE3B4C_R2_4_1_CONTEXT_CLOSE_HANG_PATH_CLOSED`
- `PHASE3B4C_R2_4_1_PRECOMMIT_LIVENESS_GATE_PASSED`
- `PHASE3B4C_R2_4_1_ATOMIC_TRANSACTION_GATE_PASSED`
- `PHASE3B4C_R2_4_1_INDEPENDENT_REVIEW_PASSED`
- `PHASE3B4C_R2_4_1_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW`

P3のfresh Context fallbackを、候補生成から旧Context cleanupまで一つのbounded transactionとして閉じた。物理iPhone再試験は凍結を維持し、Native SafariをPlaywright WebKitで代替したとは扱わない。

## 原因

R2.4ではresume待ちはboundedだった一方、`decodeAudioData()`と`close()`がnever-settling Promiseになった場合の終端がなく、候補の時間進行確認より前にactive graphを置き換え得た。さらにpostcommit中のstale化、scheduler false、legacy reset例外を一つのtransaction失敗として扱う契約が不足していた。

## R2.4.2による証跡profile分類の訂正

この節はR2.4.1のtransaction実装を変更しない追補である。下記300／50／1,500 msは、hang／timeout faultを短時間で反復するためにbrowser harnessが上書きした`TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE`であり、production URLの無変更既定値ではない。通常アプリの既定値はresume 450、clock probe 80、decode 1,200、close 250、transaction 5,500 msである。production既定値のactual Web Audio検証は[Phase 3B.4c-R2.4.2](./FINAL_STABILIZATION_PHASE3B4C_R2_4_2_PRODUCTION_CONFIGURATION_PARITY.md)を正本とする。

## 実装

- R2.4.1 browser証跡では、6 assetの各decodeを300 ms、transaction全体を1,500 msへ制限するtight diagnostic overrideを使用した。reject、timeout、late completionを区別し、1件でも未完了ならcommitしない。
- 同証跡ではcandidate／old Context closeを50 msへ制限するtight diagnostic overrideを使用した。candidate cleanup失敗は旧graphを保持し、old close失敗はcommit後のnon-blocking cleanupとした。
- candidate graphはresume、6 decode、currentTime進行、stale gateを通過後に一度だけcommitする。
- scheduler re-anchor、legacy reset、gain、UIはcommit後にだけ実行し、postcommitでもvisibility／transaction identityを再確認する。
- transaction ID、visibility sequence、source/candidate generation、deadline、stage履歴、decode数、stale、commit、cleanup、failureを診断へ記録する。

## 検証

- Node: 433/433。R2.4.1 core fault/contract 17/17とevidence 5/5を含む。
- Installed Chrome／Playwright WebKit: 各10条件、各440 cycle、全条件合格。Desktop 1280×720と390×844を含む。
- browser contract: buffer 6/6、raw asset 6/6、duplicate/backlog/catch-up 0、console error/warning/runtime error/unhandled rejection 0。
- independent review: critical 0、major 0、minor 0。
- protected source: mechanism timebase、S86、Phase 2C、multi-touch、機構設定は開始Headとbyte exact。
- performance: R2.4の同一render path差分証跡を継承。今回のabsolute A.6再実行とは主張しない。閾値変更なし。

## 未変更範囲

mechanism timebase、timeline discontinuity reset、Geometry、rendering、lighting、transparency、camera、multi-touch、audio assets、fixed gain、APP_VERSION、hidden elapsed policyは変更していない。

## 制約

`NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT`。Human／物理iPhone確認、Ready化、merge、既定採用、Issue #2 close、Phase 3B.4d開始は未承認。
