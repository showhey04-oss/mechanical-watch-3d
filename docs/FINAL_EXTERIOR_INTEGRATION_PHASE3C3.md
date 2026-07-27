# Phase 3C.3 完成外装の統合確認・局所調整

## 結論

Phase 3C.1承認時計本体とPhase 3C.2承認装着部を、query限定の完成時計として統合監査した。Geometry、機構、カメラ、照明、透過基盤、UI、音響、APP_VERSIONは変更していない。

- Phase 3C.1承認Head: `4de3c018f52ea88d1cbe5f4ad0c44166f7f89914`
- Phase 3C.2承認Head: `f245a5a9d68d5205e7609479ffefd711376e4930`
- Phase 3C.2承認状態: `HUMAN_ACCEPTED_PHASE3C2_WITH_DEFERRED_RENDERING_POLISH`
- Phase 3C.3状態: `AUTOMATED_ACCEPTED_PENDING_PC_AND_PHYSICAL_IPHONE_HUMAN_REVIEW`
- 有効query: `?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3`

Phase 3C.3は既定採用していない。Draft PRのReady化・マージ前にPCおよび物理iPhoneの人間確認を行う。

## 局所変更

小秒凹面の空白4点へ、query限定・非描画のselection proxyを追加した。proxyは既存の「Phase 3C.1 小秒表示」へ選択を委譲し、独立部品として登録しない。

- render layer 0: 無効
- `colorWrite`: `false`
- `depthWrite`: `false`
- `castShadow` / `receiveShadow`: `false`
- global Raycaster: 変更なし
- 小秒Geometry、中心、径、針長、四番車軸: 変更なし

同順位の候補では既存のnearest-surface規則を使用する。空白padは小秒針・小秒目盛から空間的に分離し、既存の針・目盛hit surfaceを保持する。

## 統合Object3D監査

Desktop 1280×720と390×844で同じ監査結果を得た。

- Object3D: 195
- Mesh: 171
- Material: 45
- 登録部品名: 38
- orphan: 0
- 二重登録: 0
- visibility不整合: 0
- Material復元不整合: 0
- parent不整合: 0
- query解除時残留: 0
- 非有限transform: 0

split、explode、split＋explode、外装ON/OFF、表示モード切替後の完全復元誤差は`1e-7`以下である。

## 小秒選択

| viewport | opacity 100% | opacity 50% | opacity 16%内部 |
|---|---:|---:|---|
| 1280×720 | 小秒表示 4/4 | 小秒表示 4/4 | 設定車2 |
| 390×844 | 小秒表示 4/4 | 小秒表示 4/4 | 設定車2 |

小秒針、小秒目盛、主文字板、オープンハート縁、風防はそれぞれの既存部品名を維持して選択できる。

## 比率判断

寸法変更は不要と判断した。

- ケース径: 39.600
- ストラップ幅: 19.700
- lug-to-lug: 46.600
- 12時側 / 6時側ストラップ: 75 / 115
- 外装総厚: 8.695
- 尾錠幅: 16.000
- 判断: `NO_DIMENSION_CHANGE`

## モード統合

- 時計モード: 三針1:1拘束、位置1／2、巻上げ、時刻合わせ、秒停止、音響基盤を既存回帰で維持
- 機構観察モード: opacity全条件、外装ON/OFF、split、explode、復元、内部選択を合格
- 学習モード: 既存`partsInfo`を選択HUDと学習タブで共有し、代表部品の名称・機能説明・教育用近似を維持

表裏分離と断面クリップは変更しない。UI判断は`DEFERRED_UNTIL_POST_ISSUE2_UI_SIMPLIFICATION_REVIEW`とし、Issue #2後に詳細表示への移動、初期折りたたみ、廃止の選択肢を人間評価する。

## 保護path

承認済みPhase 3C.2 Headと同一環境でoffscreen WebGL PNGをA/B取得した。

| path | bytes | SHA-256 | 結果 |
|---|---:|---|---|
| queryなし | 237380 | `f3bdd25d543c11a4ae1dc08a3020a60358a85d5d20a90ccff9b8242bc35bd003` | pixel exact |
| Phase 3C.1-only | 165495 | `083c16d2fa561f1c1c605e19fa2195cc75a0ffb827a6a83209686508acac803e` | pixel exact |
| Phase 3C.2-only | 161781 | `15641d4d627d0bfe238b6317b229b25489cd12b966da81434037e1b67faf0095` | pixel exact |

## 性能

Desktop／390×844でPhase 3C.2とPhase 3C.3を同一ブラウザ・同一viewportで比較した。idle、pointer、wheel、opacity 16%、外装OFF、split、explode、学習選択でreversal 0、stop-then-jump 0、wheel zoom monotonic、transform invariantを確認した。

差分判定は`DIFFERENTIAL_PASS`である。390×844 pointerは4反復中央値で、平均fps差`-0.472%`、p95差`+0.450ms`だった。試験閾値は変更していない。

in-app Browserの絶対フレームペーシングは実行中に変動し、製品の絶対基準を安定して満たさなかったため、`ENVIRONMENT_BLOCKED_BY_IN_APP_BROWSER_FRAME_PACING`として差分判定と分離する。

## 人間確認

自動・実ブラウザ証跡は完了した。以下は未完了である。

- PCでの完成時計比率、全長ズーム、選択、外装OFF、opacity、split/explodeの人間確認
- 物理iPhoneでの初期占有率、回転・ズーム、小秒タップ、内部選択、ボトムシート、作動音
- 物理iPhone 15分連続操作と温度観察
- Issue #2で保留した描画品質の採否

物理iPhone用GIFは操作順の案内であり、実機合格を表す証跡ではない。
