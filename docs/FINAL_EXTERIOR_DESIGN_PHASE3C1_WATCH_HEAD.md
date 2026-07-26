# Phase 3C.1 正式時計本体意匠 実装報告

## 結論

Phase 3B.2承認Head `98d83781aa7aa001836a0d57f1ad6e3d058a15c4`から、正式時計本体意匠のquery限定候補を実装した。初回と第2候補はいずれも人間確認で非承認となり、状態を`HUMAN_REVIEW_FAILED_PHASE3C1_SECOND_REVISION_REQUIRED`へ更新した。本書は、その指摘を反映した第3候補を記録する。起動条件は`?exterior=balanced&watchHead=phase3c1`で、通常URLへPhase 3C.1 Object3Dは追加せず、固定Baseと237,334 byte／SHA-256 `a114aca62e07f03c9d67e7ada497b05f8007030a8b003f2171e4a8d82555ee5c`でpixel exactを確認した。

第3候補はGeometry、表示family、選択・透過、UI／HUD、通常path、性能A/Bを実ブラウザで検証した。Desktop総合では、白系文字板によりA.5前後面明度差だけが既存30%閾値を超え、音声統合は同一環境のPhase 3B.2 Baseと候補の双方でtimeoutした。閾値、照明、製品コードを試験へ合わせて変更せず、この2項目を未達として証跡へ残す。検証状態は`THIRD_CANDIDATE_AUTOMATED_REVIEW_PENDING_PC_AND_PHYSICAL_IPHONE`、採用判断は`THIRD_IMPLEMENTATION_CANDIDATE_NOT_DEFAULT`とする。

## 構成と由来

- リポジトリ：`showhey04-oss/mechanical-watch-3d`
- Baseブランチ：`feature/final-exterior-balanced-phase3b2`
- Base SHA：`98d83781aa7aa001836a0d57f1ad6e3d058a15c4`
- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- 第3候補実装・ブラウザハーネス基準：`7b660b768580d7dd1a7abe7c2c8520dc9f066985`
- APP_VERSION：`v3.15.0`
- Phase 3B.2人間承認：`HUMAN_ACCEPTED_PHASE3B2_WITH_MANDATORY_PHASE3C_REFINEMENTS`

## 正式デザイン基準

第3候補は、共通`#E9EDF0`シルバーのケース／ベゼル／ラグ／裏蓋／りゅうず、側面で認識できるドーム風防、白に近いアイボリー文字板、大型ポリッシュバーインデックスと丸型分目盛、面のあるシルバー時分針、ブルースチール調小秒針、6時小秒、細身の限定オープンハート縁で構成する。ドレスウォッチ寄りだが、古典装飾を増やさず、全面スケルトンまたはトゥールビヨン風にはしていない。

参照画像は雰囲気と構成だけの参考であり、Geometryの模写元ではない。特にオープンハートは、画像上の名目的な9時位置ではなく、実モデルのテンプ中心へ合わせている。

## オープンハート監査

### 実測位置

- テンプworld中心：X 7.700／Y 1.730／Z 1.800
- 文字板投影：X 7.700／Z 1.800
- 時計中心からの半径：7.907
- 12時基準時計角：76.842457°（実モデルでは約2時34分方向）
- 視覚オフセット：0
- 中心誤差：0

参照画像の「9時付近」より実Geometryを優先した。この差は意匠の不具合ではなく、機構を移動せずに実テンプを見せるための設計判断である。

### 遮蔽と限定開口

事前判定は`B_PARTIAL_PLATE_OCCLUSION`で、物理文字板と地板が遮蔽物であった。中心の下側耐震軸受、スタッフ、テンプ受、支持、石、ねじ座を保持するため、地板へ半径1.320、中心オフセット1.900の円形窓を2個設けた。中央軸受ランド余裕は0.100である。

