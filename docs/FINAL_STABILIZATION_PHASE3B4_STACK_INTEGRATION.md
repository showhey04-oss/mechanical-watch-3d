# Final Stabilization Phase 3B.4 Stack Integration

## 結論

Phase 3B.4a、3B.4b、3B.4cをHead `d16037a75d85d705434d8b73ef5293511052f65e`で統合確認した。起動契約、Desktop基準同等性、Mobile全長構図、Node、Chrome／Playwright WebKit／Native Safari、preset・9部品選択、multi-touch・production audio、12 protected pathは合格した。

性能は既存の隔離実行で製品回帰を再現しなかった。一方、最終clean-process測定はendpoint securityの高CPU負荷により実施できていない。このため結論は`PHASE3B4_STACK_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION`であり、clean環境の絶対性能PASSではない。製品コードや閾値の変更は不要と判断した。本証跡の記録時点ではPR #25をDraftのままChatGPTレビューへ送る状態だったが、後続のpromotion操作でPR #25はmerge commit `d4fa76182d4955e0a78f31120ea2705a19f67220`としてPR #24へ統合済みである。

## 比較点

| 記号 | commit | 意味 |
|---|---|---|
| A | `ece9d99c4e0ff95afd155475ef963e2984c5d05f` | Phase 3B.4a base |
| B | `d6718e59a2438152a4a203fa579b66ce6e91ecd3` | Phase 3B.4b accepted |
| C | `0e260fdfc7495293319682ae7b998858641cdd26` | Phase 3B.4c technical finalist |
| D | `d16037a75d85d705434d8b73ef5293511052f65e` | stack integration Head |

CとDは`index.html`、`js/**`、`assets/audio/**`、`package.json`、`tests/**`のGit objectが一致する。C→Dは物理iPhone受入文書・証跡だけであり、製品・test-runtime差ではない。APP_VERSIONは`v3.15.0`のままである。

## 証跡記録時点の正式状態

```text
PHASE3B4_STACK_INTEGRATION_STARTUP_CONTRACT_CORRECTED
PHASE3B4_STACK_INTEGRATION_DESKTOP_BASE_PARITY_PASSED
PHASE3B4_STACK_INTEGRATION_MOBILE_FULL_LENGTH_GATE_PASSED
PHASE3B4_STACK_INTEGRATION_NODE_GATE_PASSED
PHASE3B4_STACK_INTEGRATION_BROWSER_GATE_PASSED
PHASE3B4_STACK_INTEGRATION_NATIVE_SAFARI_GATE_PASSED
PHASE3B4_STACK_INTEGRATION_PRESET_SELECTION_GATE_PASSED
PHASE3B4_STACK_INTEGRATION_MULTITOUCH_AUDIO_GATE_PASSED
PHASE3B4_STACK_INTEGRATION_PROTECTED_PATH_GATE_PASSED

PHASE3B4_STACK_CLEAN_PERFORMANCE_ENVIRONMENT_BLOCKED_BY_ENDPOINT_SECURITY
PHASE3B4_STACK_PERFORMANCE_MEASUREMENT_CONTRACT_MISMATCH
PHASE3B4_STACK_PERFORMANCE_ENVIRONMENT_CONTAMINATION
PHASE3B4_STACK_PERFORMANCE_FAILURE_NOT_REPRODUCED_UNDER_ISOLATED_RUN
PHASE3B4_STACK_MOBILE_POINTER_PRODUCT_REGRESSION_NOT_REPRODUCED
PHASE3B4_STACK_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION
PHASE3B4_STACK_PRODUCT_FIX_NOT_REQUIRED

PHASE3B4_STACK_INTEGRATION_EVIDENCE_RECORDED
PHASE3B4_STACK_INTEGRATION_READY_FOR_CHATGPT_REVIEW
PR25_REMAINS_DRAFT
```

`CLEAN_ENVIRONMENT_PERFORMANCE_GATE_PASSED`、absolute performance PASS、McAfee停止環境でのPASS、D2c3既定採用、Issue #2完了は主張しない。

## 機能・ブラウザゲート

