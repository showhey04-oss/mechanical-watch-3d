# 受入試験

## A. 起動

- Three.js初期化エラーがない
- 循環参照エラーがない
- 時計が負Y側の文字板正面を既定画面として表示される
- 文字板外周と12・3・6・9時マーカーが既定画面内に収まる
- PCとスマートフォンで操作パネルを開閉できる

## B. 輪列

- 香箱車と中心かなが自然に噛み合って見える
- 中心車と三番かなが自然に噛み合って見える
- 三番車と四番かなが自然に噛み合って見える
- 四番車とガンギかなが自然に噛み合って見える
- 大径車同士が不自然に重ならない
- 車とかなの高さ面が説明可能である
- 通常運転時に必要な輪列が回転する

## C. 文字板側

### S86 v3.15.0採用基準

- dial ring径27.692、index円径25.456、分針長12.040、時針長8.600、小秒表示円径7.740、小秒針長3.268である
- 分針／index半径0.945946、時針／index半径0.675676、時針／分針0.714286を満たす
- インデックス、補助マーカー、12時マーカーの径方向GeometryがS86比較候補と一致する
- dial ring、3針、小秒円が表示範囲外へ突出せず、マーカー干渉が0件である
- 内部機構、四番車軸・小秒中心、Y方向配置、針pivot／position／rotation／scale、背面・巻上げ・文字板側機構表示はmainと一致する
- 物理iPhoneで、S86の文字板表示系寸法、小秒針の識別性、時針・分針の長さ、内部機構と表示系の主従関係、回転、ズーム、選択、作動音を人手確認し、現在工程の表示寸法として合格している
- ケース、ベゼル、風防、物理文字板、インデックス、針を統合する最終外装工程では、表示開口と全体比率を再確認する。この確認は未解決不具合ではなく外装統合の受入項目とする
- 試験状態は `ACCEPTED_WITH_TEST_ENVIRONMENT_LIMITATION`。実施済みmain／PR A/B比較でPR固有回帰は0件だが、in-app Browserのホストアクセス・安全ポリシーにより全ブラウザ試験マトリクスは未完了である。試験閾値の緩和および製品コードによる回避は行っていないため、全回帰completeまたは`ABSOLUTE_PASS`とは扱わない

### Phase 3B.1 E-BALANCED最終視覚的薄型化候補

- `?exterior=balanced`限定でケース胴外径が前端38.900、中央最大39.600、後端38.900となり、Y=-2.860～4.635の指定6点プロファイルを通る
- ケース胴軸方向厚7.495、前後外装突出各0.600、外装総厚8.695を区別し、`0.600 + 7.495 + 0.600 = 8.695`を満たす
- 風防と裏蓋リングの軸方向厚が各0.600で、針前面余裕0.350、ブリッジ後面余裕0.400を維持する
- ベゼルが表示開口29.800、風防有効径30.600、背面外径38.800の単一閉合プロファイルで、保持座R14.900～15.300／Y=-3.240の直後からR18.500／Y=-2.890まで主面全体が単調に傾斜する
- ベゼルの保持座幅0.400以下、外周閉合幅0.900以下、主テーパー被覆率0.85以上、外縁厚0.020～0.050、意図しない水平区間0である
- 裏蓋リングが窓径28.548、軸方向包絡4.635～5.235の単一閉合プロファイルで、保持座R14.274～14.474／Y=5.235の直後からR18.900／Y=4.685まで主面全体が単調に傾斜する
- 裏蓋リングの保持座幅0.300以下、外周閉合幅0.600以下、主テーパー被覆率0.90以上、外縁厚0.040～0.080、意図しない水平区間0である
- ベゼル／裏蓋リングの退化三角形0、非多様体edge 0、非有限頂点・法線・index 0、風防／裏蓋窓／ケース胴／保持リングとの禁止干渉0である
- ムーブメント保持リングが外径37.650、内径36.750、Y=4.035～4.485で、ケース側／ムーブメント側の半径余裕0.075、禁止干渉0、内部選択優先を維持する
- 内周半径18.900を全対象頂点で維持し、局所逃げ後の最小壁厚が0.550以上である
- りゅうず実Meshのコア・外周歯包絡から必要逃げを算出し、固定0.330ではなくgap 0.030を満たす必要最小値を適用する
- 最大径帯を3.450から1.950へ短縮し、前側／後側テーパーを2.160／3.385へ延長する一方、外装総厚8.695、最大径39.600、端部径38.900を維持する
- 必要逃げ0.249174、採用逃げ0.304118、上限差0.025882、位置1実gap 0.030063、位置2実gap 1.380063、最小壁厚0.550000を実Geometryから再測定する
- 旧0.150では物理食い込み0.070748、目標gap込み不足0.100748が残ることを証跡へ保存する
- ケース胴は単一の有限indexed Meshで、閉合性true、退化三角形0、非多様体edge 0、CSG不使用、重複面なしである
- りゅうず―ケース胴を禁止干渉、りゅうず―チューブ／局所接続カラーを意図接触または未検証シートとして分離し、位置1／位置2の禁止干渉を0件に保つ
- 位置1のチューブ外端へのraw gap -0.056857を`PHASE3B1_IMPLEMENTATION_ASSUMPTION`として維持する。指掛かり・pull／push操作性は第1候補の人間確認合格を継承し、第2候補ではりゅうずGeometry・位置・チューブを変更しない
- 透過16%の人間確認合格と第4候補の全面テーパーを継承し、視覚的薄型化と透過50%は最終候補の人間確認で判断する
- 通常URLでは外装Object3D／Geometry／Material／選択／構造透過追加数が0で、S86、Phase 2C、A.7、機構、カメラ、DPR、照明、材質、UI、作動音、APP_VERSIONを変更しない

### Phase 3B.2 基本装着部候補