- 文字板開口径：6.600
- 縁リング幅：0.260
- 縁外半径：3.560
- 文字板面積比：3.5559%
- プレート窓／文字板開口面積比：32.0000%
- 小秒とのclearance：3.1894
- 最近接インデックスとのclearance：1.3605
- 分針との軸方向clearance：0.390
- actual +Y Raycaster：709 sample
- 意図した機構のfirst-hit率：0.165021
- テンプfirst-hit率：0.133992
- 脱進機first-hit率：0.001410

開口は実テンプ・ヒゲゼンマイと脱進機の一部を理解するための教育表示である。機構移動、部品非表示、固定透明化、回転ケージは使用しておらず、トゥールビヨンでも製造用設計でもない。

## Geometry

文字板は外径35.000、Y=-2.020～-1.820の物理的な閉合indexed Geometryとし、中心、小秒、オープンハートの穴を持つ。半透明板を重ねた疑似窓ではない。地板の限定開口もShape holeによる閉合indexed Geometryで、CSGを使用していない。

風防はclear diameter 30.600、Y=-3.460～-2.860の保護包絡内で中央だけを緩やかに膨らませた閉合profile Meshである。外装総厚8.695とベゼル保持境界を維持する。

Geometry監査では、文字板、地板置換Mesh、風防、オープンハート縁、バーインデックス、丸型分目盛、3針、小秒表示を含む17対象でfinite、indexed、closed、outwardを確認し、退化・重複・反転triangle、non-manifold edge、winding mismatch、reversed normal、非有限法線を0とした。`polygonOffset`、`renderOrder`、CSGによる隠蔽は使用していない。

## 表示意匠

- 主文字板：色`#F2EDE5`、metalness 0、roughness 0.88。emissive、MeshBasicMaterial、露出変更を使わない白系アイボリーである
- 小秒文字板：色`#F5F1EA`、metalness 0、roughness 0.88
- インデックス：radial 1.820／tangential 0.440／厚さ0.230のfaceted bar。12時は1.08倍のダブルバー、中央gap 0.260、6時は小秒と競合するため省略し、S86 index円25.456を維持
- 分目盛：丸点60個。minor径0.165、5分位置径0.250、厚さ0.045
- 分針：長さ12.040、最大幅0.560、先端幅0.060、中央稜線0.120
- 時針：長さ8.600、最大幅0.780、先端幅0.080、中央稜線0.130
- 小秒針：長さ3.268、最大幅0.130、先端幅0.040、中央稜線0.070、色`#2A5572`
- 小秒表示：中心[0,-5.600]、S86目盛基準径7.740、視覚recess径8.500、狭いbevel 0.080、12主要目盛＋48補助目盛。太い独立outline torusは使用しない
- オープンハート縁：内径6.600／外径7.120／radial幅0.260／top lip 0.160／高さ0.130の単一閉合profile Mesh
- 主外装金属：base color `#E9EDF0`、metalness 0.78～0.80、roughness 0.19～0.23。分類は`EDUCATIONAL_UNIFIED_SILVER_VISIBILITY_MATERIAL`で、roughness差0.04、metalness差0.02
- ドーム風防：中心Y=-3.460、外周Y=-2.920、内面Y=-2.860を維持する強調profile。候補専用`MeshPhysicalMaterial`はroughness 0.06、transmission 0.96、ior 1.47、thickness 0.60で、外装総厚8.695は不変

3針のpivot、position、rotation、scale、回転符号、位相は変更していない。分針―筒かな、時針―時針管、小秒針―四番車軸の1:1拘束と取付中心距離0を維持する。

## 部品登録と透過

文字板、バーインデックス、分目盛、小秒表示、小秒目盛、オープンハート縁、オープンハート開口、ドーム風防、分針、時針、小秒針、りゅうず、限定開口地板を既存の部品選択・HUD・学習表示へ登録した。

構造透過は既存方式へ統合し、100%→50%→16%→100%で復元する。16%では内部の設定車2を選択できる。通常の選択・Raycaster基盤、透過材質切替、DPR、照明、影を変更していない。

## 分離・分解表示

