# Post-Default-Adoption Main Reconciliation

## 結論

PR #27のcompleted-watch default adoptionはmainへ正しく統合され、製品treeとGitHub Pages公開は一致している。PR #27マージ前のDraft期待値を保持していたNode 2件は、PR #28内でHuman accepted／merged証跡へ整合し、465/465・skip 0へ復旧した。その後、物理iPhoneで時刻入力欄の右端overflowがHuman報告されたため、局所UI修正と実機再確認まで本体完成宣言をブロックする。

製品・Pages・受入テストのreconciliationは`POST_DEFAULT_ADOPTION_PRODUCT_PAGES_AND_ACCEPTANCE_TESTS_RECONCILED`を維持する。本体完成ゲートは`IPHONE_TIME_INPUT_RIGHT_EDGE_OVERFLOW_HUMAN_REPORTED`により`MECHANICAL_WATCH_3D_BODY_COMPLETION_BLOCKED`である。

## 固定点

| 項目 | 値 |
|---|---|
| repository | `showhey04-oss/mechanical-watch-3d` |
| main | `155275d0aaeb968fd83d6dfe15313e259f2bb064` |
| PR #27 product Head | `a7f0057db57de168c2af0bd01847fcfed9a606dc` |
| PR #27 acceptance Head | `795223bfb2804fc8b7e058ac36245c1f4c650e36` |
| APP_VERSION | `v3.15.0` |
| audit branch | `docs/post-default-adoption-completion-gate` |

PR #13～#27はMerged、PR #5はOpen／Draft、Issue #2はOpenである。Phase 3B.4d、OIT、post-Issue-2 Geometry cleanupは開始していない。

## Product tree parity

`git diff --quiet a7f0057db57de168c2af0bd01847fcfed9a606dc..155275d0aaeb968fd83d6dfe15313e259f2bb064 -- index.html js assets/audio package.json package-lock.json tests`は終了コード0である。両Head間の差分はPR #27のHuman受入文書・証跡4件だけで、製品・試験treeの差はない。

## Runtime verification

### Node

監査開始時の`npm test`は465件を実行し、463 pass／2 failとなった。失敗は`tests/final-completed-watch-default-evidence.test.mjs`の受入状態assertionだった。

1. 期待`FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION_TECHNICAL_CANDIDATE`に対し、保存値は`FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION_HUMAN_ACCEPTED`
2. Human acceptance未完了を要求する旧文書期待値に対し、現在文書はHuman accepted／merge authorized

これは製品機能の失敗ではなく、保存証跡のHuman accepted化後に旧期待値が残った履歴上の不整合だった。PR #28内で同じ既存テストを更新し、Human accepted状態、Ready／main merge承認、曖昧なHuman提出欄の原文を厳密に検証するよう整合した。テスト総数465、skip 0、閾値は不変で、再実行結果は465 pass／0 failである。

### Browser

同一mainのHTTP配信を使い、Installed ChromeとPlaywright WebKitでDesktop 1280×720／Mobile 390×844のdefault、legacy、explicit routeを各6/6確認した。profile、APP_VERSION、canvas、camera、初期音OFF、state invariantは全条件で合格した。WebKitはconsole error／warning／runtime error 0、Chromeは製品runtime error／warning 0である。Chromeの最初のdefault DesktopだけローカルHTTPサーバーのfavicon 404を1件記録し、製品コードまたは公開Pagesの失敗へ変換しない。

Native SafariはPR #27固定製品HeadのSafari／SafariDriver 26.5.2証跡を継承する。mainとの製品tree exactを確認したが、本監査で新規Native Safari runは実行していない。

## GitHub Pages

GitHub Pagesはmain／rootをsourceとするlegacy buildで、main `155275d0aaeb968fd83d6dfe15313e259f2bb064`のbuildが成功している。公開URLは<https://showhey04-oss.github.io/mechanical-watch-3d/>である。root、`index.html`、default-profile module、audio manifest、代表WAVはHTTP 200で、公開rootはv3.15.0、completed-watch profile、初期音OFF、console error／warning 0を確認した。

## 変更範囲

本監査は文書・JSONと、`tests/final-completed-watch-default-evidence.test.mjs`の受入状態期待値だけを変更する。`index.html`、`js/**`、`assets/audio/**`、Geometry、mechanism、rendering、camera、input、audio、UI、APP_VERSION、閾値を変更しない。Issue #2とPR #5も操作しない。

## 次の判断

旧Draft期待値2件は同じPR #28内で閉鎖済みである。新しいblocking count 1はmobile time-setting UIに限定し、mainから独立した局所修正PRでnative time input layoutを直した後、物理iPhoneで時刻合わせを再確認する。修正PRのHuman受入とmainマージ後にPR #28を最新mainへ整合し、blocking count 0を再評価する。本監査自身は完成宣言、PR Ready化・マージ、Issue／PR closeを行わない。