- Node: 442/442 PASS
- Chrome Desktop／Mobile: PASS
- Playwright WebKit Desktop／Mobile: PASS
- Native Safari Desktop／Mobile: PASS（Safari／SafariDriver 26.5.2、18条件・400 cycle、actual Web Audio）
- preset、9部品選択、選択強調、HUD／learning同期、blank clear: PASS
- opacity 100／50／16、exterior OFF／ON、split／explode／restore: PASS
- multi-touch 100 cycle、production audio、visibility 30 cycle、10分相当stress: PASS
- console／runtime／unhandled rejection: 0
- forbidden interference: 0
- protected paths: 12/12 pixel／SHA exact

Native Safariのproduction profileは450／80／1200／250／5500 msで、diagnostic overrideとsetter呼出しは0である。物理iPhoneではforeground自動復帰6/6、fallback tap 0、音のduplicate／burstなしを確認した。

## 性能判断

閾値はFPS悪化5%以内、p95悪化2ms以内で不変とした。commit段階12セルの中央値はすべて閾値内だった。

| 比較 | idle FPS / p95 | pointer FPS / p95 | wheel FPS / p95 |
|---|---:|---:|---:|
| A→B | +0.02% / -1ms | -1.01% / -2ms | +0.31% / -1ms |
| B→C | -1.47% / +1ms | +1.05% / +1ms | -0.06% / +1ms |
| C→D | +1.96% / -1ms | -0.38% / +2ms | +1.03% / +1ms |
| A→D | -1.10% / -3ms | +1.94% / 0ms | -1.90% / 0ms |

CとDの製品treeは同一なので、C→Dの順序別変動をコード差とは扱わない。

M3→M5はidle -0.62%／0ms、pointer -0.87%／-2ms、wheel +4.07%／+4msだった。wheelの全体p95だけが閾値外だが、順序別p95は前半+1.5ms、後半+1msで、audio ON側FPSも改善しているため`ACTIVE_AUDIO_WHEEL_P95_VARIABILITY_INCONCLUSIVE_NOT_PRODUCT_REJECTION`とする。M4は製品guard上成立しないため`NOT_APPLICABLE_PRODUCT_CONTRACT`／`DISABLED_PROTECTED_CONTEXT_MISMATCH`であり、架空状態は作成していない。

## 環境制約

最終clean-process測定は`ENDPOINT_SECURITY_LOAD_BLOCKED_CLEAN_PERFORMANCE_MEASUREMENT`で`NOT TESTED`とする。Chromeは終了後に自動再起動し、StatefulFirewallは約178～194% CPU、VShieldScanner 3プロセスは各約83～87%、CPU idleは約13～25%、Load Averageは約8.9～13.3だった。AC接続、Low Power Mode 0で、McAfeeは停止・無効化していない。

これは製品FAILではない。既存の隔離実行ではMobile pointer製品回帰を再現しておらず、追加の製品修正や閾値変更は行わない。

## 解決済み試験インシデント

1. DesktopへMobile full-length条件を誤適用した`INVALID_DESKTOP_STARTUP_CONTRACT`は撤回し、製品回帰falseとした。
2. SafariDriver `POST /session` timeoutは`NATIVE_SAFARI_ENVIRONMENT_FAILURE`で、clean reset後にNative Safari PASSとなった。
3. 初回Mobile pointer FAILはrunner contract mismatch、background process contamination、wrong canvas selector、invalid audio diagnostic fieldへ分離し、製品回帰は再現しなかった。
4. clean-process最終試験はendpoint security高負荷により`NOT TESTED`であり、製品FAILではない。

## 変更範囲と次の判断

本工程は文書・証跡だけを追加した。製品コード、test runtime、performance threshold、camera、input、audio、APP_VERSIONは変更していない。証跡記録後、PR #25はPR #24へ統合済みである。現在はD2c3をquery限定・未採用、Issue #2をOpen、PR #24をOpen／Draftで維持し、Phase 3B.4dは開始しない。

次はChatGPTによる統合証跡レビューである。Ready化、merge、Issue #2 close、既定採用には別途Human承認が必要である。