不具合原因は、Phase 3C.1 rootと置換部品が既存`sideSplit`／`explode`のtransform契約へ登録されていなかったことである。新しいUIや表示基盤は作らず、FRONT／CORE／BACK／PLATEを既存系統へマッピングした。

- FRONT：風防、ベゼル、rehaut、文字板、index、分目盛、小秒表示、オープンハート縁、3針。分離100%でY=-5.500
- CORE：ケース胴、4ラグ、りゅうず、ケースチューブ、2スプリングバー、Phase 3B.2ストラップ／仮バックル。分離時は中央基準
- BACK：裏蓋リング、透明窓、ムーブメント保持リング。分離100%でY=+5.500
- PLATE：限定開口地板3部品。既存地板／機構側の挙動を維持

分解100%では既存方向と倍率に従い、復元後はposition／quaternion／scale誤差0（許容1e-7）、parent／visibility／material／selectionを基準状態へ戻した。Desktopと390×844の双方でsplit、explode、combined、restoreを検証した。

## 回帰と性能

- Node：154/154
- Phase 3C.1 harness：Desktop／390×844とも全check合格（表示familyと完全復元を含む）
- desktop総合：85/86。白系文字板によるA.5前後面明度差のみ未達（Baseは86/86）
- 390×844総合：88/88
- PR #3 UI：Desktop 20/20、390×844 22/22
- PR #4 HUD：Desktop 45/45、390×844 57/57
- v3.14作動音：Node試験は合格。実ブラウザ統合は候補とBaseの双方で同じwait timeout
- S86、Phase 2C 6.645／3.190／6.745、A.7、3針拘束：維持
- 位置1／位置2の機構・外装・装着部禁止干渉：0／0
- console error／warning：0

Desktop／390×844で10秒idle、3秒pointer、3秒wheelをPhase 3B.2とA/B比較した。全条件で既存絶対閾値と差分基準へ合格した。Desktop idleは平均fps差-4.217%、p95差+0.100ms、mobile idleは+0.005%／-0.800msで、風防`MeshPhysicalMaterial`の停止条件（mobile fps -5%超またはp95 +2ms超）に該当しない。

## 既知制約

既存の保護されたshadow rigは、大面積のアイボリー文字板上で大きな矩形影境界を生じる。Phase 3C.1ではfrontKey、shadow camera／map、castShadow／receiveShadow基盤、lighting、tone mapping、exposure、fog、transparent、depthWriteを変更していない。100%→99%のtransparent不連続、55%→54%のdepthWrite不連続、透過時の暗部・深度順、PC／iPhone間の照明差も、PR #5のD2c3を取り込まずOpenのIssue #2へ分離したままとする。

PCと物理iPhoneでは、色、金属階調、開口位置、テンプ可視性、小秒、針、選択、100／50／16%透過、回転、ズーム、巻上げ、時刻合わせ、秒停止、作動音を人間確認する。

物理iPhoneでは`PHYSICAL_IPHONE_MILD_WARMING_AFTER_15_MIN`を観察事項として記録する。progressive frame drop、Safari reload、audio failure、touch failure、thermal warningは確認されていないため現時点では非ブロッキングだが、最終統合レビューでは15分連続確認を必須とする。

## Phase 3C.2 必須バックログ

Phase 3B.2の構造プレースホルダは維持し、Phase 3C.1へ中途半端な革意匠を混在させていない。後続Phase 3C.2では次を必須とする。

- 黒革、軽い革シボ、控えめなステッチ、コバ処理
- 実用的な12時側／6時側長さ
- スプリングバー巻込み部と取付包絡
- 6時側穴列、定革、遊革
- 尾錠枠、つく棒、取付バー
- 尾錠側ストラップ巻込み部と穴列の位置整合

## 証跡

静止画、review GIF、実ブラウザ結果、性能A/B、通常path比較、closed-world manifestは[Phase 3C.1証跡](evidence/final-exterior-design-phase3c1/README.md)を参照する。