- Phase 3B.1承認Head `d51e4f8790596f7bc894e8c716edb0d54968d260`をBaseとする積み上げDraftで、mainまたはPR #13へ直接混在しない
- `?exterior=balanced`時だけ4ラグ、2スプリングバー、12時側／6時側ストラップ、簡略バックルを生成し、通常pathの追加Object3Dは0である
- lug-to-lugが46.600、ラグ外端Zが±23.300、左右ラグ外幅が24.400以下、各ラグ見付け幅が2.000である
- ラグ、スプリングバー、ストラップ、バックルの全Geometryがfinite、indexed、closedで、退化・重複・逆向き重複triangle、non-manifold edge、winding mismatchが0である
- スプリングバー中心がZ±21.800／Y2.800、主径1.500、ピン径0.800、主軸長20.000、有効長20.800である
- ストラップ中心線長が12時側42.000、6時側58.000、幅が20.000から16.500へ単調減少し、厚さが2.400で、急な反転または非有限接線を持たない
- バックルの内幅16.800、外幅18.400、内長3.200、外長4.800、厚さ0.650で、ケースと禁止干渉しない
- 新規9部品を個別登録し、ラグ、バー、ストラップ、バックルの選択強調、HUD、学習表示、解除を確認できる
- スプリングバーはラグ／ストラップ非表示または分解状態で選択でき、ストラップとバックルは内部部品を常に奪わないpick priorityである
- 外装100%／50%／16%、family非表示、分解、表裏分離の後にvisibility、position、rotation、scale、材質を正確に復元する
- 透過16%で内部の設定車2を選択でき、新規ストラップが内部選択を妨げない
- ラグ―ケースは`INTENDED_LUG_CASE_CONNECTION`、バー―ラグは`INTENDED_SPRING_BAR_SEAT`、バー―ストラップは`INTENDED_STRAP_BAR_CONNECTION`として禁止干渉から分離する
- 位置1／位置2で機構、既存外装、新規装着部の禁止干渉が各0件である
- Phase 3B.1コア外装bounds、S86、Phase 2Cの3包絡、A.7、三針拘束、小秒中心、機構角、カメラ基盤、DPR、照明、影、UI、作動音が不変である
- Desktop 1280×720と390×844でruntime Geometry・干渉・world boundsが一致し、横オーバーフロー0、パネル開閉後も回転・ズーム・選択を継続できる
- 10秒idle／pointer／wheelで既存A.6絶対閾値と同一環境Phase 3B.1差分基準を満たし、reversal 0、stop-then-jump 0、wheel距離単調、model transform invariantを維持する
- 追加world boundsを記録し、全ストラップ確認には可逆なwheel zoom-outを使用する。既存カメラ定数、near／far、Arcball基盤は変更しない
- ストラップ材質は`STRUCTURAL_PLACEHOLDER_NOT_PHASE3C_STYLE`とし、最終革色・シボ・ステッチ・穴列・コバ・バックル意匠を先行採用しない
- PC自動・実ブラウザ試験に合格後も、物理iPhoneでラグ接続、ストラップ、バックル、回転・ズーム、選択、透過、位置1／2、作動音を人間確認するまでReady化・既定採用しない

### Phase 3C.1 正式時計本体意匠候補

- 初回、第2候補、第3候補の人間非承認と第4候補のPC／物理iPhone合格を保持し、状態を`PHASE3C1_FINAL_MINOR_REVISION_PENDING_HUMAN_CONFIRMATION`とする
- `?exterior=balanced&watchHead=phase3c1`だけで有効になり、通常URLのPhase 3C.1 Object3D追加数が0である
- テンプworld中心[7.700,1.730,1.800]を文字板へ[7.700,1.800]として投影し、中心誤差0、視覚offset 0である
- 開口径6.600、縁幅0.260、文字板面積比3.5559%、小秒clearance 3.1894、index clearance 1.3605である
- 文字板と地板の物理holeを使い、中央下側耐震軸受land 0.100を保持する。機構移動、部品非表示、固定透明化、CSG、トゥールビヨン風ケージを使用しない
- actual +Y Raycaster 709 sampleで機構first-hit率0.165021、テンプ0.133992、脱進機0.001410を記録する
- 文字板、限定開口地板、ドーム風防、profiled rim、index、丸型分目盛、3針、小秒表示の17 Geometryがfinite、indexed、closed、outwardで、退化・重複・反転triangle、non-manifold edge、winding mismatch、reversed normal、非有限法線が0である
- 白系アイボリー`#F2EDE5`、小秒面`#F5F1EA`、安定silver`#E7EAED`（metalness 0.52／roughness 0.20／envMapIntensity 0.35）、1.820×0.440×0.230 faceted bar、12時double marker、半径14.200の0.165／0.250丸型60分目盛を実装し、S86中心・回転拘束を変更しない
- 安定silver対象46 Meshはcandidate-local cloneで、Base Material共有0、選択解除後にopacity 100／50／16%各状態のMaterialへ完全復元する
- 分目盛は通常indexとのclearance 0.437、12時double bar最小clearance 0.381178、表示開口clearance 0.575を確保し、index／double bar／opening／bezel・rehautとの重複が0である
- 小秒はS86目盛基準径7.740を維持し、視覚recess径8.500と狭いbevel 0.080で表現し、太い独立outline torusを使用しない
- ドーム風防はY=-3.460～-2.860、clear diameter 30.600、外装総厚8.695のGeometryとdepth stateを維持し、transmission 0／opacity 0.10／roughness 0.025の非屈折近似で文字板edge contrastを風防非表示時の90%以上に保つ
- 6時通常バーを追加し、12時ダブルを含むバーMesh総数13、小秒凹面clearance 1.500以上、小秒目盛・針掃引との禁止干渉0、6時major dot／表示開口clearance 0.300以上を実Geometryで満たす
- 候補専用「外装」表示グループは25部品を制御し、針3本・りゅうず・内部機構・限定開口地板をOFF対象外とする。OFF時管理対象visible 0、ON時25、split／explode／opacity 50／16%／ボトムシート開閉後のtransform・visibility復元誤差1e-7以下、通常path DOM追加0を満たす
- UIはラベル「外装」だけを表示し、helper DOM 0、タップ領域44px以上、PC／390×844横overflow 0、開閉後の状態保持を満たす
- opacity 100%の文字板空白4点4／4、index、分目盛、3針、小秒、オープンハート縁、風防側面を選択し、opacity 50%の文字板と内部選択、opacity 16%の設定車2、強調、HUD、学習表示、解除を確認できる。文字板priority 1、風防priority 0、global Raycaster変更0、風防pickable維持を満たす
- 透過100／50／16／100で状態を復元し、16%で内部の設定車2を選択できる
- FRONT／CORE／BACK／PLATEを既存表裏分離・分解transformへ統合し、split／explode 100%後のposition／quaternion／scaleを誤差1e-7以内、parent／visibility／material／selectionを基準状態へ復元する
- DesktopはA.5前後面明度差だけが未達、390×844総合とUIは合格する。HUDのfocus-visible／時刻blur順3項目と音声integration timeoutは同一環境のPhase 3B.2 Baseにも同じIDで再現し、今回固有の回帰に分類しない。閾値と製品コードは変更しない
- 通常pathはPhase 3B.2と237,334 byte／SHA-256 `a114aca62e07f03c9d67e7ada497b05f8007030a8b003f2171e4a8d82555ee5c`でpixel exactである
- Desktop／390×844のidle・pointer・wheelが既存絶対閾値と差分基準へ合格し、閾値、DPR、カメラ、照明、影を変更しない
- Desktopの白系文字板によるA.5前後面明度差未達を隠さず記録し、30%閾値、照明、影、tone mapping、exposure、transparent、depthWriteを変更しない
- 矩形影、100%→99% transparent、55%→54% depthWrite、透過時の暗部・深度順、PC／iPhone照明差をIssue #2へ分離する
- 第4候補本体は人間確認合格済みだが、最終微修正は`FINAL_MINOR_REVISION_NOT_DEFAULT_PENDING_HUMAN_CONFIRMATION`とし、PC／物理iPhone再確認前に既定採用、Ready化、マージを行わない
- 表裏分離／断面クリップは削除せず、`UI_SIMPLIFICATION_REVIEW_AFTER_PHASE3C2_AND_ISSUE2`としてPhase 3C.2とIssue #2完了後の人間判断へ残す
- `PHYSICAL_IPHONE_MILD_WARMING_AFTER_15_MIN`を非ブロッキング観察事項として記録し、最終統合で15分連続試験を行う
- Phase 3C.2の黒革、実用長、巻込み部、穴列、定革・遊革、尾錠枠・つく棒・取付バー、シボ、ステッチ、コバを必須後続工程として維持する

