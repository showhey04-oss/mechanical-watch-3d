# Issue #2 Phase 3B.1b evidence

## 判定

`NO_TECHNICAL_FINALIST_NO_ADOPTION`

Phase 3B.1bはquery限定の離散状態別shadow-camera比較である。Stage 1は768/768、console error／warning 0件で完了した。state-tight 512／1024は中央矩形影を除去したが、透過面へ人間確認可能な斜め縞が生じたため`REJECTED_SHADOW_RESOLUTION`とした。Stage 2と物理iPhone確認は実施していない。

## 由来

- source base: `27533b91100c5dddca6507414c6fe3b282ed07c2`
- implementation: `e79a26ce4e18d30a81cbf840e45dfa1c4f063d51`
- requested query compatibility: `3e6917ec8cc0781f04af84254dbe317f0fc6a0b9`
- branch: `feature/issue2-final-polish-phase3b1b-discrete-shadow`
- APP_VERSION: `v3.15.0`
- capture: same-origin unsandboxed iframe harness
- viewport: 1280×720、390×844

raw PNGは実Three.js sceneをoffscreen WebGLRenderTargetへ描画した結果で、合成時計画像ではない。`motion/`も同じcapture APIによる実描画である。

## 主な証跡

### 比較ボード

- `boards/stage1-front-opacity16-desktop.png`
- `boards/stage1-front-opacity16-mobile.png`
- `boards/stage1-shadow-crop-opacity16-desktop.png`
- `boards/stage1-diagonal-band-desktop.png`
- `boards/stage1-front-back-opacity16-desktop.png`
- `boards/stage1-view-matrix-opacity16-desktop.png`
- `boards/stage1-state-matrix-tight1024-desktop.png`
- `boards/stage1-resolution-comparison-desktop.png`
- `boards/shadow-camera-bounds.png`

### 動き

- `gifs/stage1-candidate-cycle-opacity16-desktop.gif`
- `gifs/tight1024-state-cycle-desktop.gif`
- `gifs/camera-rotate-zoom-tight1024-desktop.gif`

camera rotate／zoom GIFは実ランタイムのcamera presetとdistance multiplierを使った状態安全なoffscreen captureから生成した。製品Scene、camera、controls、model transformを変更していない。

### レポート

- `candidate-config.json`
- `state-bounds.json`
- `caster-bounds.json`
- `receiver-bounds.json`
- `light-space-bounds.json`
- `shadow-camera-bounds.json`
- `completed-watch-bounds.json`
- `texel-density.json`
- `shadow-refresh-timeline.json`
- `rectangular-edge-metrics.json`
- `diagonal-band-metrics.json`
- `front-back-metrics.json`
- `performance-summary.json`
- `regression-results.json`
- `protected-paths.json`
- `stage1-summary.json`
- `stage2-status.json`
- `decision-summary.json`
- `capture-inventory.json`
- `evidence-manifest.json`

## 保護結果

queryなし、Phase 3C.1-only、3C.2-only、3C.3-only、Phase 3A baseline／D2a／D2c3、Phase 3B.1の6候補を計26条件で比較し、byte数とSHA-256は全件一致した。Geometry、Material、fog、透過、camera、DPR、selection、audio、APP_VERSION、試験閾値は変更していない。

## 状態

- baseline: `HUMAN_REJECTED_RENDERING_BASELINE`
- shadow-off: `HUMAN_DESIGN_HOLD_TECHNICALLY_NONFINAL`
- state-tight-512: `REJECTED_SHADOW_RESOLUTION`
- state-tight-1024: `REJECTED_SHADOW_RESOLUTION`
- D2c3: `RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`
- Issue #2: Open
- PR #5: Open／Draft
- default adoption: false
