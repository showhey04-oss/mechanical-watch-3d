# Final Completed Watch Default Adoption

## 結論

main `0aa04a582ee7238b4ef3da81bf9f0eb4ccf2acff`に統合済みの完成時計スタックを、通常アクセスの内部effective profileとして有効にするDraft実装である。過去工程configの`queryOnly`、`enabledByDefault: false`、`defaultAdopted: false`、各時点のstatusは履歴として変更していない。

状態は`FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION_TECHNICAL_CANDIDATE`であり、Human受入、Ready化、マージ、Issue #2クローズは行っていない。APP_VERSIONはv3.15.0、作動音は初期OFFのままである。

## 中央profile

`js/final-completed-watch-default-profile.js`が次の12項目を一か所で定義する。

- `exterior=balanced`
- `watchHead=phase3c1`
- `strapStyle=phase3c2`
- `integration=phase3c3`
- `rendering=issue2-d2c3`
- `continuity=issue2-current`
- `framing=issue2-mobile-full-length-fit`
- `input=issue2-ios-multitouch-stability`
- `audioTiming=phase3b4c-stability`
- `mechanismTiming=phase3b4c-r2-foreground-stability`
- `audioLifecycle=r2-3-l4`
- `audioPlatform=p3`

raw queryとeffective queryを分離し、実URL、`location.search`、historyは変更しない。profile選択キーが一つでも明示された場合は暗黙profileを注入せず、既存の部分工程・比較・診断経路を優先する。`defaultProfile=legacy`は開始mainの旧通常表示、`defaultProfile=completed-watch`は明示aliasである。不明な`defaultProfile`は例外や無言legacy化をせず、完成時計へfallbackして`INVALID_DEFAULT_PROFILE_VALUE`を診断へ記録する。

## 技術検証

- Node：465/465、FAIL 0、skip 0
- Installed Chrome：13 route × 2 viewport = 26/26
- Playwright WebKit：13 route × 2 viewport = 26/26
- default root／明示12-key query：両browser・両viewportでcanvas、Object3D／Mesh／Material inventory、camera、lighting、transformがexact
- `defaultProfile=legacy`／開始main通常path：両browser・両viewportでdecoded pixel SHA、DOM、cameraがexact
- multi-touch：Installed Chrome／WebKitの390×844で各100 cycle、idle復帰、capture残留0、camera finite、transform invariant
- Native Safari／SafariDriver 26.5.2：1280×720と390×844でqueryなしroot、preset、選択・HUD・解除、opacity、split／explode／restore、禁止干渉0/0、trusted Web Audio、各30 visibility cycle、console／runtime／unhandled rejection 0
- actual Web Audio：初期OFF、trusted click後`RUNNING_AND_ADVANCING`、buffer／raw asset 6/6、duplicate／backlog／catch-up 0

既存browser総合では、承認済みD2c3と旧A.5照明契約の不一致3件、および制約環境下のA.6絶対性能2件を両browser・両viewportで同じIDとして記録した。これらをPASSへ変換していない。その他の機構・A.7・禁止干渉・選択・UI・HUD・audio項目に新規失敗はない。

## 性能判断

default rootと明示統合queryは、描画時のruntime・canvas・inventory・camera・lighting・transformがexactである。一方、同一browserで`default → explicit → explicit → default → default → explicit`を3反復した再測定は、12セル中11セルが既存のFPS 5%・p95 2ms差分閾値内だったが、Chrome Desktop wheelの1セルはFPS悪化6.14%で未達だった。

したがって`FINAL_COMPLETED_WATCH_PERFORMANCE_DIFFERENTIAL_GATE_PASSED`は主張しない。状態は既存の`PHASE3B4_STACK_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION`を維持し、reversal 0、stop-then-jump 0、wheel monotonic、model transform invariantだけを確認済みとする。閾値、DPR、描画設定、製品コードを測定環境へ合わせて変更していない。

## 変更していない範囲

Geometry、機構、歯車比、位相、S86、Phase 2C、D2c3値、PMREM、fog、Material、透過、camera定数、multi-touch実装、audio scheduler、production timeout、audio asset、gain、UI構造、APP_VERSION、試験閾値は変更していない。Phase 3B.4d、OIT、post-Issue-2 Geometry cleanupも開始していない。

## 次の判断

Draft PRは技術候補として保持する。性能差分の全セル合格が確認できるまでは、固定commitのHuman最終root URLを提示せず、`PHYSICAL_IPHONE_FINAL_DEFAULT_ROUTE_REVIEW_REQUIRED`を実施済みにしない。Issue #2はOpen、PR #5はOpen／Draftを維持する。
