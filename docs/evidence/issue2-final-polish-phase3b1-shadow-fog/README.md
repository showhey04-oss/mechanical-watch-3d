# Issue #2 Final Polish Phase 3B.1 evidence

状態は`ISSUE2_PHASE3B1_NO_TECHNICAL_FINALIST`。Phase 3C.3完成時計baselineの長所を保護し、shadow carrier、固定shadow fit、fog 160／260を分離比較したquery限定証跡であり、採用証跡ではない。

## 由来

- Phase 3C.3比較基準: `191ff2682398356da59e747e608c82120dacebd9`
- Phase 3A判断記録: `3d7f84ea3f122fbc1df715b4eff3c8cebf64f46d`
- Phase 3B.1実装: `5df265176ededfc7cd8da22de8bb83fde6fe3546`
- branch: `feature/issue2-final-polish-phase3b1-shadow-fog`
- APP_VERSION: `v3.15.0`
- capture: same-origin unsandboxed iframe harnessから実Three.js sceneをoffscreen WebGLRenderTargetへ描画

## 構成

- `raw/shadow/`: 6候補 × 2 viewport × 72条件
- `raw/fog/`: 6候補 × 2 viewport × 16条件
- `protected/base/`、`protected/current/`: 7 path × 2 viewportのbyte exact比較
- `boards/`: opacity 16／8、state、fog、front/back、shadow-fit解像度の実キャプチャ比較
- `gifs/stage1-candidate-shadow-cycle.gif`: 6候補の実キャプチャ切替
- `reports/stage1-*.json`: URL、WebGL、候補状態、実PNG、画素、transform、干渉
- `reports/performance-*.json`: 7条件 × 10秒の実ブラウザ計測
- `reports/shadow-camera-bounds.json`: 5状態unionと固定shadow camera
- `reports/rectangular-edge-metrics.json`: projection boundaryと解像度劣化
- `reports/fog-visibility-metrics.json`: near／front／full-length／far
- `reports/front-back-balance.json`: navy／obsidianの表裏輝度
- `reports/performance-summary.json`: baseline差分
- `reports/protected-paths.json`: 14条件のbyte／SHA照合
- `reports/regression-results.json`: Node、browser、UI、HUD、audio
- `reports/decision-summary.json`: 候補判定
- `reports/stage2-status.json`: Stage 2未実施理由
- `evidence-manifest.json`: closed-world byte／SHA-256 inventory

## 結果

- 実WebGL PNG: 1056/1056
- Stage 1 run: 12/12
- console error／warning: 0
- transform invariant: 全条件true
- 禁止干渉: 0/0
- Node: 225/225
- UI／HUD: 全件合格
- performance differential: 全6候補合格
- protected path: 14/14 pixel exact
- manifest: missing／unexpected／shaMismatch 0/0/0
- technical finalist: 0件
- Stage 2: `SKIPPED_ZERO_TECHNICAL_GATE_CANDIDATES`
- 物理iPhone: 未実施
- default adoption: なし

`shadow-off`は矩形影を消すがDesktopの前後面バランス悪化が+0.081097となる。`shadow-fit`は投影境界を時計外へ出すが、512²のまま固定範囲を拡大したため斜め勾配がbaseline比最大3.424倍となる。fog 160／260はDesktopを改善するがMobile far 4themeがflatのままである。よって全ゲート同時通過候補はない。

100→99%と55→54%の透過不連続は保護したままPhase 3B.2へ分離する。D2c3は`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`であり、採用していない。

## 人間診断結果

- baseline: `HUMAN_REJECTED_RENDERING_BASELINE`
  - 中央矩形影、裏面の暗さ、立体感不足により総合不合格
  - 比較・再現基準としてだけ保持
- shadow-off: `HUMAN_DESIGN_HOLD_TECHNICALLY_NONFINAL`
  - 中央矩形影なし、前後面バランスは人間評価上OK
  - D2c3より立体感が弱く、ズームアウト時に暗い
  - 技術ゲートは緩和せず、軽量対抗案として保持
- D2c3: `RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`
  - 視認性と立体感は良いが、角度別輝度差とPCズームイン時の操作負荷が残る
  - スマートフォン操作感は許容
  - 既定採用しない

Baselineは明確に最下位である。Shadow-offとD2c3の優先順位は未決定で、状態別tight shadow camera候補をPhase 3B.1bで比較する。

スマートフォンで完成時計全長を十分俯瞰できない現象は`DEFERRED_MOBILE_FULL_LENGTH_FRAMING_AND_ZOOM_LIMIT`として独立保留する。Phase 3B.1bではcameraやzoom limitを変更しない。
