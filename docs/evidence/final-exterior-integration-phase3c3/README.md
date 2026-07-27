# Phase 3C.3 完成外装統合証跡

## 出所

- Phase 3C.2承認Head: `f245a5a9d68d5205e7609479ffefd711376e4930`
- 監査実装Head: `2de1cfea71fe74259c0343138e36a3c52c8712e3`
- ブランチ: `feature/final-exterior-balanced-phase3c3-integration-review`
- APP_VERSION: `v3.15.0`
- capture mode: same-origin unsandboxed iframe harness in GPU-enabled in-app Browser

## 自動結果

- Node: 197/197
- Desktop 1280×720統合ハーネス: 合格
- 390×844統合ハーネス: 合格
- 小秒空白: 100%／50%ともDesktop・Mobile 4/4
- opacity 16%内部選択: Desktop・Mobileとも設定車2
- 禁止干渉: 位置1／位置2とも0/0
- queryなし／Phase 3C.1-only／Phase 3C.2-only: pixel exact
- 性能: `DIFFERENTIAL_PASS`
- console: application error 0 / warning 0

絶対性能はin-app Browserのフレームペーシング変動を分離し、`ENVIRONMENT_BLOCKED_BY_IN_APP_BROWSER_FRAME_PACING`と記録する。閾値は変更していない。

## 画像

`images/`には実in-app Browserのviewport screenshotを保存する。

- Desktop: front、oblique、side、back、full length、watch mode、exterior off、opacity 99／55／54／16、split、explode、小秒選択、学習タブ、位置2
- Mobile: initial、oblique、back、full length、exterior off、opacity 16内部選択、split、explode、小秒選択、bottom sheet、学習タブ、位置2

## GIF

`videos/`の10ファイルは実Browser screenshotまたは実CUA回転・zoom frameから生成した。

1. 完成時計回転
2. 全長と時計本体
3. 時計モード
4. りゅうず位置1／2
5. 外装・opacity・内部選択
6. split・explode・restore
7. 小秒／内部選択
8. 学習選択
9. モバイル回転・ズーム
10. 物理iPhone確認用操作順

10番は人間確認手順の案内であり、物理iPhoneでの実行完了を主張しない。

## レポート

- `desktop-runtime.json`
- `mobile-390-runtime.json`
- `object-audit.json`
- `small-second-selection.json`
- `proportion-audit.json`
- `ui-decision.json`
- `issue2-handoff.json`
- `performance-results.json`
- `protected-paths.json`
- `regression-results.json`
- `capture-metadata.json`

`evidence-manifest.json`は自己参照を含めず、証跡ディレクトリをclosed-worldで管理する。

## 人間確認待ち

- PC統合レビュー
- 物理iPhone統合レビュー
- 15分連続操作と温度観察
- Issue #2描画品質の最終判断

PRはDraftのまま維持し、Ready化・マージ・既定採用を行わない。