### Phase 3C.2 正式黒革ストラップ・尾錠候補

- Phase 3C.1 Head `4de3c018f52ea88d1cbe5f4ad0c44166f7f89914`を`HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS`として継承する
- `?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2`だけで有効になり、通常pathとPhase 3C.1-only pathが承認Headとpixel exactである
- 12時側／6時側の中心線長が75.000／115.000、幅が19.700→16.000、厚さが2.600→2.300→2.050へ単調減少する
- 初期直線12.000、正Y手首側の同一曲率言語、曲率符号反転・自己交差・波打ち0を満たす
- 内径1.800相当の2つの実スプリングバーポケットと尾錠側巻込みが、内周壁を持つ閉合indexed Geometryである
- 6時側に直径2.000、pitch 7.000、自由端から24.000〜66.000の7貫通穴があり、透明disc、decal、黒い円、CSGを使用しない
- 自由端が左右対称の穏やかな丸端で、非有限値・退化triangleを生じない
- 定革・遊革が独立閉合loopで、ストラップとのclearance 0.150を持つ
- 尾錠枠、つく棒、取付バーが独立した閉合部品で、frame/bar、tang pivot、strap wrapを意図接続として分類する
- procedural calf grain、同系色ステッチ、黒いコバを持ち、外部画像asset、革物理、締結アニメーションを追加しない
- 全新規Geometryでfinite、indexed、closed、outwardを満たし、退化・重複・反転triangle、non-manifold edge、winding mismatch、非有限法線、z-fighting、面積付きcoplanar overlapが0である
- 位置1／位置2の禁止干渉0とし、意図接触を禁止干渉へ混在させない
- 10登録部品の選択強調、右上HUD、学習表示が一致し、穴・ステッチ・コバは独立選択対象にしない
- opacity 100／50／16／100、16%内部選択、外装ON／OFF、split、explode、復元誤差1e-7以下を満たす
- Desktop／390×844のidle、pointer、wheelが既存絶対・差分基準へ合格し、reversal 0、stop-then-jump 0、zoom monotonic、transform invariantを維持する
- Desktop総合のA.5前後面明度差は承認済みPhase 3C.1にも同一IDで再現し、Phase 3C.2固有回帰ではない。閾値、照明、影、透過を変更しない
- 小秒選択性、Issue #2、D2c3、表裏分離・断面クリップUXを変更しない
- PC／物理iPhoneで全長、巻込み、穴列、定革・遊革、尾錠、回転・ズーム、選択、透過、機構、作動音、15分連続発熱を確認するまでReady化・マージしない

- 筒かなとミニッツホイールが噛み合って見える
- ミニッツかなと時針車が噛み合って見える
- 筒かな12枚とミニッツホイール36歯のモジュール・ピッチ径・中心距離が一致する
- ミニッツかな10枚と時針車40歯のモジュール・ピッチ径・中心距離が一致する
- 上記2組の複合噛合い中心距離が同じ1.95になる
- 設定車列が時刻合わせ時に連動する
- 位置1でもミニッツホイールから設定車2・設定車1・設定中間車まで従動する
- 分針と時針が正しい比率で動く
- 設定中間車から時針車までが同じ常時噛合い列として正逆転する
- 5組の噛合いで初期状態と正逆転中の歯先対歯溝位相が保たれる
- 筒かな管・時針管・四番車軸と分針・時針・小秒針の角度差が固定である
- 管・軸端と対応する針取付ボスのワールド座標が一致する
- 指定時刻で分針・時針・小秒針の絶対文字板角が一致する
- 位置1・位置2とも禁止3D干渉件数が0になる

