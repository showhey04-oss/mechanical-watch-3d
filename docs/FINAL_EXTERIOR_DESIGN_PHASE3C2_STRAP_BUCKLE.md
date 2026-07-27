# Phase 3C.2 正式黒革ストラップ・尾錠意匠

## 状態と由来

- 状態：`TECHNICAL_REQUIREMENTS_RESOLVED_PENDING_HUMAN_CONFIRMATION`
- Base：`feature/final-exterior-balanced-phase3c1-watch-head`
- 人間承認済みPhase 3C.1 Head：`4de3c018f52ea88d1cbe5f4ad0c44166f7f89914`
- 再修正作業開始Head：`d3f414350c088250f9de3cc38182d1b3364d1e30`
- 再修正実装基準：`292fb96a858c55a2f6bdd97bb3cff680d36ec671`
- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- APP_VERSION：`v3.15.0`
- query：`?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2`

Phase 3C.2はquery限定の未採用候補である。Phase 3C.1の時計本体、ケース、カメラ、DPR、照明、影、透過基盤、UI、音響、試験閾値は変更していない。Phase 3C.1は`HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS`として継承する。

## 人間指摘の原因診断

人間確認角度を、12時側のみ、6時側のみ、両側、本体のみ、巻込みのみ、wireframe、normal、MeshBasic FrontSide／DoubleSide、object ID、depthで再現した。

切れ目状の線の確定原因は`STRAP_BODY_WRAP_MESH_BOUNDARY`である。旧実装ではストラップ本体と巻込み部が別Meshで、可視上面に0.900 model unitの重なり境界があった。FrontSideとDoubleSideで同じ線が残ったため片面欠落ではなく、UV、bump、Material境界、ストラップ相互の実交差も主因から除外した。以前の`INTER_STRAP_PROJECTION_OVERLAP`自動仮説は、人間確認角度を含む診断によって棄却した。

## 連続ストラップshell

12時側と6時側を、それぞれ1つの閉じたindexed outer shellとして再構成した。

- スプリングバー部：実annular tunnelとストラップ本体を共有頂点で接続
- 尾錠側：実annular tunnelと12時側本体を共有頂点で接続
- 接続：`C1_SHARED_VERTEX_ANNULAR_TUNNEL_TO_STRAP_SHELL`
- 可視上面の重なり：0
- 本体端cap：接続部から除去
- 12時側／6時側：closed true、non-manifold edge 0、退化triangle 0
- 内周トンネル：実Geometryとして維持
- CSG、黒帯、別Material、DoubleSide固定による隠蔽：不使用

休止形状は長さ75.000／115.000、初期直線区間約12.000を維持し、終端接線角を95°／120°に収束させた。曲率符号反転と実交差は0、非ラグ領域の最小surface clearanceは63.575である。これは`EDUCATIONAL_UNFASTENED_STRAP_REST_POSE`であり、革の物理変形シミュレーションではない。

## refined lug

`strapStyle=phase3c2`時だけPhase 3B.2の4ラグを非表示にし、同じ保護アンカーを使うrefined lug 4本へ置き換える。Phase 3C.1-only pathでは既存ラグを維持する。

- 分類：`PHASE3C2_REFINED_LUG_CASE_INTERFACE`
- lug-to-lug：46.600
- ラグ外端：Z ±23.300
- ラグ間：20.000
- スプリングバー中心：Y 2.800、Z ±21.800
- case埋込み：0.170
- visible edge break：0.075
- 4本ともclosed indexed Mesh、non-manifold edge 0
- refined lug ↔ case body：意図接続
- refined lug ↔ bezel／caseback：禁止干渉0

ケースGeometry、ケース径・厚さ、りゅうずclearanceは変更していない。

## Materialと不透明性

