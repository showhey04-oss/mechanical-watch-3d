# 最終外装統合 Phase 3A — 外装インターフェース監査・候補設計

## 結論

Phase 3Aでは通常表示へ外装Geometryを追加せず、現行モデルと最終外装の接続条件を数値化した。ムーブメント外径36.6、S86表示寸法、Phase 2CのY包絡、A.7のりゅうず・巻真配置は変更していない。

3候補はいずれも必須包含条件、円形ケース局所交点、候補チューブの幾何条件を満たす。Codexの推奨はE-BALANCEDだが、状態は`RECOMMENDED_NOT_ADOPTED`である。指掛かりとpull／push操作性は`UNVERIFIED`であり、人間承認までは候補比較履歴として扱い、通常表示へ採用しない。

## 作業境界

- 基準main：`fafd3ae3b9e7224f47320b53c7e635b3bb3b8f58`
- アプリ基準：v3.15.0
- 対象：外装接続条件、候補導出、2D比較、実Three.js基準画像、試験、文書
- 対象外：ケース、ベゼル、風防、物理文字板、裏蓋、ラグ、ストラップの通常Scene Geometry
- 維持：機構中心、Y配置、回転比、3針拘束、S86、カメラ、DPR、照明、影、材質、透過、UI、作動音

## 保護アンカー

| 項目 | 値 | 分類 |
|---|---:|---|
| ムーブメント基準外径 | 36.600 | `PROTECTED_ANCHOR` |
| S86 dial ring径 | 27.692 | `PROTECTED_ANCHOR` |
| S86 index円径 | 25.456 | `PROTECTED_ANCHOR` |
| S86 分針長 | 12.040 | `PROTECTED_ANCHOR` |
| S86 時針長 | 8.600 | `PROTECTED_ANCHOR` |
| S86 小秒表示円径 | 7.740 | `PROTECTED_ANCHOR` |
| S86 小秒針長 | 3.268 | `PROTECTED_ANCHOR` |
| 基礎ムーブメントY包絡 | -2.410～4.235 / 6.645 | `PROTECTED_ANCHOR` |
| 実軸・針ボスY包絡 | -2.470～0.720 / 3.190 | `PROTECTED_ANCHOR` |
| 表示を含むアプリY包絡 | -2.510～4.235 / 6.745 | `PROTECTED_ANCHOR` |
| りゅうず・巻真軸Y | -1.050 | `RUNTIME_DERIVED` |
| A.7 pull travel | 1.350 | `PROTECTED_ANCHOR` |

時計表面は負Y、ムーブメント裏面は正Yである。モデル本体は回転させず、カメラを操作する。

ETA 4.50 mmは`REFERENCE_DATUM_UNRESOLVED / UNVERIFIED`である。現行Box3包絡との差は記述値にすぎず、外装厚さの調整量、製造公差、修理基準には使用しない。

## 値の分類

- `PROTECTED_ANCHOR`：現行機構、S86、Phase 2Cから変更しない
- `RUNTIME_DERIVED`：既存Object3Dまたは保存診断から算定
- `EXTERIOR_DESIGN_CANDIDATE`：教育用3D外装の候補
- `EDUCATIONAL_CLEARANCE_ASSUMPTION`：比較のための正の余裕値
- `DEFER_TO_EXTERIOR_IMPLEMENTATION`：実Geometry実装時に確定
- `UNVERIFIED`：一次資料または実物との対応を未確認

候補値は市販時計寸法の転用ではなく、36.6外径、S86、Phase 2C包絡、A.7配置から式で導出している。各値の式、入力、分類、根拠、リスク、実装依存は`exterior-candidate-matrix.json`に保存した。

## 3候補の主要寸法

