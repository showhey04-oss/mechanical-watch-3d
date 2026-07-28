# Issue #2 Final Polish Phase 3B.3 evidence

## 状態

`D2C3_SELECTED_FOR_FINAL_POLISH_PENDING_POST_SELECTION_STABILIZATION`

このフォルダは、現行透過方式を共有するShadow-offとD2c3を、PC／物理iPhoneで最終比較するための証跡である。新しい描画アルゴリズム、Light、Material、Geometry、camera、DPR、UI、audioは追加していない。

## 候補

- Shadow-off: `HUMAN_REJECT_SHADOW_OFF_FOR_FINAL_POLISH_MOBILE_VISIBILITY`
- D2c3: `HUMAN_SELECT_D2C3_WITH_EXPLICIT_PERFORMANCE_TRADEOFF`
- continuity: `issue2-current`
- candidate selected: `d2c3`
- adopted: `false`

## 由来

- main: `293626f13a50224924f8e3ac229a1fc4077ad7a7`
- Phase 3B.2 human-decision base: `b303b8d6192309e21e6dea95595c8e808c258ffe`
- Phase 3B.3 harness: `3d6ac99a2b7d952be3a34323e1d48d2b6b6538fc`
- branch: `feature/issue2-final-polish-phase3b3-final-candidate-review`
- APP_VERSION: `v3.15.0`
- capture: same-origin unsandboxed iframe with actual Three.js offscreen WebGL capture

## 内容

- `raw/`: 2候補×2 viewport×4 theme×16 scenario = 256 actual WebGL PNG
- `motion/`: 2候補×2 viewport×9操作×8 frame = 288 actual live-canvas frame
- `boards/`: front／back／side、100／99、55／54、opacity 16、distance、theme比較
- `gifs/`: 候補・viewportごとの9操作、合計36 GIF
- `reports/`: 同値性、性能132 run、protected path、mobile framing、review URL、回帰、判断
- `evidence-manifest.json`: 自己参照を除くclosed-world bytes／SHA-256一覧

## 透過query同値性

`continuity=issue2-current`明示時と省略時を通常状態12条件で比較した。Desktop 24条件はPNG byte exact、Mobileはページ再読込間で最大12 pixel・最大3階調のsub-visible GPU量子化差を記録した。全条件でworld transform、Material replacement 0、Material UUID change 0、source contract一致を確認している。selected／split／explode／exterior OFFは時間依存状態のため同値性判定から除外するが、候補比較の256枚には含める。

## 人間確認

最終候補URLは`reports/candidate-urls.json`に保存する。PC比較と物理iPhone候補別15分確認を完了し、D2c3を性能tradeoff込みで選定した。冷却5分は手順差、progressive frame drop／Safari reloadは未報告、テンプ音の遅れは候補独立性未確定として保存する。D2c3はモバイル全長構図、音響、温度の安定化前に既定採用、Ready化、マージ、Issue #2クローズを行わない。
