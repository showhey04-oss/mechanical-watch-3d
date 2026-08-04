# Final Completed Watch Default Adoption

## 結論

main `0aa04a582ee7238b4ef3da81bf9f0eb4ccf2acff`に統合済みの完成時計スタックを、通常アクセスの内部effective profileとして有効にする実装である。過去工程configの`queryOnly`、`enabledByDefault: false`、`defaultAdopted: false`、各時点のstatusは履歴として変更していない。

技術ゲートおよび最終Human確認は合格し、状態を`FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION_HUMAN_ACCEPTED`とする。HumanはPR #27のReady化とmainへのマージを明示承認した。APP_VERSIONはv3.15.0、作動音は初期OFFのままである。Issue #2はOpen、PR #5はOpen／Draftを維持する。

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

default rootと明示統合queryは、描画時のruntime・canvas・inventory・camera・lighting・transformがexactである。先行する3反復測定ではChrome Desktop wheelの1セルにFPS悪化6.14%が出たが、正式閉鎖測定の最初の試行で時間駆動loopがI=57件、E=56件となり、wheel workloadが同数でないことを検出した。この試行は統計から除外し、製品コードを変更せず、公開済み性能計測APIを使うリポジトリ外runnerで60件×50msへ固定した。

Installed Chrome 151.0.7922.72、1280×720で、I（暗黙default）、A（明示alias）、E（明示12-key）を指定順序の2ラウンド、各route 7回ずつ測定した。全42 runはwheel dispatch／receive／pacing 60/60、reversal 0、stop-then-jump 0、zoom monotonic、model transform invariant、console／runtime／unhandled rejection 0で有効だった。

全14 run中央値はI 34.7011fps／p95 34.05ms、A 34.5370fps／34.10ms、E 34.5302fps／34.10msである。I対EのFPS悪化率は-0.49%、p95差は-0.05ms、I対Aは-0.47%／-0.05msで、両ラウンド単独も5%／2ms差分閾値に合格した。McAfee／endpoint securityを停止せず、1分load average中央値7.46、security process CPU合計中央値207.95%の背景変動を各runへ記録した。

正式分類は`FINAL_COMPLETED_WATCH_CHROME_DESKTOP_WHEEL_FAILURE_NOT_REPRODUCED`、`FINAL_COMPLETED_WATCH_PERFORMANCE_MEASUREMENT_VARIABILITY_ISOLATED`、`FINAL_COMPLETED_WATCH_PERFORMANCE_DIFFERENTIAL_GATE_PASSED`である。default profile resolver、`URLSearchParams`、diagnostics、body datasetは初期化時だけで、wheel handler／animation loopに暗黙route固有の反復処理はない。閾値、DPR、描画設定、製品コードは変更しておらず、clean-process absolute性能PASSは主張しない。

## 最終Human確認

2026-08-03、固定Head `a7f0057db57de168c2af0bd01847fcfed9a606dc`について、Humanが次を確認した。

### PC

- 端末：MacBook Pro（Apple M1）
- ブラウザ：Safari
- default root起動・外観：OK
- 回転・ズーム・preset：OK
- 選択・HUD・学習・透過・分解：OK
- 巻上げ・時刻合わせ・秒停止：OK
- 作動音OFF→ON：OK
- Legacy route復帰：OK

### 物理iPhone

- 端末：iPhone 16
- OS：iOS 26.5.2
- ブラウザ：Safari
- default root起動・全長表示：OK
- マルチタッチ：OK
- 選択・パネル・透過：OK
- 巻上げ・時刻合わせ・秒停止：OK
- 作動音OFF→ON：OK

提出テンプレートでは「ホーム／別アプリ復帰後の音響」および3件の異常有無欄がslash形式のまま単独選択されていなかったため、その個別値は推測で補完しない。一方、Humanは総合`PASS`を明示し、PR #27のReady化とmainへのマージを明示承認した。この総合判断と承認を最終リリース判断として記録する。構造化記録は`docs/evidence/final-completed-watch-default-adoption/reports/human-acceptance.json`に保存する。

正式状態：

- `FINAL_COMPLETED_WATCH_DEFAULT_ROUTE_HUMAN_REVIEW_PASSED`
- `FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION_HUMAN_ACCEPTED`
- `PR27_READY_AND_MAIN_MERGE_AUTHORIZED`

## 変更していない範囲

Geometry、機構、歯車比、位相、S86、Phase 2C、D2c3値、PMREM、fog、Material、透過、camera定数、multi-touch実装、audio scheduler、production timeout、audio asset、gain、UI構造、APP_VERSION、試験閾値は変更していない。Phase 3B.4d、OIT、post-Issue-2 Geometry cleanupも開始していない。

## 最終判断

技術ゲートおよびHuman最終確認は合格した。PR #27はReady化およびmainへのマージが承認済みである。Issue #2はOpen、PR #5はOpen／Draft、Phase 3B.4dは未開始、OITは完成後実験のまま維持する。

## Post-merge reconciliation

PR #27はmain `155275d0aaeb968fd83d6dfe15313e259f2bb064`へマージされ、GitHub Pagesの通常rootへ公開された。mainの製品・試験treeはHuman-reviewed Head `a7f0057db57de168c2af0bd01847fcfed9a606dc`とexactであり、APP_VERSIONはv3.15.0、作動音は初期OFF、legacy routeは有効である。

受入文書のHuman accepted化後に`tests/final-completed-watch-default-evidence.test.mjs`の2 assertionが旧Draft／technical-candidate期待値を保持し、監査開始時のNode結果が463/465となる履歴上の不整合を検出した。PR #28内で既存テストの期待値だけを保存済みHuman accepted／merged証跡へ整合し、465/465・skip 0へ復旧した。製品コード、試験閾値、Issue #2、PR #5は変更していない。技術状態は`MECHANICAL_WATCH_3D_BODY_COMPLETION_READY_FOR_HUMAN_DECLARATION`であり、本体完成宣言はHumanの明示判断を待つ。
