# PR #13 Final Stack Main-Promotion Audit

## 結論

PR #13 Head `86d7bdc041a5f43ddbbeb92d09a01b4a95dc701b`は、PR #14～#26で段階検証された完成外装・Issue #2 Final Polish・Final Stabilizationを単一stackとして含む。製品・試験treeは受入済みstack Head `dab5dc474071784b06db9fb2fb3f36d469f16389`とGit object exactであり、main `293626f13a50224924f8e3ac229a1fc4077ad7a7`からの差分は排他的な8分類へ整理できる。

判定は`FINAL_STACK_PR13_MAIN_AUDIT_PASSED`とする。ただし、これはmainへのmerge承認やD2c3の既定採用ではない。PR #13はOpen／Draft、Issue #2はOpen、PR #5はOpen／Draft、D2c3はquery限定・未採用、Phase 3B.4dは未開始である。

## 固定点

| 項目 | 値 |
|---|---|
| repository | `showhey04-oss/mechanical-watch-3d` |
| base | `main` |
| main Head | `293626f13a50224924f8e3ac229a1fc4077ad7a7` |
| PR #13 audit source Head | `86d7bdc041a5f43ddbbeb92d09a01b4a95dc701b` |
| accepted stack parity Head | `dab5dc474071784b06db9fb2fb3f36d469f16389` |
| APP_VERSION | `v3.15.0` |
| PR state | Open／Draft |

GitHub上ではPR #14～#26をMerged／Closed、PR #5をOpen／Draft、Issue #2をOpenとして再確認した。PR #13に未解決review threadまたは提出済みreviewはない。

## mainからの差分分類

main→PR #13は6247 files、13,455,501 insertions、117 deletionsである。全ファイルを次の排他的8分類へ割り当て、合計6247件と一致させた。

| 区分 | 内容 | files |
|---|---|---:|
| A | Phase 3B.1 core exterior | 3 |
| B | Phase 3B.2 attachment | 3 |
| C | Phase 3C.1 watch head | 2 |
| D | Phase 3C.2 strap／buckle | 3 |
| E | Phase 3C.3 integration | 2 |
| F | Issue #2 Phase 3A～3B.2 | 11 |
| G | Issue #2 Phase 3B.3～3B.4／stabilization | 10 |
| H | docs／tests／evidence | 6213 |
| 合計 |  | 6247 |

`index.html`はGへ分類する。`js/mechanical-audio.js`とFinal Stabilization 5 module、Phase 3B.4a／3B.4bの3 moduleを含む。README 1件、docs 6020件、tests 192件をHとした。分類の重複・未分類は0件である。

## 製品・試験treeの同一性

次のGit objectはPR #13と受入済みstack Headで一致した。

| path | Git object |
|---|---|
| `index.html` | `1992aaa83f4d1b0abd50dc8301464096673598a8` |
| `js` | `a1d17cb902d041c985f6bb43efdf9aa39926871b` |
| `assets/audio` | `800540a4001624157e78ec64e22a9321f18e8a1d` |
| `package.json` | `719bde698f7646bd75b389f2cd2b031243bb8db4` |
| `package-lock.json` | `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` |
| `tests` | `a31119617c10132c1ad4e161d5742fb9a27e23ef` |

`git diff dab5dc474071784b06db9fb2fb3f36d469f16389..86d7bdc041a5f43ddbbeb92d09a01b4a95dc701b -- index.html js assets/audio package.json package-lock.json tests`は空である。

## 実行検証

### Node

- `node --test tests/*.test.mjs`
- 442 tests／442 pass／0 fail

### 通常path差分

| viewport | main | PR #13 | PR固有失敗 |
|---|---:|---:|---:|
| Desktop 1280×720 | 86/86 | 86/86 | 0 |
| Mobile 390×844 | 87/88 | 87/88 | 0 |

Mobileの共通失敗は`a5-all-background-themes-keep-front-back-luminance-within-thirty-percent`である。mainとPR #13が同じ結果を示すため、Issue #2で継承している前後輝度差として保持し、PR #13固有回帰とはしない。通常pathを「全項目絶対PASS」とは記載しない。

### 完成stack query

```text
?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3&rendering=issue2-d2c3&continuity=issue2-current&framing=issue2-mobile-full-length-fit&input=issue2-ios-multitouch-stability&audioTiming=phase3b4c-stability&mechanismTiming=phase3b4c-r2-foreground-stability&audioLifecycle=r2-3-l4&audioPlatform=p3
```

Desktop 1280×720とMobile 390×844の双方で21/21を合格した。位置1／位置2、選択・HUD・学習同期、opacity、外装ON/OFF、split／explode／restore、完全復元、transform invariant、三針拘束、禁止干渉0を確認した。Object auditは195 Object、171 Mesh、45 Material、38 part nameで、非有限値・不一致は0件である。

### production audio

Desktop／Mobileとも`PRODUCTION_TIMEOUT_PROFILE`（450／80／1200／250／5500 ms）を使用し、diagnostic setter未使用、buffer／raw asset 6/6、duplicate／backlog／catch-up 0、application iframeのconsole error／warning 0である。最大transaction elapsedはDesktop 85 ms、Mobile 82 msだった。

Mobile実行時、外側browser-controlページにsource不明の`MutationObserver.observe` TypeError 1件を記録した。アプリiframeのconsole捕捉は0件で、同じ製品pathの機能・音響ゲートは合格しているため、製品回帰ではなく実行環境側の診断事象として分離する。

## 性能と既知制約

性能判断は既存の`PHASE3B4_STACK_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION`を継承する。commit段階の差分測定では製品回帰を再現しなかったが、endpoint security高負荷によりclean-process最終測定は`NOT_TESTED`である。clean環境のabsolute PASS、McAfee停止環境PASS、新しいfull performance matrixの完了は主張しない。試験閾値は変更していない。

100%／99%と55%／54%の透過不連続は現行制約として受容し、OITは完成後へ延期する。D2c3は人間選定済みのfinal-polish候補だが、この監査ではquery限定・未採用のままにする。Issue #2を閉じず、PR #5を変更せず、Phase 3B.4dとpost-Issue #2 Geometry cleanupを開始しない。

## 変更範囲と判断

本監査の変更はREADME、現行状態資料、本監査文書、本監査decision summary、PR #13本文だけである。製品コード、tests、evidence manifest、audio、Geometry、rendering、camera、input、UI、APP_VERSION、試験閾値は変更しない。

```text
FINAL_STACK_PR13_SCOPE_CLASSIFICATION_PASSED
FINAL_STACK_PR13_PRODUCT_TEST_TREE_PARITY_PASSED
FINAL_STACK_PR13_NODE_GATE_PASSED
FINAL_STACK_PR13_NORMAL_PATH_DIFFERENTIAL_PASSED
FINAL_STACK_PR13_INTEGRATED_QUERY_GATE_PASSED
FINAL_STACK_PR13_PRODUCTION_AUDIO_GATE_PASSED
FINAL_STACK_PR13_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION
FINAL_STACK_PR13_MAIN_AUDIT_PASSED
PR13_REMAINS_OPEN_DRAFT
MAIN_MERGE_AUTHORIZATION_FALSE
DEFAULT_ADOPTION_FALSE
```

次はChatGPTによる本監査と積み上げ範囲のレビューである。PR #13のReady化、mainへのSquash merge、D2c3既定採用、Issue #2 closeには別途Human承認が必要である。
