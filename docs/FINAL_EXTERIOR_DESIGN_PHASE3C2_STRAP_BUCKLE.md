# Phase 3C.2 正式黒革ストラップ・尾錠意匠

## 状態と由来

- 状態：`LUG_DESIGN_REFINEMENT_TECHNICALLY_RESOLVED_PENDING_HUMAN_DESIGN_CONFIRMATION`
- Base：`feature/final-exterior-balanced-phase3c1-watch-head`
- 人間承認済みPhase 3C.1 Head：`4de3c018f52ea88d1cbe5f4ad0c44166f7f89914`
- 最終局所修正作業開始Head：`752418e72d3bb7b1dd86952638a3bb85fdf6d582`
- lug-case continuity実装基準：`2a9cfe31de83c631e6d99d50851f2cb4463684dc`
- surfacing修正作業開始Head：`9b55d5d3971ef456de5474b3bff6d3f26d6879f8`
- surfacing実装基準：`00983f49b4dea623247e211cca54f3aac3f559ec`
- 意匠精査作業開始Head：`832d33a941af7f92ba10ae81079af09e59410e37`
- 意匠精査実装基準：`5d51a74a21b12185fb854f9348e060c8eab440d5`
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

## refined lugの接続とsurfacing最終局所修正

`strapStyle=phase3c2`時だけPhase 3B.2の4ラグを非表示にし、同じ保護アンカーを使うrefined lug 4本へ置き換える。Phase 3C.1-only pathでは既存ラグを維持する。

- 分類：`PHASE3C2_REFINED_LUG_SURFACING_FINAL`
- lug-to-lug：46.600
- ラグ外端：Z ±23.300
- ラグ間：20.000
- スプリングバー中心：Y 2.800、Z ±21.800
- root profile：`CASE_RADIUS_MATCHED_ROUNDED_SUPERELLIPSE_EASED_SWEEP`
- case埋込み：0.260
- visible edge break：0.055
- root transition長：4.297
- root断面：幅3.400 × 厚さ5.400
- tip断面：幅2.000 × 厚さ2.000
- 長手station：16、断面分割：24、superellipse exponent：2.400
- 幅：rootから70%進行までsmoothstepで2.000へ収束
- 厚さ：45% linear + 55% smoothstepで5.400から2.000へ単調減衰
- 中腹の局所最小／S字反転：0
- 4本ともfinite／indexed／closed／outward
- 退化、重複、反転重複、non-manifold edge、winding mismatch、missing face、coplanar overlap、z-fighting：全て0
- refined lug ↔ case body：意図接続
- refined lug ↔ spring bar：意図接続
- refined lug ↔ bezel／caseback／strap：禁止干渉0（strap最小clearance 0.060889）

前段のlug-case continuity修正で接続自体は改善したが、7 stationの矩形swept prismが中腹のくびれ、面折れ、ボコつきとして残り、ハイライトが上面・側面・下面で途切れて見えた。surfacing修正では、ケース半径に合わせたrootとembed 0.260を維持したまま、16 station／24分割の丸み付き共有頂点断面へ局所置換した。width／thicknessは別のeasingで単調配分し、革巻込み位置より前に内側gapを確保する。ケースGeometry、ケース径・厚さ、lug-to-lug 46.600、ラグ間20.000、外端Z ±23.300、スプリングバー中心は変更していない。

## refined lug意匠最終精査候補

人間確認では接続性は改善した一方、対称なroot断面3.400 × 5.400がケース下側まで張り出し、中腹まで量感が残るため、まだ野暮ったく、でっぷり見えると判定された。今回のquery-only候補は、この意匠指摘だけを対象とする。

- 分類：`PHASE3C2_REFINED_LUG_DESIGN_REFINEMENT_CANDIDATE`
- root断面：幅2.800、front extent 2.200、underside extent 1.300、合計厚3.500
- tip断面：幅2.000、front／underside各1.000、合計厚2.000
- case埋込み：0.290
- 長手station：24、断面分割：36、superellipse exponent：2.200
- 幅：35% linear + 65% smoothstepで進行0.800までにtip幅へ収束
- front：45% linear + 55% smoothstep
- underside：70% linear + 30% smoothstep
- root面積proxy：18.360から9.800へ46.623%削減
- underside relief：rootで1.400
- mid-waist／局所膨らみ：0／0
- width／thickness／front extent／underside extent：全て単調

断面の前面と下面を独立させ、上面のケース接続量を保ちながら下面だけを逃がした。幅の絞りはスプリングバー手前で完了するため、中腹に太さを残したまま先端だけ急に細くする形ではない。4本ともfinite、indexed、closed、outwardで、退化・重複・反転重複・non-manifold edge・winding mismatch・missing face・coplanar overlap・z-fightingは0である。

