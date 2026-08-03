# Phase 3B.4 Stack Integration Evidence

## 結論

この証跡はPhase 3B.4a／3B.4b／3B.4cの既存結果をHead `d16037a75d85d705434d8b73ef5293511052f65e`へ統合した記録である。追加の性能測定、Native Safari再実行、物理iPhone再実行、製品コード修正は行っていない。

機能ゲートとprotected pathは合格した。性能は既存の隔離実行で製品回帰なしと判定したが、endpoint security高負荷のためclean-process最終測定は`NOT TESTED`である。従って`PHASE3B4_STACK_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION`とし、clean環境の絶対性能PASSとはしない。

## Provenance

- repository: `showhey04-oss/mechanical-watch-3d`
- branch: `feature/issue2-final-polish-phase3b4b-ios-multitouch-stability`
- A: `ece9d99c4e0ff95afd155475ef963e2984c5d05f`
- B: `d6718e59a2438152a4a203fa579b66ce6e91ecd3`
- C: `0e260fdfc7495293319682ae7b998858641cdd26`
- D / source Head: `d16037a75d85d705434d8b73ef5293511052f65e`
- APP_VERSION: `v3.15.0`
- evidence mode: existing verified evidence aggregation; no new performance run
- generated: `2026-08-03T02:09:05+09:00`

CとDの`index.html`、`js/**`、`assets/audio/**`、`package.json`、`tests/**`はGit object単位で一致する。Dへ追加されたのは物理iPhone受入文書・証跡だけである。

## Reports

- `reports/decision-summary.json`: 正式判断と承認境界
- `reports/node-regression.json`: 442/442の既存Node結果
- `reports/browser-integration.json`: Chrome／WebKit統合ゲート
- `reports/native-safari.json`: Native Safari production profileと物理iPhone受入
- `reports/preset-selection.json`: preset、9部品、HUD／learning、解除
- `reports/multitouch-audio.json`: multi-touch、production audio、visibility、stress
- `reports/performance.json`: commit段階とM3→M5の中央値
- `reports/performance-cause-isolation.json`: runner／環境原因分離
- `reports/environment-limitations.json`: endpoint securityによるclean測定block
- `reports/protected-paths.json`: 12 protected pathとC／D tree parity
- `reports/evidence-manifest.json`: このrootのclosed-world SHA-256 manifest（自己除外）

## Source evidence

- `docs/evidence/issue2-final-polish-phase3b4b-ios-multitouch-stability/`
- `docs/evidence/final-stabilization-phase3b4c-r2-4-2-production-configuration-parity/`
- `docs/evidence/final-stabilization-phase3b4c-r2-4-2-physical-iphone-acceptance/`
- 既存の隔離性能調査（2026-08-02、A/B/C/D固定commit）。巨大raw一時出力はmanifestへ含めず、本rootには決定に必要な集約値だけを保存する。

## Limitations

- clean-process performance: `NOT TESTED`
- blocker: `ENDPOINT_SECURITY_LOAD_BLOCKED_CLEAN_PERFORMANCE_MEASUREMENT`
- McAfee disabled result: なし
- absolute performance PASS: 主張しない
- M3→M5 wheel aggregate p95: `ACTIVE_AUDIO_WHEEL_P95_VARIABILITY_INCONCLUSIVE_NOT_PRODUCT_REJECTION`
- M4: `NOT_APPLICABLE_PRODUCT_CONTRACT`

PR #25はOpen／Draftを維持する。D2c3は未採用、Issue #2はOpen、Phase 3B.4dは未開始である。
