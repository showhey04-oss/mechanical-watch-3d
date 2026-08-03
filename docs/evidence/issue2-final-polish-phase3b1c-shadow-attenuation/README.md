# Issue #2 Final Polish Phase 3B.1c evidence

## 判定

`ISSUE2_PHASE3B1C_AUDIT_ACCEPTED_SHADOW_ROUTE_EXHAUSTED`

このフォルダは、完成外装query限定のopacity-coupled shadow attenuation
4候補を比較した合格済み監査証跡である。技術結果は
`ISSUE2_SHADOW_ROUTE_EXHAUSTED_NO_TECHNICAL_FINALIST`で、通常pathへ
候補を採用していない。

## 生成元

- main：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- PR #20固定Head：
  `961fb16ec8c0b55b4d940861659e22733537d813`
- Phase 3B.1c実装・監査基盤：
  `8a0fac5149708a906d02df103403f6e0706db9f7`
- APP_VERSION：`v3.15.0`
- capture：same-origin unsandboxed iframeから実Three.js sceneを
  offscreen WebGLRenderTargetへ1回描画

## 内容

- `stage0/`：5 caster群 × 2 viewport × 12条件のattribution画像
- `raw/`：Stage 1の832 PNG
- `motion/`：候補別・viewport別のカメラ状態画像
- `protected/base/`：PR #20固定Headの34 protected path画像
- `protected/current/`：Phase 3B.1cの34 protected path画像
- `boards/`：同一条件、中央境界、斜め帯、前後面、隣接opacity、
  peter-panning、曲線、強度表
- `gifs/`：連続opacity、回転／ズーム、split／explode
- `reports/`：生run、定量集約、回帰、性能、判断
- `evidence-manifest.json`：自己除外closed-world SHA-256 manifest

## Stage 0

両viewportで589 Mesh、553 caster、553 receiverを確認した。
主要caster群は`dial-exterior`で、構造透過対象135件のうち106件が
caster／receiverと重複する。`customDepthMaterial`と`alphaTest`は
0件、opacity 100%／16%の対象数は同一、診断後の状態復元はtrueである。
この結果によるshadow depth仮説は`SUSPECTED_NOT_PROVEN`であり、
内部原因を証明したものとは扱わない。

## Stage 1

- 4候補
- Desktop 1280×720／Mobile 390×844
- navy／obsidian
- 各52条件
- 合計832 PNG
- console error／warning 0

attenuationは中央矩形境界と広い斜めbandを低減し、性能差分に合格した。
前後面のbaseline比悪化最大0.072299が上限0.05を超えたため不採用。
attenuation＋biasは同ゲートに加えてworst FPS -24.153%、
worst p95 +15.2msで不採用である。

## 回帰

- protected path：34/34 byte／SHA-256一致
- Node：253/253
- 390×844総合：88/88
- Desktop／Mobile UI：合格
- Desktop／Mobile HUD：合格
- 390×844 trusted audio gesture：合格
- Desktop総合：既存A.5前後面30%項目のみ失敗
- Desktop trusted audio：1280 iframeの操作ボタンがアプリ内ブラウザ
  可視幅外となる環境制約
- 試験閾値変更：なし

## 未採用

- Shadow-off：
  `HUMAN_DESIGN_HOLD_TECHNICALLY_NONFINAL`
- D2c3：
  `RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`
- 技術finalist：0
- Stage 2：未実施
- PC候補人間比較：未実施
- 物理iPhone：未実施
- baseline：`HUMAN_REJECTED_RENDERING_BASELINE`
- shadow実験経路：終了
- 次工程：shadow経路を再開せず、保持候補の透過連続性を評価

Issue #2はOpen、PR #5はOpen／Draftを維持する。
