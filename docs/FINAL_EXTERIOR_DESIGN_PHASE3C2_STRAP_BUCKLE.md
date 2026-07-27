# Phase 3C.2 正式黒革ストラップ・尾錠意匠

## 状態と由来

- 状態：`PHASE3C2_IMPLEMENTATION_CANDIDATE_PENDING_HUMAN_CONFIRMATION`
- Base：`feature/final-exterior-balanced-phase3c1-watch-head`
- 人間承認済みPhase 3C.1 Head：`4de3c018f52ea88d1cbe5f4ad0c44166f7f89914`
- 実装基準：`b021619d48ecac0bea618273a2901ea0a856eac6`
- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- APP_VERSION：`v3.15.0`
- query：`?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2`

Phase 3C.1は`HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS`として継承する。小秒文字板の選択性、A.5前後面輝度差、矩形影、透過不連続、PC／iPhone照明差、表裏分離・断面クリップのUX判断は本工程で変更しない。

## 実装

Phase 3B.2の2本の構造確認用ストラップと簡略バックルをquery時だけ非表示にし、4ラグと2スプリングバーを再利用する。Base側のGeometry、Material、初期visibilityは書き換えず、候補解除・状態復元で戻す。

- 12時側中心線長：75.000
- 6時側中心線長：115.000
- 幅：19.700から16.000へ単調減少
- 厚さ：2.600から中央2.300、端部2.050へ単調減少
- 中心線：最初の12.000をほぼ直線とし、その後を正Y手首側へ同じ曲率言語で曲げる。曲率符号反転、波打ち、自己交差は0
- 自由端：左右対称の穏やかな丸端
- 穴列：直径2.000、pitch 7.000、自由端から24.000〜66.000の7つの実貫通穴
- ラグ側ポケット：内径相当1.800、バーから半径方向0.150の実トンネル
- 尾錠側巻込み：取付バーを囲む実トンネル
- 定革・遊革：独立した閉合loop、ストラップclearance 0.150
- 尾錠：外幅19.000、内幅16.600、外長15.500、内長12.800の枠、径1.200の取付バー、長さ13.000の静的つく棒

穴・巻込み・枠はCSG、透明disc、黒い面による偽装を使わず、実開口と内周壁を持つindexed Geometryである。締結、遊革スライド、革変形、ばね挙動はアニメーションしない。

## Material

- 上面：`#151311`、metalness 0、roughness 0.74
- 裏面：`#27221E`、metalness 0、roughness 0.80
- コバ：`#0B0908`、roughness 0.63
- ステッチ：`#2B2824`
- シボ：128×128 procedural DataTexture
- 分類：`EDUCATIONAL_PROCEDURAL_CALF_LEATHER`

外部画像アセット、強いクロコ型押し、厚いパッド、大型ロゴ、派手なコントラストステッチは追加していない。繊維、耐久、製造公差、防水、実締結強度は`UNVERIFIED_MANUFACTURING_INTERFACE`である。

## 接続・干渉

意図接触は禁止干渉から分離する。

- スプリングバー ↔ 革ポケット：`INTENDED_STRAP_BAR_CONNECTION`
- 革ポケット ↔ ストラップ：`INTENDED_STRAP_BODY_WRAP_CONNECTION`
- 尾錠枠 ↔ 取付バー：`INTENDED_BUCKLE_FRAME_BAR_CONNECTION`
- つく棒 ↔ 取付バー：`INTENDED_BUCKLE_TANG_PIVOT`
- 尾錠側巻込み ↔ 取付バー：`INTENDED_BUCKLE_STRAP_WRAP`

位置1／位置2の禁止干渉は0件。Geometry監査では非有限値、退化、重複・反転triangle、non-manifold edge、winding mismatch、非有限法線、面積付きcoplanar overlap、z-fightingを0とした。

## 選択・表示状態

2本のストラップ、3巻込み部、定革、遊革、尾錠枠、つく棒、取付バーの10部品を登録する。穴、ステッチ、コバは独立選択対象にしない。全登録部品で強調、HUD、学習タブ同期を確認し、opacity 16%で内部の設定車2を選択できる。

Phase 3C.2部品は既存「外装」グループのCORE familyに属する。外装OFF、split、explode、opacityを合成し、復元誤差を1e-7以下とする。針・りゅうず・内部機構は外装OFF対象外のまま維持する。

## Bounds・カメラ・性能

- Phase 3C.1 bounds size：39.599998 × 32.684998 × 88.162014
- Phase 3C.2 bounds size：19.700001 × 50.182528 × 114.096037
- combined bounds size：39.599998 × 54.492528 × 114.096037
- combined bounding radius：66.248587
- 全長review用推定distance multiplier：Desktop 3.668440、390×844 1.618412

カメラ、near/far、fog、DPR、照明定数は変更していない。既定フレーミングは時計本体を保護する。Desktopでは既存maxDistance／fogとの組合せにより単一frameの全長reviewに限界があるため、実runtimeの上側・本体・下側captureを並べた比較板を補助証跡とする。これは製品側のカメラ変更や全長表示の偽装ではない。

Desktop／390×844のidle、pointer、wheelは絶対・差分基準に合格し、reversal 0、stop-then-jump 0、wheel monotonic、transform invariantを維持した。Desktop総合で残るA.5前後面明度差は承認済みPhase 3C.1にも同じIDで再現し、Phase 3C.2固有回帰ではない。

## 判断

自動回帰と実ブラウザ証跡は完了したが、正式意匠の既定採用は行わない。次をPC／物理iPhoneで確認するまでDraftを維持する。

- 全長と時計本体の比率
- 12時／6時側の巻込みとラグ接続
- 7穴、自由端、定革・遊革
- 尾錠枠、つく棒、取付バー
- 黒革シボ、同系色ステッチ、コバ
- 回転、ズーム、選択、opacity、外装ON／OFF、split／explode
- りゅうず位置1／2、巻上げ、時刻合わせ、秒停止、作動音
- 15分連続使用時の発熱

証跡は[Phase 3C.2 evidence](evidence/final-exterior-design-phase3c2/README.md)を参照する。