元の人間参照画像はリポジトリに保存されていないため、証跡の`design-reference-alignment-board.png`は、参照意匠を受けて人間承認済みとなったPhase 3C.1 alignment artifactと今回候補を並べる。単純模写ではなく、承認済み時計本体の軽いドレス感と、caseからtipへ自然に収束するラグの整合を確認するための比較である。

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

Desktop／390×844のidle、pointer、wheel差分は`DIFFERENTIAL_PASS`。最終局所修正で候補のfps低下は最大1.619%、p95増加は最大0.100msであり、5%／2msの差分基準内だった。reversal 0、stop-then-jump 0、wheel monotonic、transform invariantを維持し、試験閾値は変更していない。

最終意匠精査回帰はNode 186/186、Desktop runtime、390×844 runtime、UI 20/20、HUD 57/57、外装表示、選択、A.7、S86、Phase 2C不変を確認した。Desktop browser総合83/86と390×844 browser総合86/88の未達は、開始Headでも再現するA.5明度差とin-app Browser環境のA.6 absolute性能であり、Phase 3C.2固有失敗は0である。Web Audio統合は信頼済みpointer gesture後も開始Headと候補の双方でtimeoutしたため環境制約として分離し、Node音声試験の合格を維持した。

surfacing差分性能は作業開始Head `9b55d5d` と実装基準 `00983f4` を各viewport 3反復で直接比較した。desktopのfps差はidle +0.544%、pointer +0.500%、wheel −1.236%、p95差は最大+0.500ms。390×844はidle +0.473%、pointer −0.019%、wheel −0.132%、p95差は最大0msで、全て5%／2ms差分基準内だった。閾値変更、reversal、stop-then-jump、transform driftは0である。

意匠精査差分性能は開始Head `832d33a` と実装基準 `5d51a74` を同一Browserで各viewport 3反復した。desktopのfps低下は最大0%（全シナリオで同等または微増）、p95増加は最大0.100ms。390×844もfps低下0%、p95増加0msで、5%／2ms差分基準に合格した。全12実行でreversal 0、stop-then-jump 0、wheel monotonic、transform invariantを維持し、閾値は変更していない。

全体の安っぽいCG感、A.5前後面明度差、矩形影、透過連続性は本工程へ混在させず、`DEFERRED_GLOBAL_RENDERING_POLISH_TO_ISSUE_2`としてIssue #2へ保留する。PR #5とD2c3も変更していない。

## 判断

`phase3c2-human-requirement-closure.json`では従来の切れ目、wrap不透明性、局所革質感を技術的に`RESOLVED`とした。`phase3c2-lug-continuity-closure.json`はlug-case接続の履歴を保持する。今回の`phase3c2-lug-surfacing-closure.json`では、自然な量感減衰、中腹のくびれ0、連続ハイライト、保護anchorと禁止干渉0を技術的に`RESOLVED`とした。全体CG感だけを`DEFERRED_TO_ISSUE_2`とする。

`phase3c2-lug-design-refinement-closure.json`では、caseとの視覚統合、全体の重さ、root肩、tipward taper、知覚厚の5項目を実装値と実WebGL証跡により技術的に`RESOLVED`とした。全体CG感だけを`DEFERRED_TO_ISSUE_2`とする。

これは既定採用または人間受入完了を意味しない。`HUMAN_REVIEW_FAILED_PHASE3C2_LUG_DESIGN_REFINEMENT_REQUIRED`の技術ゲートは閉じたが、上品さ・軽やかさは人間の意匠判断を待つ。次をPC／物理iPhoneで確認するまでPR #16をDraftに維持する。

- 添付画像相当角度、正面、斜め、側面で4つのrefined lugがケースから自然に生えて見えること
- 4ラグのハイライトが途中で折れず、中腹のくびれ・ボコつき・S字崩れがないこと
- root幅2.800／合計厚3.500が、ケース腹からtipへ過度な大型化や埋まり込みなく連続していること
- asymmetric underside relief 1.400により側面・斜めで軽く見えること
- 6時側spring-bar tunnelと12時側buckle tunnelの不透明性
- 黒革シボ、ステッチ、コバ、silver金具
- 空白クリック／タップ10/10
- opacity 100→50→16→100
- 外装ON／OFF、split／explode／restore
- 回転、ズーム、選択、時計機能、作動音
- 15分連続使用時の物理iPhone発熱

証跡は[Phase 3C.2 evidence](evidence/final-exterior-design-phase3c2/README.md)を参照する。