## D. 巻上げ・時刻合わせ

- りゅうず、巻真、巻上げ固定クラッチ、二位置移動クラッチが一つの軸系として見える
- 位置1で巻上げ系が動作する
- 位置2で時刻合わせ系が動作する
- 位置2で秒停止する
- 位置1へ戻すと運転を再開する
- 位置1では設定入力―設定中間車境界だけが切れ、設定車列は表示輪列から従動する
- 位置2では設定車列、ミニッツホイール、筒かな、時針車の実Object3Dが連動する
- 位置2では中心車・四番車軸・小秒針を逆駆動せず、四番車軸と小秒針が同時停止する
- 正転・逆転とも定義した実Object3D回転比と一致する
- 位置1→2、位置2→1で中心車を含む主輪列・常時輪列・針の角度がジャンプしない
- 位置2で明示時刻を入力しても保持秒が更新され、位置1復帰時に旧秒へ戻らない
- permanent接続が`run`・`wind`・`set`の3状態すべてで有効になる
- 通常運転と時刻合わせの対象Object3Dを単一resolver/applyだけが更新する
- 位置1でりゅうずから巻真、移動クラッチ、固定クラッチ、短い巻上げピニオン、丸穴車、角穴車、香箱真まで実Object3Dが連続して回転する
- 巻上げピニオンと丸穴車のX/Y直交ピッチ接点が一致する
- 丸穴車40歯と角穴車60歯のモジュール、ピッチ径、中心距離、軸方向帯、歯位相が一致する
- 角穴車の角穴と香箱真角部が1:1で剛結する
- 巻上げクラッチから香箱真まで、上下回転ハブを含む8区間で実3D包絡が接触する
- 丸穴車・角穴車・香箱真の角度をりゅうず入力から直接加算しない
- 巻上げ系Object3Dを`resolveWindingState()`／`applyWindingState()`だけが更新する
- 香箱胴と香箱真を独立Object3Dとして保持し、相対巻上げ量を両者の角度差から導出する
- 機構グラフで香箱胴を主輪列writerのread-only入力、香箱真を巻上げwriter入力として、`+香箱胴 - 香箱真`の二入力蓄力関係を表現する
- 正転で香箱真が負方向へ回り、`香箱胴角 - 香箱真角`の蓄力が増え、香箱胴・主輪列・針へ巻上げ速度を加算しない
- 明示時刻変更や23:59→00:00の香箱胴角ラップを巻上げと誤認して残量を増やさない
- 逆転でりゅうずから巻上げピニオンまでが空転し、りゅうず逆転によって丸穴車・角穴車・香箱真・蓄力が巻戻らない
- 一方向属性は巻上げピニオン―丸穴車境界だけに持たせ、逆転中も後段の噛合い・角穴剛結・蓄力関係を構造的に維持する
- 位置2で巻上げクラッチ境界が切れ、巻上げピニオン以降が停止する
- コハゼとコハゼばねが、異なる2点以上の角穴車実Object3D歯位相へ追従する
- 通常運転で主輪列から巻上げ輪列を逆駆動しない

## E. 脱進機

- 入石・出石と支持柱・ねじ・受が干渉しない
- フォーク、振り石、ガードピンの位置関係が破綻しない
- ガンギ車とアンクルの動きが確認できる
- 四番車とガンギかなが外歯噛合いとして逆方向へ回転する

## F. UI・回帰

- 部品選択時に対象部品自体が強調される
- Raycaster専用Layerに非表示・診断・低透過部品が入らない
- 透過した地板越しに内部歯車を優先選択できる
- ArcballControls終了直後のpointerupで選択されない
- 透過、分解、表裏分離が機能する
- 背景テーマが切り替わる
- 現在時刻同期・手動時刻が機能する
- 現在時刻同期・手動時刻適用後も3本の針と対応する管・軸の固定角度差を保つ
- 現在時刻同期のON・OFFで常時輪列と針の角度がジャンプせず、短い有界遷移後に現在時刻へ収束する
- 履歴グラフが描画される
- 高速で位相名が切り替わる脱進機解析UIは存在しない
- 表面・文字板／裏面・ムーブメント／文字板側機構／ムーブメント側機構／巻上げ伝達の名称が一貫する
- 巻上げ表示モードで固定クラッチ、巻上げピニオン、丸穴車・回転ハブ、角穴車、香箱真、主ゼンマイを実Raycasterで選択できる

## G. 文字板正面・回転方向

- `front = dial side = negative Y`、`back = movement side = positive Y`として定義される
- 正面法線、上、右の基底が単位長・直交で、右×上が正面法線になる
- 起動・リセット・`front`・`dialFront`が負Y側、`back`・`movementBack`が正Y側になる
- 表裏カメラ切替で地板、文字板、丸穴車、角穴車を含むObject3Dのワールド姿勢が変化しない
- 文字板正面で12時が上、3時が右、6時が下、9時が左に投影される
- 12:00で分針・時針・小秒針が12時、12:15で分針が3時、3:00で時針が3時を指す
- 小秒針が00・15・30・45秒で上・右・下・左を指す
- 文字板正面の連続時間増加で3本の針が時計回りに進む
- ムーブメント側では見かけの方向だけが反転し、針Object3D角は変わらない
- 位置2の右入力で時刻が進み、分針・時針が文字板正面で時計回りに進む
- 正面・裏面・通常運転・時刻合わせ・明示時刻・同期の全状態で針と軸／管の1:1拘束を維持する

## H. Refactor A.5 照明・3Dナビゲーション