| 項目 | E-COMPACT | E-BALANCED | E-EDUCATIONAL |
|---|---:|---:|---:|
| case outer diameter | 39.000 | 39.600 | 40.200 |
| movement cavity diameter | 37.300 | 37.800 | 38.400 |
| radial movement clearance | 0.350 | 0.600 | 0.900 |
| bezel outer diameter | 38.600 | 39.200 | 39.800 |
| dial aperture diameter | 28.200 | 29.000 | 30.200 |
| crystal clear diameter | 28.800 | 29.800 | 31.200 |
| crystal inner / outer Y | -2.860 / -3.610 | -3.060 / -4.010 | -3.360 / -4.510 |
| front hand clearance | 0.350 | 0.550 | 0.850 |
| caseback inner / outer Y | 4.585 / 5.335 | 4.885 / 5.835 | 5.235 / 6.385 |
| rear bridge clearance | 0.350 | 0.650 | 1.000 |
| total case thickness | 8.945 | 9.845 | 10.895 |
| case outer交点X @ stem Z=-4.500 | 18.973666 | 19.281857 | 19.589793 |
| movement cavity交点X @ stem Z=-4.500 | 18.098964 | 18.356470 | 18.665208 |
| 局所case wall軸方向長 | 0.874702 | 0.925387 | 0.924585 |
| crown中心の局所突出 位置1 / 位置2 | 0.826334 / 2.176334 | 0.518143 / 1.868143 | 0.210207 / 1.560207 |
| crown外端の局所突出 位置1 / 位置2 | 1.401334 / 2.751334 | 1.093143 / 2.443143 | 0.785207 / 2.135207 |
| crown tube 外径 / 内径 | 0.900 / 0.480 | 1.000 / 0.520 | 1.100 / 0.560 |
| crown tube環状肉厚 / 軸方向候補長 | 0.210 / 0.874702 | 0.240 / 0.925387 | 0.270 / 0.924585 |
| 旧bounding-radius基準 crown outer projection 位置2 | 2.225 | 1.925 | 1.625 |
| lug-to-lug | 44.000 | 46.600 | 49.200 |
| lug / strap width | 18 / 18 | 20 / 20 | 22 / 22 |

### 厚さ予算

各候補の全厚は次の式で再現できる。

`6.745 + frontHandClearance + crystalThickness + rearBridgeClearance + casebackThickness`

これは教育用3D外装の幾何予算であり、製造クリアランス照査ではない。

## 正面表示インターフェース

安全表示径は、S86 dial ring径、index円径、分針先端径、時針先端径、小秒表示円径の最大値から求める。現行ではdial ring径27.692が最大である。3候補の表示開口はすべてこれを上回り、S86表示を遮蔽しない。

物理文字板blank径、rehaut形状、風防座、ベゼル保持は`UNVERIFIED`または`DEFER_TO_EXTERIOR_IMPLEMENTATION`である。

## Y方向インターフェース

風防内面は分針最前面-2.510より負Y側、裏蓋内面はブリッジ上端4.235より正Y側に置く。全候補で前後クリアランスは正であり、Phase 2C包絡を包含する。

## りゅうず・巻真インターフェース

ケースチューブ軸は現行巻真軸Y=-1.050、Z=-4.500へ一致させる。りゅうず中心Xは位置1で19.800、位置2で21.150であり、1.350のA.7絶対移動を維持する。

円形候補ケースのstem Z=-4.500における局所交点は、`sqrt(radius² − crownStemAxisZ²)`から導出した。case外面交点とmovement cavity交点の差を局所case wall軸方向長とし、候補チューブ軸方向長へそのまま割り当てた。旧`crownOuterProjection`はcase外径半径を基準にする保守的bounding-radius値としてのみ残し、局所突出の判定には使用しない。

| 候補 | case / cavity交点X | 局所wall長 | 位置1 crown中心 / 外端 | 位置2 crown中心 / 外端 |
|---|---:|---:|---:|---:|
| E-COMPACT | 18.973666 / 18.098964 | 0.874702 | 0.826334 / 1.401334 | 2.176334 / 2.751334 |
| E-BALANCED | 19.281857 / 18.356470 | 0.925387 | 0.518143 / 1.093143 | 1.868143 / 2.443143 |
| E-EDUCATIONAL | 19.589793 / 18.665208 | 0.924585 | 0.210207 / 0.785207 | 1.560207 / 2.135207 |

