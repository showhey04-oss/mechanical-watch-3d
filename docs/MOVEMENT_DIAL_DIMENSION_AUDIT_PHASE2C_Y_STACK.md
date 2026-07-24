# Phase 2C — Y方向基準面・厚さレイヤー監査

## 範囲

Phase 2Cは既存Object3Dのworld Box3を読取る監査であり、通常Geometry、S86表示寸法、軸中心、Y配置、カメラ、照明、UI、作動音を変更しない。Phase 1証跡も変更しない。

## 実測

同一origin・sandboxなしiframe内の`watchModelDiagnostics`から、desktop 1280×720と390×844を測定した。Y基準面、3包絡、レイヤースタック、公式高さ評価、transform invariantは両viewportで一致し、screen-space値だけが変化した。

| 包絡 | yMin | yMax | 厚さ | 決定部品 |
| --- | ---: | ---: | ---: | --- |
| 基礎ムーブメント | -2.410 | 4.235 | 6.645 | dialWorks / bridges |
| 針取付・突出軸系 | -2.470 | 2.714 | 5.184 | minuteBoss / fourthArbor |
| 文字板・針を含むアプリ | -2.510 | 4.235 | 6.745 | minuteHand / bridges |

## ETA 4.50 mmとの対応

ETA公式4.50 mmは一次情報の高さアンカーとして保持する。ただし、その基準面を現在のレンダリングBox3極値へ対応付けられないため、差分は記述値に留める。2.145 mmを調整量として扱わず、判断は`REFERENCE_DATUM_UNRESOLVED` / `UNVERIFIED`である。

## レイヤー判断

主輪列、脱進機、文字板側輪列、筒かな・時針管・四番車軸、3針は既存の拘束・干渉規則を守る`PROTECTED`。ブリッジ・支持部のみ`LOCAL_REVIEW`、文字板リングとインデックスは物理文字板・風防・ベゼル統合まで`DEFER_TO_EXTERIOR`とする。Phase 2Cでは寸法を変更しない。

実測JSON、viewport比較、画像、SHA-256 manifestは`docs/evidence/movement-dial-y-stack-phase2c/`に保存する。