- 負Y文字板正面と正Yムーブメント裏面を独立キーライトで照らす
- カメラ追従フィルが主キーより十分弱く、自由回転中の黒つぶれを抑える
- 深紺・黒曜石・ウォールナット・ライトギャラリーの全テーマで表裏代表輝度差が30%以内になる
- `OrbitControls`を使用せず、`ArcballControls`で極角制限なく全方向へ回転できる
- `VIEW_UP = DIAL_UP_VECTOR = [0, 0, 1]`で、全プリセットに個別`up`が存在しない
- 表面から同一方向へ360度以上回転し、側面・裏面・反対側面・表面を連続通過する
- 上下方向の両方で極を越え、回転方向の反転・NaN・カメラ消失がない
- 全UIプリセットから左右・上下回転を開始できる
- カメラ操作の前後でroot、地板、文字板、丸穴車、角穴車、中心車、3本の針のワールド変換が変化しない
- 390×844で1本指回転、2本指ズーム・パン、選択抑止、パネル開閉後の操作継続が成立する
- 回転後も表裏で部品を1回のタップ／クリックにより選択できる

## I. Refactor A.6 フレームペーシング・平滑カメラ

- Arcball入力用カメラと描画カメラが分離され、raycasterとcameraFillは描画カメラを使用する
- 描画カメラの位置・Quaternion・target・ズーム距離がrAFで指数補間され、モデルObject3Dを回転させない
- `scaleFactor=1.16`が存在せず、wheel deltaModeを正規化した目標距離方式で18〜120の範囲を連続ズームする
- 同一方向pointer入力で角速度符号が反転せず、停止フレーム直後の過大ジャンプがない
- 10秒のpointer回転で平均55fps以上、p50 18ms以下、p95 25ms以下、p99 40ms以下を満たす
- pointer回転の33.3ms超が5%未満、50ms超が0〜1件である
- 10秒のwheel入力でp95 25ms以下、距離が単調で、最大1フレーム変化量が全変化の8%以下である
- 390×844の10秒回転で平均45fps以上、p95 33.3ms以下、50ms超が2%未満である
- DPRはデスクトップ／モバイル別上限と1.0下限を持ち、p95悪化時の低下と安定後の段階回復に1秒以上のクールダウンがある
- カメラ操作中は影更新を固定し、終了後に影を先行更新してからDPR品質を回復する
- 主ゼンマイGeometry、DOM表示、選択Box3、操作中のヒゲゼンマイGeometryが描画fpsから分離される
- `controls.update()`は初期化・プリセット・resize・診断復元に限り、animation loopから呼ばれない
- フレームp50/p90/p95/p99、33/50ms超過、long task、CPU区間、カメラsmoothness、ズームsmoothnessを診断APIで取得できる
- A.5の73件、A.4の60件、表裏照明、全方向回転、巻上げ、針、干渉、透過、選択を同じ回帰試験で維持する

## J. Refactor A.7 キーレス絶対配置

- りゅうず、巻真、二位置移動クラッチの位置1ローカル基準座標を生成後に固定する
- 3部品を汎用分解表示ライターから除外し、専用配置関数だけが分解オフセット込みの位置を更新する
- animation loopに3部品の`position.x +=`／`-=`が存在しない
- `crownTransition`を0〜1へclampし、目標差1e-5未満で端点へsnapする
- 非有限の遷移値を位置1の座標・機構状態へ安全復帰する
- 位置2で600実rAFフレーム保持し、末尾300フレームの3部品X座標幅が1e-6以下になる
- 位置1へ復帰した3部品の基準座標誤差が1e-6以下になる
- 位置1→位置2→位置1を100回繰り返し、累積誤差・端点幅が1e-6以下になる
- 100往復で3部品のscale・quaternionと機構角・機構トポロジーが変化しない
- 30fps、60fps、120fps相当の10秒後に3部品の最終座標が一致する
- 位置2の3,600フレーム高速保持で座標・メモリ・選択ライト値の有限性・干渉結果が安定する
- 100往復診断の終了時に、呼出し前のりゅうず位置・遷移率・Live Sync・主要機構状態・関連UI状態を復元する
- 位置1・位置2の禁止干渉がともに0件である
- 位置1巻上げ、位置2時刻合わせ、秒停止、針拘束、選択、透過、両面照明を回帰する
- A.6 pointer回転とwheelズームの性能閾値を緩和せず維持する

## K. PR #3 UIアーキテクチャ

- 操作・学習・技術の3タブが均等幅で表示され、初期状態では操作タブだけが選択・表示される
- `tablist`、`tab`、`tabpanel`、`aria-selected`、`aria-controls`、`aria-labelledby`が正しく対応する
- クリック、左右矢印の循環、Home、Endで選択とフォーカスが移動する
- 非選択パネルが`hidden`になり、その内部要素がフォーカス順とレイアウトへ入らない
- フォーカスリングが視認でき、タップ領域が44px以上ある
- りゅうず、再生、視点、時刻、表示操作が操作タブにある
- 選択部品、構造表示、表示グループ、凡例が学習タブにある
- 診断、調速機、動力モデル、履歴が技術タブにある
- 右上と学習タブの選択部品名・説明が同じ元データから一致して更新される
- タブ往復で再生、時刻、位置2、透過、分解、表裏分離、背景、機能表示、診断、調速、動力、履歴、選択部品をリセットしない
- タブごとの本文スクロール位置を保持する
- デスクトップの折りたたみ、モバイルの開閉後も選択タブとスクロール位置を保持する
- 390×844と375×667で横スクロールがなく、本文スクロール中もタブバーがsticky表示される
- モバイルの1本指回転、2本指ズーム・パン、デスクトップの3D回転をタブとパネル操作後も継続できる
- タブ切替処理がanimation loopに入らず、アイドル中にタブ属性を毎フレーム更新しない
- hidden中も履歴Canvasとシミュレーション状態を保持する
- タブ切替前後でモデルWorld姿勢とカメラ状態が変化しない
- 既存86件、A.7 9件、位置2 600フレーム、100往復、30/60/120fps、禁止干渉0/0、A.6性能を回帰する
- 内部機構、レンダリング、照明、影、材質、構造透過方式、Issue #2を変更しない