チューブ内径は`2 × (stemRadius + crownTubeRadialClearance)`、環状肉厚は`(outer − inner) ÷ 2`から導出した。外径／radial clearance／内径／環状肉厚は、E-COMPACTが0.90／0.08／0.48／0.21、E-BALANCEDが1.00／0.10／0.52／0.24、E-EDUCATIONALが1.10／0.12／0.56／0.27である。全候補で内径は巻真径より大きく、外径は内径より大きく、肉厚と局所軸方向長は正である。

これらは`geometricCrownProjectionPassed=true`および`crownTubeGeometryCandidatePassed=true`を示すだけである。`crownFingerAccessDecision`と`crownPullPushOperabilityDecision`は`UNVERIFIED`、`candidateReadyForDefaultAdoption=false`を維持する。座、ガスケット、ねじ、圧入、防水、製造公差も`UNVERIFIED`であり、実外装Geometryと人手操作で確認する。機構側の軸や移動量を外装へ合わせて変更しない。

## 比較と推奨

### E-COMPACT

- 長所：外径・全厚・描画面積が最小
- crown interface risk：`LOW_RISK`。位置1の局所crown中心突出が3候補中最大
- 短所：前後・半径方向の余裕が最小で、全体の実装・干渉リスクは`HIGH_RISK`

### E-BALANCED

- 長所：S86の余白、機構観察、外径、ラグ、前後余裕の均衡がよい
- crown interface risk：`MODERATE_RISK`。正の局所突出とチューブ候補を確保
- 短所：指掛かり、pull／push操作性、裏蓋開口、透明外装は実装時の確認が必要

### E-EDUCATIONAL

- 長所：表示開口、風防有効開口、機構観察余裕、モバイル視認性が最大
- crown interface risk：`HIGH_RISK`。位置1の局所crown中心突出が3候補中最小
- 短所：外径・全厚・ラグが大きく、透明面積と将来のIssue #2評価負荷が増える

推奨はE-BALANCED、状態は`RECOMMENDED_NOT_ADOPTED`とする。局所円形交点と正のチューブ候補を確保しつつ、E-COMPACTより全体の実装余裕があり、E-EDUCATIONALより位置1の局所crown中心突出、外径、全厚、透明面積、描画・回帰リスクの均衡がよいためである。

## 証跡

実Three.js基準画像は、同一origin・sandboxなしの監査ハーネスからPhase 2Cの`WebGLRenderTarget`方式を明示呼出しし、通常Sceneを変更せず取得した。

- desktop front：1280×720
- desktop side：1280×720
- mobile front：390×844

候補輪郭は保存PNGへの後処理overlayであり、通常SceneへObject3Dを追加していない。`crown-stem-interface.png`はstem Z、case／cavity局所交点、局所wall長、tube外径／内径、位置1／位置2のcrown中心・外端・局所突出と、操作性`UNVERIFIED`を示す。`exterior-candidate-front-comparison.png`にも局所位置1突出とtube外径を併記した。証跡一覧、SHA-256、生成元は`docs/evidence/final-exterior-interface-phase3a/README.md`と`evidence-manifest.json`を参照する。

## 次工程

人間が候補と比率を確認し、PRをReady化・マージした後だけPhase 3Bの外装実装を開始する。Phase 3Bでは次を再確認する。

- 表示開口とS86の全体比率
- 物理文字板blank、rehaut、ベゼル、風防の接続
- ケースチューブと位置1／位置2の操作性
- 裏蓋開口と機構観察
- 部品選択、透過、照明、影、モバイル性能
- Issue #2の最終調整との分離

PR #5、Issue #2、D2c3はPhase 3Aでは変更・採用しない。
