# Phase 2C — Y方向基準面・厚さレイヤー監査

## 範囲

Phase 2Cは既存Object3Dのworld Box3を読取る監査であり、通常Geometry、S86表示寸法、軸中心、Y配置、カメラ、照明、UI、作動音を変更しない。Phase 1証跡も変更しない。

## 実測

同一origin・sandboxなしiframe内の`watchModelDiagnostics`から、desktop 1280×720と390×844を測定した。Y基準面、3包絡、レイヤースタック、公式高さ評価、transform invariantは両viewportで一致し、screen-space値だけが変化した。

| 包絡 | yMin | yMax | 厚さ | 決定部品 |
| --- | ---: | ---: | ---: | --- |
| 基礎ムーブメント | -2.410 | 4.235 | 6.645 | dialWorks / bridges |
| 針取付・突出軸系 | -2.470 | 0.720 | 3.190 | minuteBoss / fourthArbor |
| 文字板・針を含むアプリ | -2.510 | 4.235 | 6.745 | minuteHand / bridges |

数値監査の`sourceAuditCommit`は`da473d7d569f1b43b9d6adc04087a0a8011e9951`、明示キャプチャ実装の`captureImplementationCommit`は`c8d59606810026a69ddef1a9a7c4e68bd379cf51`である。

## 実画面証跡

入れ子iframeでは、要求したdesktop viewport 1280×720に対してlive drawing bufferが640×300へ固定された。live aspectは2.1333333333、要求証跡aspectは1.7777777778で一致しない。この状態は`TEST_ENVIRONMENT_NESTED_VIEWPORT_LIMITATION`であり、製品不具合ではない。live canvasの拡大転記は行わない。

代わりに、明示呼出し時だけ同じThree.js rendererとsceneを1280×720または390×844の`WebGLRenderTarget`へ1回描画し、`readRenderTargetPixels`で回収した。通常canvasサイズ、DPR、animation loop、control camera、controls target、モデルObject3Dは変更していない。処理後はcamera、renderer target／viewport／scissor、control状態、モデルworld transform、機構状態を復元し、全不変条件を確認した。

desktop／mobileのPNGは24,000 byte単位のDOMチャンクを個別に回収して再構成し、ブラウザ側と保存後のbyte数・SHA-256・PNG寸法を照合した。注記4画像はdesktop実ランタイムPNGを背景とし、レイヤースタック図だけを`y-layer-stack.json`から独立生成した。

## ETA 4.50 mmとの対応

ETA公式4.50 mmは一次情報の高さアンカーとして保持する。ただし、その基準面を現在のレンダリングBox3極値へ対応付けられないため、差分は記述値に留める。2.145 mmを調整量として扱わず、判断は`REFERENCE_DATUM_UNRESOLVED` / `UNVERIFIED`である。

## レイヤー判断

針取付・突出軸系は組立体proxyではなく、`cannonTube`、`hourPipe`、`fourthDialArbor`と3つの針ボスの実Mesh参照から測定した。主輪列、脱進機、文字板側輪列、これらの管・軸、3針は既存の拘束・干渉規則を守る`PROTECTED`。禁止干渉は0であり、保護規則と干渉件数は別項目として記録する。ブリッジ・支持部のみ`LOCAL_REVIEW`、文字板リングとインデックスは物理文字板・風防・ベゼル統合まで`DEFER_TO_EXTERIOR`とする。Phase 2Cでは寸法を変更しない。

実測JSON、viewport比較、画像、SHA-256 manifestは`docs/evidence/movement-dial-y-stack-phase2c/`に保存する。

## 判断

`dimensionChangeDecision`は`NO_DIMENSION_CHANGE`、公式高さは`REFERENCE_DATUM_UNRESOLVED` / `UNVERIFIED`である。次工程推奨は`FINAL_EXTERIOR_INTEGRATION`だが、PR #11のReady化・マージ後に開始する。Phase 2C内では最終外装を開始しない。