## L. PR #4 モバイルオーバーレイ・HUD

- 初回起動時に`#info`が`hidden`かつ`aria-hidden="true"`で、空のレイアウト領域を占有しない
- 部品選択成功時だけ`#info`が表示され、`aria-hidden="false"`になる
- 背景選択、表示グループ変更、モード切替、低透過による無効化、リセットで選択情報が非表示へ戻る
- 右上HUDと学習タブの部品名・説明が同じ`partsInfo`と`setPartInfo()`系統から一致して更新される
- 3Dキャンバス上にバージョン表示が常設されず、学習タブ内にモデル名、v3.13.0、PR #3基準情報が表示される
- `<title>`とパネル内の実行時バージョンが一致する
- 表示文字としての「メニュー」がなく、ハンバーガーの実操作領域が44×44 CSS px以上ある
- ハンバーガーはPC・モバイルとも通常時のborder、box-shadow、背景がなく、`focus-visible`だけは明瞭に表示される
- デスクトップ展開時のハンバーガーはパネル外側、折りたたみ時はsafe areaを考慮した左端、再展開時は元位置へ絶対座標で復帰する
- ハンバーガーの`aria-controls`、`aria-expanded`、開閉用`aria-label`が実際のパネル状態と一致する
- EnterとSpaceでパネルを開閉できる
- デスクトップでは幅約365px、縦スクロール、折りたたみ、3タブ、タブ別スクロール位置を維持する
- 390×844、393×852、375×667で開いたパネルが60dvh以下、上部3D表示領域が35dvh以上になる
- モバイルパネルは下端へ固定され、閉じた状態ではハンドルだけを表示する
- `#body`だけが残り高さを使用して縦スクロールし、タブバーがsticky表示される
- safe-area-inset-bottomを維持し、横スクロールが発生しない
- Visual Viewport変化またはソフトキーボード表示時に時刻入力欄が完全に隠れない
- 375〜393px幅で時刻入力右端が本文右端以内に収まり、timeGrid・documentの横オーバーフローが0になる
- `HH:mm`は秒0、`HH:mm:ss`は秒を保持し、空文字・非有限・時分秒の範囲外では時計状態を変更しない
- 時刻入力の`change`で表示時刻・`watchTimeSec`・3針角へ1回だけ反映し、`blur`とボタンclickも同じ適用関数のフォールバックとして動作する
- 入力中は位置2の描画ループが時刻欄を旧時刻で上書きせず、位置1／位置2を往復しても旧時刻へ戻らない
- Live Sync ONから手動時刻を適用すると、内部`liveSync`、チェック状態、モード表示が同じOFF状態へ移る
- 全16個の既存checkboxがvisually-hidden inputを保つ44px以上のトグルカードになり、全カードでON／OFF構造、touch相当pointer、ラベル操作、native inputのフォーカス／Space activation、モデル表示同期と元状態への復帰が成立する。共通disabled表現は`aria-disabled`、cursor、フォーカス抑止を含めて確認する
- パネルを開いた状態で上部キャンバスの1本指回転、2本指ズーム・パン、部品選択、背景タップによる解除が成立する
- 上部キャンバス操作でパネルが意図せず閉じず、パネル操作直後の誤選択抑止を維持する
- パネルを開いたまま位置1巻上げ、位置2時刻合わせ、秒停止、位置1復帰後の運転再開を観察できる
- パネルを閉じた後も3D操作を継続できる
- HUD開閉、部品説明表示、タブ切替だけではモデルWorld姿勢、カメラ、機構角、りゅうず位置、時刻、主ゼンマイ残量、選択対象が変化しない
- PR #3のARIA tabパターン、キーボード操作、hiddenパネル、タブ別スクロール、状態保持、履歴Canvasを回帰する
- Node 33/33、既存デスクトップ86/86、A.7 9/9、位置2 600フレーム、100往復、30/60/120fps、禁止干渉0/0、A.6性能を回帰する
- ライト、影、露出、tone mapping、材質、背景、構造透過、適応DPR、ArcballControls、カメラ、Raycaster候補選定、animation loop、内部機構を変更しない
- Issue #2の照明・透明・影課題を実装せず、IssueをOpenのまま維持する

## Phase 3C.3 完成外装統合

- 有効queryは`exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3`に限定し、queryなし／Phase 3C.1-only／Phase 3C.2-onlyを承認Headとpixel exactに保つ
- Phase 3C.1／3C.2のGeometry、S86、Phase 2C、A.7、機構、カメラ、DPR、照明、影、透過基盤、UI、音響、APP_VERSIONを変更しない
- 小秒凹面の空白4点はDesktop 1280×720と390×844のopacity 100%／50%で小秒表示4/4、opacity 16%では設定車2等の内部選択を維持する
- 小秒針、小秒目盛、主文字板、オープンハート縁、風防の既存選択優先度を維持し、proxyを独立部品登録しない
- 統合Object3Dのorphan、二重登録、visibility不整合、Material復元不整合、parent不整合、query残留、非有限transformを0にする
- 外装ON／OFF、opacity全条件、split、explode、split＋explode、内部選択、表示モード切替を確認し、完全復元誤差を`1e-7`以下にする
- 位置1／位置2の機構・外装禁止干渉0/0、三針1:1拘束、S86、Phase 2C、A.7を維持する
- Node 197/197、Desktop／390×844統合ハーネス、console error／warning 0、manifest closed-worldへ合格する
- performanceはidle、pointer、wheel、opacity 16%、外装OFF、split、explode、学習選択でPhase 3C.2との差分合格、reversal 0、stop-then-jump 0、wheel monotonic、transform invariant、閾値変更なしとする
- 絶対性能のin-app Browserフレームペーシング変動は製品閾値の緩和に使わず、環境制約として差分判定と分離する
- Issue #2の矩形影、100%／99%、55%／54%、前後輝度差、PC／iPhone差、D2c3を変更せず引継ぎ文書へ記録する
- 表裏分離／断面クリップは`DEFERRED_UNTIL_POST_ISSUE2_UI_SIMPLIFICATION_REVIEW`として維持する
- 承認Head `2b94f51acf71a62b8fdca59f64de39566d6e23ee`は`HUMAN_ACCEPTED_PHASE3C3_WITH_THERMAL_OBSERVATION_AND_DEFERRED_ISSUE2_POLISH`
- PCで完成時計、小秒表示、opacity 16%内部選択、選択解除、外装OFF、split／explode／復元、全長ズーム、りゅうず・時計機能、作動音、学習モードを人間確認合格
- 物理iPhoneで初期表示、回転・ズーム、小秒表示、opacity 16%内部選択、空白タップ解除10回、外装OFF、split／explode／復元、りゅうず・時計機能、作動音、学習モードを人間確認合格
- 代表22部品を既存diagnostics／partsInfoで選択し、HUDと学習タブの名称・説明同期を22/22確認
- 15分後の軽微な発熱を`THERMAL_WARMTH_OBSERVED_NO_REPORTED_FUNCTIONAL_DEGRADATION`とし、Issue #2最終候補で15分再試験する
- progressive frame drop、Safari reload、音・タッチ異常は`NO_ABNORMALITY_REPORTED_IN_HUMAN_REVIEW`であり、実証済みPASSとはしない
- 人間承認後もReady化・マージ・既定採用は許可せず、Issue #2比較専用監査だけを開始可能とする

