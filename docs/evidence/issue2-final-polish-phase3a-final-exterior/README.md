# Issue #2 Final Polish Phase 3A evidence

状態は`ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED`、正式監査判断は`ISSUE2_PHASE3A_AUDIT_ACCEPTED_CANDIDATES_REJECTED_NO_ADOPTION`。完成外装Phase 3C.3に対するbaseline／D2a／D2c3の比較証跡であり、採用証跡ではない。D2aは視覚参考として棄却し、D2c3は`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`としてquery実装と比較履歴だけを保持する。

## 由来

- source base: `191ff2682398356da59e747e608c82120dacebd9`
- PR #5 source: `79feee0f81bc719de0118042b356a2b63007090c`
- branch: `feature/issue2-final-polish-phase3a-final-exterior`
- APP_VERSION: `v3.15.0`
- capture: same-origin unsandboxed iframe harnessから実Three.js sceneをoffscreen WebGLRenderTargetへ描画

## 構成

- `raw/`: 3候補×2 viewport×33状態、計198枚の実PNG
- `protected/`: Phase 3C.3-onlyのpixel-exact照合画像
- `boards/`: 候補、opacity、theme、表裏側、near/far、金属、open-heart、選択比較
- `gifs/`: view回転、opacity往復、選択切替
- `reports/coverage-*.json`: document URL、WebGL、照明、状態、PNG SHA
- `reports/luminance-and-region-metrics.json`: percentile、dark／clipped、領域mask
- `reports/opacity-adjacent-differences.json`: 100/99、56/55、55/54、54/53
- `reports/performance-*.json`: idle、pointer、wheel、opacity、selected、split、explode、外装OFF
- `reports/performance-summary.json`: baseline差分
- `reports/regression-*.json`: 完成外装統合回帰
- `reports/suite-*.json`: browser、UI、HUD、audio
- `reports/decision-summary.json`: 非採用判断
- `reports/regression-results.json`: 回帰全体
- `evidence-manifest.json`: closed-world SHA-256

## 結果

- 実PNG: 198/198、viewport一致。D2a／D2c3は全画像non-flat。baseline mobileのfull length／far 2枚は実画面が背景色だけになる黒つぶれを再現
- console error／warning: 0
- 完成外装統合回帰: 6/6
- Node: 210/210
- UI／HUD: 全件合格
- 音声: baselineとD2c3で共通のresume backlog項目1件のみ未達、候補固有0
- protected path: normal、Phase 3C.1-only、Phase 3C.2-onlyを既存byte-exact証跡で維持。Phase 3C.3-onlyは明示baselineと2 viewportでpixel exact
- D2a／D2c3性能差分: FAIL
- 採用候補: なし
- coverage: `DIMENSIONAL_COVERAGE_SET_NOT_FULL_CARTESIAN`
- 198枚は候補棄却には十分だが、最終候補採用に必要な重要条件の完全直積ではない
- D2c3はbaseline-preserving候補が成立しない場合の最終対抗案としてのみ保持し、現在は未採用

`raw/`の画像は生成スクリプトによる合成ではない。Python生成処理は実キャプチャの計測、board／GIF生成、JSON集計だけを行う。
