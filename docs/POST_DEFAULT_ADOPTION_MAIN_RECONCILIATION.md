# Post-Default-Adoption Main Reconciliation

## 結論

PR #29の時刻入力修正はmerge commit `25f852a0218486f695a5e2b88c7fc9b665c8c362`としてmainへ統合済みである。Humanは製品Head `cf1751265410a160715db2bd9566b1703d916bac`をiPhone 16／iOS 26.5.2／Safari縦向きで確認し、R3の`HH:MM:SS`表示、上下・左右中央、二重表示なし、native picker、picker後表示、指定時刻・現在時刻反映をPASSとした。

PR #28へこのmainをmerge commitで統合し、製品treeを変更せず、Node 477/477・fail 0・skip 0へ整合した。正式状態は`POST_ADOPTION_NODE_ACCEPTANCE_STATE_ALIGNED`、`POST_ADOPTION_NODE_GATE_PASSED`、`IPHONE_TIME_INPUT_COMPLETION_BLOCKER_RESOLVED`である。

## 固定点

| 項目 | 値 |
|---|---|
| repository | `showhey04-oss/mechanical-watch-3d` |
| PR #29 merge後main | `25f852a0218486f695a5e2b88c7fc9b665c8c362` |
| Human reviewed PR #29 product Head | `cf1751265410a160715db2bd9566b1703d916bac` |
| PR #29 state | `MERGED` |
| APP_VERSION | `v3.15.0` |
| completion branch | `docs/post-default-adoption-completion-gate` |

## Product tree parity

PR #28統合Headの`index.html`、`js/**`、`assets/audio/**`、`package.json`、`package-lock.json`はPR #29 merge後mainとGit object exactである。PR #28独自のGeometry、mechanism、rendering、camera、input、audio asset／gain、APP_VERSION変更は0件である。

## Acceptance reconciliation

- 旧Node受入状態不整合：463/465から465/465へ解消済み
- PR #29追加後の統合Node：477/477、fail 0、skip 0
- R1：outer frame FAIL、全体FAIL
- R2：外枠、角丸、native picker、時刻反映、core overflow PASS
- R3：`HH:MM:SS`、上下・左右中央、二重表示なし、native picker、時刻反映、全体PASS
- Human R3証跡：`docs/evidence/iphone-time-input-overflow/reports/human-review-r3.json`
- test skip／閾値変更：0

## GitHub終結順序

PR #28をReady化し、expected Headを固定してmerge commit方式でmainへ統合する。final mainでNode全件、product tree、APP_VERSION、diff、clean worktreeを再確認した後だけ、Issue #2をaccepted limitation／not planned、PR #5をsuperseded／unmergedとしてcloseする。

PR #30は本工程では変更しない。final mainへの整合、README凍結状態、PHASE_HISTORY、LICENSE、後継リンクは次工程で扱う。
