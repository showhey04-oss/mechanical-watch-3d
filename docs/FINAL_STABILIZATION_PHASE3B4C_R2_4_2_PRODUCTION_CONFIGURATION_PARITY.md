# Final Stabilization Phase 3B.4c-R2.4.2 — production configuration evidence parity

## 結論

- `PHASE3B4C_R2_4_2_PRODUCTION_TIMEOUT_PROFILE_VERIFIED`
- `PHASE3B4C_R2_4_2_DIAGNOSTIC_PROFILE_SEPARATED`
- `PHASE3B4C_R2_4_2_EVIDENCE_CONFIGURATION_PARITY_PASSED`
- `PHASE3B4C_R2_4_2_DOCUMENTATION_CODE_PARITY_PASSED`
- `PHASE3B4C_R2_4_2_INDEPENDENT_REVIEW_PASSED`
- `PHASE3B4C_R2_4_2_SINGLE_FINAL_CANDIDATE_READY_FOR_CHATGPT_REVIEW`

R2.4.1のfresh Context transaction設計は維持した。通常アプリが使うproduction既定値と、多数のhang／timeout faultを短時間で診断するtight profileを名称・実行経路・証跡で分離した。

## timeout profile

| profile | resume | clock probe | decode | close | transaction | 用途 |
|---|---:|---:|---:|---:|---:|---|
| `PRODUCTION_TIMEOUT_PROFILE` | 450 ms | 80 ms | 1,200 ms | 250 ms | 5,500 ms | 通常アプリ既定値・production受入証跡 |
| `TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE` | 450 ms | 80 ms | 300 ms | 50 ms | 1,500 ms | fault-heavy診断専用。production受入ではない |

production試験では`setAudioPlatformRecoveryTimeoutsForTest()`を呼ばず、起動後の診断値から450／80／1,200／250／5,500 msを取得した。tight試験だけが明示setterを呼び、使用profileを各条件へ記録した。production値は変更していない。

## R2.4.1証跡の再分類

R2.4.1 browser証跡の300／50／1,500 msはhang経路を高速反復するための`TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE`だった。履歴証跡は削除しないが、production URLの無変更既定値を直接検証したという分類は撤回し、本R2.4.2のproduction matricesを受入証跡とする。

## 実ブラウザ検証

Installed ChromeとPlaywright WebKitで、1280×720と390×844を実行した。各runtime/profileは18条件・400 cycle、全体は72条件・1,600 cycleである。各viewportでvisibility 100、fresh Context success 30、decode reject/hang、old Context close reject/hang、stale transaction、scheduler false、legacy reset exceptionを各10 cycle実行した。

- Promise未完了: 0
- buffer／raw asset: 6/6
- duplicate／backlog／catch-up: 0/0/0
- console error／warning／runtime error／unhandled rejection: 0/0/0/0
- Context generationとscheduler re-anchor: 上限内
- production setter呼出し: 0
- tight diagnostic setter呼出し: 各条件で明示実行

## 保護範囲

R2 timebase、R2.1 timeline reset、R2.4.1 transactionロジック、Geometry、rendering、lighting、transparency、camera、multi-touch、audio file、fixed gain、APP_VERSION、hidden elapsed policy、試験閾値は変更していない。追加したscheduler false経路は明示的な診断fault時だけ有効である。

## 制約

`NATIVE_SAFARI_AUTOMATION_BLOCKED_BY_ENVIRONMENT`を維持する。Playwright WebKitをNative Safariの代替とは扱わず、`PHASE3B4C_HUMAN_RETEST_REMAINS_FROZEN`とする。物理iPhone確認、Human確認URL、Human試験手順、Ready化、merge、既定採用、Issue #2 close、Phase 3B.4d開始は行っていない。