## Issue #2 Final Polish Phase 3A 完成外装比較

- 完成外装queryへ`rendering=issue2-baseline|issue2-d2a|issue2-d2c3`を追加した場合だけ候補を有効化する
- queryなし、Phase 3C.1-only、Phase 3C.2-only、Phase 3C.3-onlyを変更しない
- 3候補×2 viewport×33状態、計198枚の実WebGL PNGを取得する
- 100／99／75／56／55／54／53／50／25／16／8%を比較し、100→99と55→54の現行不連続を隠さない
- Node 210/210、完成外装統合回帰6/6、UI 20/20・22/22、HUD 45/45・57/57を維持する
- 位置1／位置2禁止干渉0/0、三針拘束、S86、Phase 2C、A.7、外装ON/OFF、split／explode／restoreを維持する
- 同一環境性能差分は平均fps悪化5%以内かつp95悪化2ms以内を使用し、絶対A.6閾値を代替しない
- Phase 3A比較監査は`ISSUE2_PHASE3A_AUDIT_ACCEPTED_CANDIDATES_REJECTED_NO_ADOPTION`、198枚のcoverageは`DIMENSIONAL_COVERAGE_SET_NOT_FULL_CARTESIAN`とする
- D2aは性能差分とA.5ライト契約を満たさないため`RETAIN_AS_VISUAL_REFERENCE_REJECT_FOR_ADOPTION`、D2c3は`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`とする

## Issue #2 Final Polish Phase 3B.1 shadow／fog比較

- 完成外装queryへbaseline、shadow-off、shadow-fit、fog-only、shadow-off-fog、shadow-fit-fogの6候補を追加し、既定OFFとする
- 既存DirectionalLightの強度・色・位置、shadow map size、bias、normalBias、Material、透過処理、camera、DPRを変更しない
- 固定shadow fitはnormal、full-length、split、explode、split＋explodeの実world bounds unionを初期化時に1回だけ測定し、per-frame更新を行わない
- Stage 1は6候補×2 viewport×88条件、実WebGL PNG 1056枚、console error／warning 0、transform invariant true、禁止干渉0/0を満たす
- 前後面相対差0.30以下、baseline比悪化+0.05以下、fps悪化5%以内、p95悪化2ms以内、Mobile full-length／far non-flatを変更しない技術ゲートとする
- shadow-offは前後面、shadow-fitは影解像度、fog候補はMobile farを満たさないため、`ISSUE2_PHASE3B1_NO_TECHNICAL_FINALIST`とする
- 技術ゲート合格0件のためStage 2、PC候補選択、物理iPhone、15分温度確認を実施しない
- 100→99%と55→54%の透過処理はbyte／AST保護し、Phase 3B.2へ分離する
- queryなし、Phase 3C.1／3C.2／3C.3-only、Phase 3A baseline／D2a／D2c3の14条件を比較元とpixel exactにする
- D2c3は`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`、PR #5はOpen／Draft、Issue #2はOpenを維持する
- `ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED`を維持し、Ready化・マージ・既定採用を行わない

## Issue #2 Final Polish Phase 3B.1c opacity-coupled shadow attenuation

- Phase 3B.1bを`ISSUE2_PHASE3B1B_AUDIT_ACCEPTED_TIGHT_SHADOW_ROUTE_CLOSED`とし、tight 512／1024、mapSize拡大、shadow camera追加調整を終了する
- Stage 0はDesktop／390×844、front／dial mechanism、opacity 16%／8%、normal／split／explode、5 caster群を実WebGLで比較し、主要caster群、caster／receiver数、構造透過対象重複、customDepth、alphaTest、復元状態を保存する
- query限定attenuationは`shadowWeight=smoothstep(0.08,0.80,r)`でfrontKey 1.96をshadow carrierと非shadow補償へ配分し、色・位置・target・方向を一致、総光量誤差1e-12以下とする
- opacity変更ではLight intensityだけを更新し、castShadow／receiveShadow、Material、Geometry、shadow camera、mapSize、shadow refreshを変更しない
- 固定normalBias候補はbaseline cameraと512² mapから`0.5*max(texelX,texelY)=0.009765625`を1回算定し、bias sweepを行わない
- Stage 1は4候補×2 viewport×2 theme×52条件、計832枚を取得し、中央境界、斜め帯、前後面、隣接opacity、peter-panning、性能を比較する
- 前後面はrelative 0.30以下かつbaseline比悪化+0.05以下、斜め帯はShadow-off比1.15以下、性能はFPS悪化5%以内かつp95悪化2ms以内を維持する
- attenuationは前後面、attenuation＋biasは前後面とMobile性能を満たさないため技術finalist 0件、Stage 2未実施とする
- PR #20の17 path×2 viewportをpixel exactにし、mismatch 0、console error／warning 0、opacity変更時shadow refresh 0を確認する
- 状態を`ISSUE2_SHADOW_ROUTE_EXHAUSTED_NO_TECHNICAL_FINALIST`とし、Shadow-offとD2c3を未採用の人間判断候補として保持する
- Issue #2はOpen、PR #5はOpen／Draft、APP_VERSIONはv3.15.0を維持し、Ready化・マージ・既定採用を行わない

