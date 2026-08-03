# Post-Default-Adoption Main Reconciliation

## 結論

PR #27のcompleted-watch default adoptionはmainへ正しく統合され、製品treeとGitHub Pages公開は一致している。一方、受入状態を検証するNode 2件がPR #27マージ前のDraft期待値を保持しているため、最終本体完成宣言はまだ行わない。

正式判定は`POST_DEFAULT_ADOPTION_PRODUCT_AND_PAGES_RECONCILED_TEST_EXPECTATION_MISMATCH_BLOCKS_COMPLETION`である。

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

`npm test`は465件を実行し、463 pass／2 failとなった。失敗は`tests/final-completed-watch-default-evidence.test.mjs`の受入状態assertionである。

1. 期待`FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION_TECHNICAL_CANDIDATE`に対し、保存値は`FINAL_COMPLETED_WATCH_DEFAULT_ADOPTION_HUMAN_ACCEPTED`
2. Human acceptance未完了を要求する旧文書期待値に対し、現在文書はHuman accepted／merge authorized

製品機能の失敗ではないが、完了ゲートではFAILをPASSへ変換しない。本監査はdocs-onlyのためtestsを変更せず、別の試験整合修正を要求する。

### Browser

同一mainのHTTP配信を使い、Installed ChromeとPlaywright WebKitでDesktop 1280×720／Mobile 390×844のdefault、legacy、explicit routeを各6/6確認した。profile、APP_VERSION、canvas、camera、初期音OFF、state invariantは全条件で合格した。WebKitはconsole error／warning／runtime error 0、Chromeは製品runtime error／warning 0である。Chromeの最初のdefault DesktopだけローカルHTTPサーバーのfavicon 404を1件記録し、製品コードまたは公開Pagesの失敗へ変換しない。

Native SafariはPR #27固定製品HeadのSafari／SafariDriver 26.5.2証跡を継承する。mainとの製品tree exactを確認したが、本監査で新規Native Safari runは実行していない。

## GitHub Pages

GitHub Pagesはmain／rootをsourceとするlegacy buildで、main `155275d0aaeb968fd83d6dfe15313e259f2bb064`のbuildが成功している。公開URLは<https://showhey04-oss.github.io/mechanical-watch-3d/>である。root、`index.html`、default-profile module、audio manifest、代表WAVはHTTP 200で、公開rootはv3.15.0、completed-watch profile、初期音OFF、console error／warning 0を確認した。

## 変更範囲

本監査は文書・JSONだけを変更する。`index.html`、`js/**`、`assets/audio/**`、`tests/**`、Geometry、mechanism、rendering、camera、input、audio、UI、APP_VERSION、閾値を変更しない。Issue #2とPR #5も操作しない。

## 次の判断

本体完成宣言前に、旧Draft期待値2件を現在のHuman accepted／merged状態へ合わせる独立した試験整合PRが必要である。閾値緩和や製品コード変更は不要である。
