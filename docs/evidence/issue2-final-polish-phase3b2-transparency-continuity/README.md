# Issue #2 Final Polish Phase 3B.2 evidence

## 結論

このフォルダはShadow-off／D2c3の2 baselineで構造透過の連続性を比較したquery限定証跡である。最終状態は`TRANSPARENCY_CONTINUITY_LIGHTWEIGHT_ROUTE_EXHAUSTED_OIT_DECISION_REQUIRED`、技術finalist 0件、既定採用0件である。

## 由来

- main: `293626f13a50224924f8e3ac229a1fc4077ad7a7`
- base: `4f9e3f14f66317c4ce363a3393639b15ca3b05f1`
- implementation: `da600b11552185129a9f3e16f2ab55002df8972a`
- branch: `feature/issue2-final-polish-phase3b2-transparency-continuity`
- APP_VERSION: `v3.15.0`
- capture: same-origin unsandboxed iframe with actual Three.js offscreen WebGL capture

## 内容

- `raw/`: 2 baseline × 4 continuity × 2 viewportの実WebGL PNGと、13 opacity、smoke、selection、split／explode／exterior OFF
- `boards/`: 100／99／98、56／55／54／53／52、候補、内部視認、選択、深度順の比較ボード
- `gifs/`: opacity連続変化、実pointerによる回転、split／explode／restore
- `motion/`: 回転GIFの実ブラウザframe
- `performance/`: 10秒シナリオの生データ
- `protected/`: 21 path × 2 viewportの固定base比較
- `reports/`: inventory、property／screen continuity、内部視認、選択、性能、回帰、Stage判断
- `evidence-manifest.json`: 自己参照を除くclosed-world SHA-256 manifest

## 候補判断

- `issue2-current`: `RETAINED_DIAGNOSTIC_ONLY`
- `issue2-stable-depth-off`: `REJECTED_PERFORMANCE`
- `issue2-stable-depth-base`: `REJECTED_INTERNAL_VISIBILITY`
- `issue2-group-stable-depth`: `REJECTED_PERFORMANCE`

全固定property候補は13 opacityで`transparent`／`depthWrite` toggle 0、Material replacement／UUID change 0である。しかし、`stable-depth-base`はopacity 16%内部視認性、`stable-depth-off`はD2c3 wheel性能、`group-stable-depth`はD2c3 selected性能を満たさない。

## 試験状態

- candidate-specific browser failure: 0
- UI 22/22
- HUD 57/57
- trusted audio 23/23、buffer 6/6
- A.7 9/9
- 禁止干渉 0/0
- protected path 42/42 byte-identical
- console error／warning 0/0
- Stage 2: 未実施（技術finalist 0）
- 物理iPhone: 未実施
- OIT: 未実装

全ファイルは`evidence-manifest.json`でbytes／SHA-256を検証する。比較ボードやGIFは元の実WebGL captureから生成し、製品Sceneへ診断Geometryを追加していない。