## Issue #2 Final Polish Phase 3B.2 dual-baseline transparency continuity

- `rendering=issue2-phase3b1c-shadow-off|issue2-d2c3`かつ`continuity=issue2-current|issue2-stable-depth-off|issue2-stable-depth-base|issue2-group-stable-depth`の明示queryだけで有効とする
- 13 opacityで対象Mesh／Materialの`transparent`、`depthWrite`、renderOrder、blending、castShadow、receiveShadow、Material UUID、選択性、world boundsを保存する
- 現行方式で100%→99%のtransparentと55%→54%のdepthWrite切替を再現し、固定方式3候補ではproperty toggle 0、Material replacement／UUID change 0を必須とする
- 100／99、55／54の画面差分は1/255量子化を許容した隣接差分score 2以下とし、screen合格だけで候補採用しない
- opacity 16%のdial mechanism／movement back内部視認、設定車2の選択・HUD・学習同期・空白解除、split／explode／restore、実pointer回転を確認する
- 性能差分は平均fps悪化5%以内、p95悪化2ms以内、reversal 0、stop-then-jump 0、wheel monotonic、transform invariantを維持し、絶対閾値を変更しない
- `stable-depth-base`は内部視認性、`stable-depth-off`はD2c3 wheel性能、`group-stable-depth`はD2c3 selected性能により棄却する
- candidate-specific browser failure 0、UI 22/22、HUD 57/57、trusted audio 23/23、A.7 9/9、禁止干渉0/0、console 0/0、protected path 42/42を維持する
- 技術finalist 0件のためStage 2、PC候補比較、物理iPhone、採用を行わず、状態を`TRANSPARENCY_CONTINUITY_LIGHTWEIGHT_ROUTE_EXHAUSTED_OIT_DECISION_REQUIRED`とする
- OITは本工程へ実装せず、Issue #2 Open、PR #5 Open／Draft、D2c3未採用、APP_VERSION v3.15.0、Ready化・マージ禁止を維持する

## M. v3.14 機構同期作動音 Phase 1

- 初期表示で作動音はOFF、`AudioContext`は未生成、音源は未読込で、自動再生しない
- ユーザーが右上スピーカーボタンをONにした後だけ6原子音を読み込み、OFF／読み込み中／ON／利用不可を状態通知する
- 必須6bufferの完全性を種類名で判定し、部分読込失敗後の再ONでは欠損音源を再試行する
- 継続失敗またはmanifest欠損時はONへ遷移せず、復旧後は6bufferが揃った場合だけONへ遷移する
- 右上スピーカーは小型表示でも44×44px以上の操作領域、`aria-label`、`aria-pressed`、Enter／Space、`focus-visible`を備え、選択部品HUDと重ならない
- 操作タブに作動音セクションと音量sliderが存在せず、master gain 0.36とbus gain 0.24／0.32／0.24／0.38を固定値として維持する
- 脱進機の既存ビート番号が進んだときだけtick／tockを交互に発音し、一時停止・再開・時刻ジャンプで音のバックログを再生しない
- 正転巻上げは角穴車の実回転歯通過、逆転空転は巻上げピニオンの実回転歯通過から発音し、逆の音を混在させない
- 位置2では正転／逆転の巻上げ音を発音せず、機構側の切離しと一致する
- pullは`crownTransition=0.999975`の上向き交差、pushは`0.000025`の下向き交差で各1回発音し、30／60／120fps相当で端点より70〜100ms先行する
- 起動、同位置再選択、リセット、診断、状態復元、100往復試験ではpull／push音を発音しない
- 音イベントresolverは時間用timerを持たず、各フレーム最大1位相イベント、脱進機最大8イベント/秒を守る
- タブ非表示でAudioContextと発音を停止し、復帰時に位相カーソルを再基準化して遡及発音しない
- ON／OFFは短いgain rampを使い、OFF時と非表示時には残留sourceが停止する
- OFF操作は25msのgain rampを完了してからsourceを停止し、待機中の再ONを古い停止処理が妨げない
- 1音源の読込失敗でアプリと機構操作を継続し、UIと診断へ利用不可・失敗ファイルを表示する
- 発音前後で主要機構角、りゅうず位置、時刻、カメラ、レンダラー設定が不変である
- 音OFFで既存デスクトップ86件、UI 20件、HUD 45件、A.7 9件、禁止干渉0/0、A.6性能を維持する
- 390×844で音声23件、HUD 57件、横オーバーフロー0、上部3D表示領域35dvh以上を満たす
- 音ONのデスクトップ／390×844でA.6のフレーム時間閾値を満たし、33ms／50ms超過を増加させない
- WebM証跡はVP9映像とOpus音声を含み、脱進機10秒、正転／逆転、pull／push、390×844脱進機を記録する
- 物理iPhone Safariで、pull／push音の時刻、1操作1回、右上スピーカー操作、ON／OFF・タブ移動・ホーム復帰時の二重音／音残りなし、5bpsのtick／tock・正転巻上げ・逆転空転の音量と識別性を人手確認し、すべて合格している
- main v3.13.0の既定照明が暗く見えることを既知事項として記録し、PR #5のD2c3や照明変更を取り込まずIssue #2の最終微調整へ申し送る