- 上面：`#211B17`、metalness 0、roughness 0.71
- 裏面：`#27221E`、roughness 0.80
- コバ：`#0B0908`、roughness 0.63
- ステッチ：`#2B2824`
- bump：128×128 periodic DataTexture、bumpScale 0.065
- roughness map：同じperiodic dataから生成、variation ±0.06以内
- color map／外部画像asset：不使用
- 分類：`EDUCATIONAL_PROCEDURAL_CALF_LEATHER_REFINED`

opacity 100%ではtop／underside／edgeがopacity 1、transparent false、depthWrite true、NormalBlending、alphaTest 0である。6時側spring-bar tunnelと12時側buckle tunnelは各ストラップの閉合shellに統合し、外側shellの欠損と背景透過を除去した。50%／16%では既存の外装透過契約に従い、100%復帰時に元設定を復元する。

金具はPhase 3C.1と同系統のsilver中間階調とし、metalness 0.50、roughness 0.24、envMapIntensity 0.48を維持する。尾錠枠、つく棒、取付バー、定革・遊革、7穴の基本寸法と配置は変更していない。

## 選択・表示・干渉

登録対象はrefined lug 4本、ストラップ2本、尾錠枠、取付バー、つく棒、定革、遊革の11部品である。穴、ステッチ、コバは独立選択対象にしない。

- 全11部品：強調、HUD、学習タブ同期
- opacity 16%：内部の設定車2を選択可能
- Phase 3C.2 blank hit target：0
- 空白クリック／タップ：Desktop 10/10、390×844 10/10
- global Raycaster／選択基盤：変更なし
- 外装ON／OFF、split、explode、restore：合格
- 位置1／位置2の機構・外装禁止干渉：0／0
- transform invariant：true

物理iPhoneの空白タップ10/10は人間確認項目として残す。

## 表示経路・性能・保留

通常pathとPhase 3C.1-only pathでは、Phase 3C.2 Object3D、Material、DOMの追加は0である。承認Base `4de3c018...`と候補を同一Browser、同一固定状態で再取得し、両経路ともPNG bytes／SHA-256まで一致した。

Desktop／390×844のidle、pointer、wheel差分は`DIFFERENTIAL_PASS`。候補のfps低下は最大0.029%未満、p95増加は最大0.200ms、33ms／50ms超過は全て0、reversal 0、stop-then-jump 0、wheel monotonic、transform invariantを維持した。試験閾値は変更していない。

最終回帰はNode 175/175、Desktop runtime、390×844 runtime、UI、HUD、音声23/23、外装表示、選択、A.7、S86、Phase 2C不変を確認した。Desktop browser総合の85/86は、候補と承認済みPhase 3C.1で共通するA.5前後面明度差1件だけであり、Phase 3C.2固有失敗は0である。音声はWeb Audio要件どおり、Desktop／390×844ともスピーカーの信頼済みpointer gestureから実行した。

全体の安っぽいCG感、A.5前後面明度差、矩形影、透過連続性は本工程へ混在させず、`DEFERRED_GLOBAL_RENDERING_POLISH_TO_ISSUE_2`としてIssue #2へ保留する。PR #5とD2c3も変更していない。

## 判断

`phase3c2-human-requirement-closure.json`では、切れ目、lug-case interface、6時側wrap不透明性、尾錠側wrap不透明性、局所革質感を技術的に`RESOLVED`とした。全体CG感だけを`DEFERRED_TO_ISSUE_2`とする。

これは既定採用または人間受入完了を意味しない。次をPC／物理iPhoneで確認するまでPR #16をDraftに維持する。

- 人間確認角度で旧切れ目が消え、連続曲面の陰影だけになっていること
- 4つのrefined lugとケース胴の接続
- 6時側spring-bar tunnelと12時側buckle tunnelの不透明性
- 黒革シボ、ステッチ、コバ、silver金具
- 空白クリック／タップ10/10
- opacity 100→50→16→100
- 外装ON／OFF、split／explode／restore
- 回転、ズーム、選択、時計機能、作動音
- 15分連続使用時の物理iPhone発熱

証跡は[Phase 3C.2 evidence](evidence/final-exterior-design-phase3c2/README.md)を参照する。
