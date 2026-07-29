# Changelog

## Unreleased — Stacked Draft Phase 3C.3 completed exterior integration review

### Issue #2 Final Polish Phase 3B.4b

- 完成外装＋D2c3の`input=issue2-ios-multitouch-stability`時だけ、Arcballとアプリのpointer lifecycleをevent-driven cleanupする候補を追加
- pointercancel、真のlostpointercapture、pointer ID再利用、blur、visibility、pagehide／pageshowをcleanupし、二本指から一本指への遷移でgesture基準を再初期化
- Desktop 24 cycle／390×844 60 cycleでidle復帰100%、active pointer／capture残留0、camera finite、selection／解除、transform invariantを確認
- Desktop／Mobileのidle／pointer／wheel差分6/6、UI、HUD、audio、S86 5/5、A.7 9/9、禁止干渉0/0、application console error／warning 0/0に合格
- 物理iPhoneのA／B／C各5分および候補C 15分は未実施のため、`STOPPED_PHYSICAL_IPHONE_REPRODUCTION_INCONCLUSIVE`とし、root causeとframing固有性を確定しない
- D2c3、framing、入力候補はquery限定・未採用。感度、damping、FOV、maxDistance、audio、Geometry、Light、fog、Material、透過、APP_VERSION、閾値を変更しない

### Issue #2 Final Polish Phase 3B.4a

- Phase 3B.3で選定されたD2c3のモバイル全長構図をquery限定で安定化
- 390×844の完成時計407,428頂点からraw fit 199.068109、安全余裕込み204.044811を算定し、幅420以下だけ`maxDistance=204.1`を適用
- 初期／復帰32/32とDesktop固定画像48/48をPNG byte exact、Desktop selected 8/8をstate exact、最小余白4.0265%、near／far clipping 0、pinch／wheel reversal 0、selection／restore合格
- 224 actual WebGL PNG、26 motion frame、6 board、3 GIF、Desktop／Mobile各3反復の差分性能を保存
- iPhone 16／iOS 26.5.2、Safari／ホーム画面、輝度50%、低電力OFF、ケースあり、室温25℃で15分確認し、初期構図・明るさ・全長・余白・clippingなし・preset・最大距離回転・設定車2選択・HUD同期・解除・split／explode／restoreを合格
- 判定は`HUMAN_ACCEPT_MOBILE_FULL_LENGTH_FRAMING_FIX`、`PHASE3B4A_ACCEPTED_PENDING_FINAL_INTEGRATION`。fogの全長時暗化は`MOBILE_FULL_LENGTH_FOG_DARKENING_ACCEPTED_AS_IS`
- 一般tap異常と自動reloadは報告されていない。2～3分後の二本指pan／pinch／rotation劣化は`DEGRADATION_REPORTED`、手動reloadで復旧するためPhase 3B.4bへ分離
- `IOS_BALANCE_AUDIO_PACING_SLOWDOWN_REPRODUCED`は別保留とし、D2c3／framingのquery限定・未採用、Issue #2 Open、PR #5 Open／Draftを維持

### Issue #2 Final Polish Phase 3B.3

- Phase 3B.2の人間判断を記録し、現行100／99・55／54不連続を既知制約として受容、OITを完成後へ延期
- 製品コードを変更せず、現行透過方式のShadow-offとD2c3を最終PC／物理iPhone比較用に整理
- 2候補×2 viewport×4 theme×16 scenarioの256実WebGL PNG、36操作GIF、132性能run、明示current／省略時同値性、protected product pathsを証跡化。DesktopはPNG byte exact、Mobileは最大12 pixel・3階調のGPU量子化差のみでMaterial／transform／source contract一致
- D2c3はShadow-off比22性能比較中9比較で差分基準を満たさず、既知の性能tradeoffとして人間確認へ引き継ぐ
- PCでは両候補合格、物理iPhoneではShadow-offを暗いfull-length表示のため不合格、D2c3を`HUMAN_SELECT_D2C3_WITH_EXPLICIT_PERFORMANCE_TRADEOFF`として選定
- D2c3は`D2C3_SELECTED_FOR_FINAL_POLISH_PENDING_POST_SELECTION_STABILIZATION`。モバイル全長構図、iOS音響ペーシング、温度再試験を保留し、既定採用、Ready化、マージ、Issue #2クローズは未実施
- 冷却5分は`COOLDOWN_PROTOCOL_DEVIATION_5MIN`、progressive frame drop／Safari reloadは`NOT_REPORTED`として記録

### Issue #2 Final Polish Phase 3B.2

- Shadow-off／D2c3をdual baselineとし、13 opacity、Desktop 1280×720／Mobile 390×844で現行と固定深度3候補をquery限定比較
- 実ランタイム146 Mesh／150 Materialを監査し、現行のtransparent change 286・depthWrite change 300を再現。固定3候補はproperty toggle 0、Material replacement／UUID change 0
- `stable-depth-base`はopacity 16%内部視認性、`stable-depth-off`はD2c3 wheel性能、`group-stable-depth`はD2c3 selected性能（fps約10.1%、p95約33ms悪化）で棄却
- candidate-specific browser failure 0、UI 22/22、HUD 57/57、trusted audio 23/23、A.7 9/9、禁止干渉0/0、protected path 42/42、console error／warning 0
- 技術finalist 0件のためStage 2・PC候補比較・物理iPhoneを実施せず、`TRANSPARENCY_CONTINUITY_LIGHTWEIGHT_ROUTE_EXHAUSTED_OIT_DECISION_REQUIRED`とする
- OITを実装せず、通常path、Light、Geometry、renderOrder、shadow対象、DPR、UI、audio、APP_VERSION、試験閾値を変更しない。Issue #2 Open、PR #5 Open／Draft、D2c3未採用を維持

### Issue #2 Final Polish Phase 3B.1c

- Phase 3B.1bを`ISSUE2_PHASE3B1B_AUDIT_ACCEPTED_TIGHT_SHADOW_ROUTE_CLOSED`として記録し、tight 512／1024、mapSize拡大、shadow camera追加調整を終了
- Stage 0で2 viewport、5 caster群、120枚を取得し、589 Mesh、553 caster／receiver、主要caster群`dial-exterior`、customDepth／alphaTest 0、状態復元trueを確認
- frontKey 1.96をsmoothstepでshadow carrierと同方向・同色・同targetの非shadow DirectionalLightへ連続配分し、全opacityの総光量誤差1e-12以下、opacity変更時shadow refresh 0
- 4候補×2 viewport×2 theme×52条件、計832枚のStage 1、性能、回帰、34 protected pathを実WebGLで保存
- attenuationは中央矩形境界と斜め帯、性能を改善したが前後面baseline比悪化0.072299で不合格。固定normalBias 0.009765625候補は前後面に加えMobile性能も不合格
- 技術finalist 0件のため`ISSUE2_SHADOW_ROUTE_EXHAUSTED_NO_TECHNICAL_FINALIST`、Stage 2未実施、Shadow-offは`HUMAN_DESIGN_HOLD_TECHNICALLY_NONFINAL`、D2c3は未採用fallbackを維持
- Geometry、Material、fog、shadow camera／mapSize、透過処理、DPR、UI、audio、APP_VERSION、試験閾値を変更せず、Issue #2 Open、PR #5 Open／Draftを維持

### Issue #2 Final Polish Phase 3B.1

- Phase 3A判断記録Headから別ブランチを作り、既存DirectionalLightのshadow carrier OFF、5状態固定shadow fit、fog 160／260を単独・単純合成した6候補を完成外装query限定で比較
- 6候補×2 viewport×88条件、計1056枚の実WebGL PNG、7条件×10秒性能、14 protected path、browser／UI／HUD／audio回帰を保存
- shadow-offは矩形影を除去したが前後面バランス悪化、shadow-fitは512² mapの固定広域fitによる縞状解像度劣化、fog候補はMobile farのflat描画が残り、技術ゲート合格候補0件
- 状態を`ISSUE2_PHASE3B1_NO_TECHNICAL_FINALIST`、Stage 2を`SKIPPED_ZERO_TECHNICAL_GATE_CANDIDATES`とし、PC候補選択・物理iPhone・既定採用へ進めない
- 性能差分は全6候補で合格、console error／warning 0、禁止干渉0/0、UI／HUD全件合格、protected path 14/14 pixel exact、Node 225/225
- RectAreaLight、light値、shadow map、bias、Material、透過処理、DPR、camera、Geometry、試験閾値を変更せず、100／99と55／54はPhase 3B.2へ分離
- D2c3は`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`、PR #5はOpen／Draft、Issue #2はOpenを維持

### Issue #2 Final Polish Phase 3A

- Phase 3C.3完成外装へbaseline／D2a／D2c3をquery限定で移植し、通常pathおよびPhase 3C.1／3C.2／3C.3-onlyを維持
- 1280×720／390×844、3候補×33状態の実WebGL PNG 198枚と輝度・opacity・性能・回帰JSONを保存
- Phase 3A比較監査を`ISSUE2_PHASE3A_AUDIT_ACCEPTED_CANDIDATES_REJECTED_NO_ADOPTION`として合格とし、198枚を`DIMENSIONAL_COVERAGE_SET_NOT_FULL_CARTESIAN`へ分類
- D2aは視覚参考として棄却。D2c3は性能・前後輝度差・透過不連続が未解決のため既定採用せず、`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`として保持
- Node 210/210、完成外装統合回帰6/6、UI／HUD合格、console error／warning 0、禁止干渉0/0を確認
- 100→99%のtransparent切替、55→54%のdepthWrite切替は再現記録のみで、alphaHash、影閾値切替、試験閾値緩和を追加していない
- 状態は`ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED`。PR #5、Issue #2、D2c3の保留を維持

- Phase 3C.2承認Head `f245a5a9d68d5205e7609479ffefd711376e4930`を`HUMAN_ACCEPTED_PHASE3C2_WITH_DEFERRED_RENDERING_POLISH`として継承し、別Draftで完成時計を統合監査。
- `integration=phase3c3`時だけ小秒凹面の空白4点へ非描画selection proxyを追加。Desktop／390×844の100%／50%で4/4、16%越しの設定車2選択を維持。
- Object3D orphan・二重登録・visibility・Material復元・parent・query残留を0、split／explode／外装ON/OFF後の復元誤差を`1e-7`以下、位置1／2禁止干渉を0/0で確認。
- queryなし、Phase 3C.1-only、Phase 3C.2-onlyを承認Headとpixel exactで照合。Geometry、機構、カメラ、DPR、照明、影、透過基盤、UI、音響、APP_VERSION、試験閾値を変更していない。
- Desktop／390×844のidle、pointer、wheel、opacity 16%、外装OFF、split、explode、学習選択は`DIFFERENTIAL_PASS`。in-app Browserの絶対フレームペーシング変動は環境制約として分離。
- 承認Head `2b94f51acf71a62b8fdca59f64de39566d6e23ee`はPC／物理iPhoneで合格し、`HUMAN_ACCEPTED_PHASE3C3_WITH_THERMAL_OBSERVATION_AND_DEFERRED_ISSUE2_POLISH`とした。代表22部品の選択・HUD・学習タブ同期も22/22確認。
- 物理iPhoneは15分後にやや発熱したが機能劣化の報告はなく、Issue #2最終候補で再試験する。progressive frame drop、Safari reload、音・タッチ異常は報告なしであり、実証済みPASSとは記載しない。
- 矩形影、100%／99%、55%／54%、前後輝度差、PC／iPhone差、金属階調、D2c3をIssue #2へ引き継ぐ。Ready化・マージ・既定採用は未実施。

## Unreleased — Stacked Draft Phase 3C.2 formal leather strap and buckle

- 人間承認済みPhase 3C.1 Head `4de3c018f52ea88d1cbe5f4ad0c44166f7f89914`から別ブランチを作り、`feature/final-exterior-balanced-phase3c1-watch-head`をBaseとする積み上げDraftとして正式ストラップ・尾錠を分離。
- `?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2`時だけ、Phase 3B.2の構造確認用ストラップ2本と簡略バックルを非表示にし、ラグとスプリングバーを再利用。通常pathとPhase 3C.1-only pathのObject3D／Material／DOM追加0とpixel exactを確認。
- 中心線長75.000／115.000、幅19.700→16.000、厚さ2.600→2.300→2.050の閉合swept-prismを実装。最初の12.000をほぼ直線、その後を正Y手首側へ曲げ、曲率符号反転・自己交差・波打ちを0とした。
- 内径1.800相当の実スプリングバーポケット2つ、尾錠側巻込み、直径2.000／pitch 7.000の7つの実貫通穴、左右対称の丸い自由端をCSGなしで実装。
- 定革・遊革、外幅19.000／内幅16.600の尾錠枠、径1.200の取付バー、長さ13.000の静的つく棒を実装。実締結・遊革スライド・革変形・ばね挙動は再現せず、製造公差・耐久・防水を`UNVERIFIED_MANUFACTURING_INTERFACE`とした。
- 上面`#151311`、裏面`#27221E`、コバ`#0B0908`、同系色ステッチ、128×128 procedural calf DataTextureを追加。外部画像、クロコ型押し、厚いパッド、大型ロゴ、派手なコントラストステッチは追加していない。
- 10部品を選択・HUD・学習表示へ登録し、穴・ステッチ・コバは独立選択対象から除外。opacity 16%の内部選択、外装ON／OFF、split、explode、誤差1e-7以下の復元をDesktop／390×844で確認。
- 位置1／位置2の禁止干渉0。意図接触をstrap/bar、strap/body wrap、frame/bar、tang pivot、buckle strap wrapとして分離。全新規Geometryの退化・重複・反転triangle、non-manifold edge、winding mismatch、非有限法線、coplanar overlap、z-fightingは0。
- Desktop／390×844のidle・pointer・wheelは絶対・差分基準に合格し、閾値変更なし。Desktop総合のA.5前後面明度差は承認済みPhase 3C.1にも同じIDで再現し、Phase 3C.2固有回帰0。
- Phase 3C.1は`HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS`として継承。小秒選択性、Issue #2、D2c3、表裏分離・断面クリップUXを変更しない。Phase 3C.2 Head `f245a5a9d68d5205e7609479ffefd711376e4930`は後続人間確認で`HUMAN_ACCEPTED_PHASE3C2_WITH_DEFERRED_RENDERING_POLISH`となり、Ready化・マージ・既定採用は未実施。

## Unreleased — Stacked Draft Phase 3C.1 formal watch-head candidate

- 初回、第2候補、第3候補は人間非承認。第4候補はPC／物理iPhoneで合格し、残る6時index、外装グループ、文字板選択性だけを同じDraft PR #15で最終微修正。状態は`PHASE3C1_FINAL_MINOR_REVISION_PENDING_HUMAN_CONFIRMATION`。
- 人間承認済みPhase 3B.2 Head `98d83781aa7aa001836a0d57f1ad6e3d058a15c4`から別ブランチを作り、`feature/final-exterior-balanced-phase3b2`をBaseとする積み上げDraftとして正式時計本体意匠を分離。
- `?exterior=balanced&watchHead=phase3c1`時だけ、白系アイボリー`#F2EDE5`／小秒面`#F5F1EA`、1.820×0.440×0.230 faceted bar、半径14.200の0.165／0.250丸型60分目盛、視覚径8.500小秒recessを生成。
- ケース、ベゼル、rehaut、ラグ、裏蓋、りゅうず、ケースチューブ、接続カラー、spring bar、仮buckleへ`EDUCATIONAL_STABLE_SILVER_MATERIAL`（`#E7EAED`、metalness 0.52、roughness 0.20、envMapIntensity 0.35）をcandidate-local cloneとして適用し、Base Material共有を0にした。index、hands、open-heart rim、内部機構、movement holderは対象外。
- 分目盛を半径14.200へ移し、通常index clearance 0.437、12時double bar最小clearance 0.381178、表示開口clearance 0.575を確保。60点を維持し、index／double bar／opening／bezel・rehautとの重複を0にした。
- 風防のGeometry、保護包絡Y=-3.460～-2.860、clear diameter 30.600、depth stateを維持し、候補専用`EDUCATIONAL_NON_REFRACTIVE_DOME_CRYSTAL`（roughness 0.025、transmission 0、opacity 0.10、ior 1.45、thickness 0.05、clearcoat 1）へ変更。edge contrast保持率はDesktop 96.460%、390×844 96.394%。
- 6時に通常バーを追加し、12時ダブルを含む13 Meshとした。実Geometry clearanceは小秒凹面1.968、小秒目盛2.479975、小秒針掃引2.949939、major dot 0.435226、表示開口1.260226、禁止干渉0。
- 学習タブのquery限定表示をhelperなしの「外装」だけへ整理し、管理対象を25部品とした。針3本とりゅうずはOFF対象外のままFRONT／CORE family、選択、機構操作を維持する。OFF／ON、split／explode／opacity 16%、ボトムシートとの状態合成をDesktop／390×844で確認。通常pathのDOM追加は0。
- 文字板priorityを1へ局所変更し、空白4点4／4、opacity 50%、index、針、小秒、open-heart、風防側面、opacity 16%内部選択を確認。風防はpickableのまま局所非描画外縁面で側面選択を維持し、global Raycaster／opacity閾値は変更していない。
- 実テンプworld中心[7.700,1.730,1.800]を文字板へ[7.700,1.800]として投影し、径6.600、文字板面積比3.5559%、中心誤差0の限定オープンハートを維持。参照画像の名目的な位置を模写しない。
- 事前遮蔽判定`B_PARTIAL_PLATE_OCCLUSION`に対し、半径1.320／中心offset 1.900の2つの物理地板窓を設け、中央下側耐震軸受land 0.100を保持。機構移動、非表示、透明化、CSG、トゥールビヨン風ケージは使用しない。
- actual +Y Raycaster 709 sampleで機構first-hit率0.165021、テンプ0.133992、脱進機0.001410を記録。文字板、小秒、index、分針clearanceを維持。
- Phase 3C.1部品を既存FRONT／CORE／BACK／PLATEの表裏分離・分解transformへ統合。split／explode 100%とposition／quaternion／scale誤差1e-7以内の復元をDesktop／390×844で確認。
- Phase 3C.1部品を選択・HUD・学習表示へ登録し、透過100／50／16／100、16%内部選択、位置1／2、巻上げ、時刻合わせ、秒停止を回帰。
- 通常pathはPhase 3B.2とPNG 237,334 byte／SHA-256 `a114aca62e07f03c9d67e7ada497b05f8007030a8b003f2171e4a8d82555ee5c`で一致。APP_VERSION、S86、Phase 2C、A.7、機構、カメラ、DPR、照明、影、tone mapping、UI、音響を変更していない。
- Desktop総合は白系文字板によるA.5前後面明度差のみ未達、390×844総合とUIは合格。HUDのfocus-visible／時刻blur順3項目は候補とPhase 3B.2 Baseで同一未達、音声integrationも双方で同一timeout。閾値・製品コードは変更していない。
- idle／pointer／wheelはDesktop／390×844の絶対閾値とPhase 3B.2差分基準へ合格。最終微修正Desktop idleのBase比はfps -0.001%、p95差0.000msで、明確な悪化はない。
- 矩形影、100%→99% transparent、55%→54% depthWrite、透過時の暗部・深度順、PC／iPhone照明差はIssue #2へ分離し、最終成果で隠していない。
- 第4候補本体の人間確認は合格済み。最終微修正は`FINAL_MINOR_REVISION_NOT_DEFAULT_PENDING_HUMAN_CONFIRMATION`で、PC／物理iPhone再確認前に既定採用、Ready化、マージを行わない。
- 表裏分離／断面クリップは変更せず、`UI_SIMPLIFICATION_REVIEW_AFTER_PHASE3C2_AND_ISSUE2`として分解表示との重複、学習上の価値、詳細表示への移動、初期UIからの折りたたみ、廃止可否を後続人間判断へ残す。
- `PHYSICAL_IPHONE_MILD_WARMING_AFTER_15_MIN`を非ブロッキング観察事項として記録し、最終統合レビューで15分連続確認する。
- 黒革、実用長、スプリングバー巻込み、6時側穴列、定革・遊革、尾錠枠・つく棒・取付バー、シボ、ステッチ、コバはPhase 3C.2の必須後続工程として維持。

## Unreleased — Stacked Draft Phase 3B.2 basic attachment candidate

- 人間承認済みPhase 3B.1 Head `d51e4f8790596f7bc894e8c716edb0d54968d260`から別ブランチを作成し、`feature/final-exterior-balanced-phase3b1`をBaseとする積み上げDraftとして基本装着部を分離。
- `?exterior=balanced`時だけ、閉合indexed Meshの4ラグ、2スプリングバー、構造確認用ストラップ2本、簡略バックルを生成。通常pathの追加Object3Dは0で、固定mainとPNG 237,380 byte／SHA-256 `f3bdd25d543c11a4ae1dc08a3020a60358a85d5d20a90ccff9b8242bc35bd003`が一致。
- lug-to-lug 46.600、外端Z±23.300、スプリングバー中心Z±21.800／Y2.800、ストラップ幅20.000→16.500、厚さ2.400、中心線長42.000／58.000を実装。
- 新規9部品を選択・HUD・学習表示へ登録し、外装100%／50%／16%、family非表示、分解、表裏分離、材質・transform復元、16%時の内部選択を維持。
- 位置1／位置2で機構・既存外装・新規装着部の禁止干渉0。ラグ―ケースは`INTENDED_LUG_CASE_CONNECTION`、バー―ラグ／ストラップは意図接触として禁止干渉から分離。
- Phase 3B.1、S86、Phase 2Cの3包絡、A.7、三針拘束、カメラ基盤、DPR、照明、影、材質基盤、UI、作動音、APP_VERSIONを変更していない。
- Desktop 86/86、390×844 88/88、PR #3 UI 22/22、PR #4 HUD 57/57、音声23/23、Phase 3B.2 harness Desktop／Mobile各30/30に合格。A.6の10秒idle／pointer／wheelは同一環境A/Bで絶対・差分基準に合格し、閾値は変更していない。
- ストラップは`STRUCTURAL_PLACEHOLDER_NOT_PHASE3C_STYLE`。革色・シボ・ステッチ・穴列・コバ・最終バックル意匠、製造公差、防水、耐久、実着脱はPhase 3Cまたは実物設計へ保留。
- 追加world boundsは24.400×30.070×88.162。既存カメラ定数を変えず、全ストラップ確認は可逆なwheel zoom-outで行う。物理iPhoneの接続・選択・透過・回転／ズーム・操作性は人間確認待ち。

## Unreleased — Draft PR #13 Phase 3B.1 E-BALANCED core exterior candidate

- `?exterior=balanced`限定の最終候補として、第4候補の全面テーパーと総厚8.695を維持し、ケース胴の最大径帯を3.450から1.950へ短縮。前側／後側テーパーを2.160／3.385へ延長し、最大径39.600、端部径38.900、内径37.800は不変。
- りゅうずの実Mesh包絡から位置1の必要最小逃げ0.249174を再算出し、新プロファイルで実採用値0.304118を適用。上限0.330との差0.025882、位置1gap 0.030063、最小壁厚0.550000を確認。
- 旧上限0.150では物理食い込み0.121192、目標gap込み不足0.151192が残ることを記録。
- 内周半径18.900を不変とし、CSG、重複Mesh、同一面重ねを使用しない。りゅうず―チューブ／局所カラーは意図接触または未検証シートとして、りゅうず―ケース胴の禁止干渉から分離。
- ベゼルは保持座R14.900～15.300だけを水平とし、R15.300/Y=-3.240からR18.500/Y=-2.890まで連続傾斜、R19.400/Y=-2.860へ最小閉合する。保持座0.400、主テーパー3.200、閉合0.900、被覆率0.888889。
- 裏蓋リングは保持座R14.274～14.474だけを水平とし、R14.474/Y=5.235からR18.900/Y=4.685まで連続傾斜、R19.500/Y=4.635へ最小閉合する。保持座0.200、主テーパー4.426、閉合0.600、被覆率0.956766。
- 両プロファイルで単調勾配、意図しない水平区間0、単一閉合Mesh、退化三角形0、非多様体edge 0、風防／裏蓋窓／ケース胴／保持リングとの禁止干渉0を確認。
- ムーブメントとケース内周の空隙へ、外径37.650、内径36.750、Y=4.035～4.485の閉合保持リングを追加。pick priority -1、構造透過対象、禁止干渉0、固定方式／製造公差／防水は`UNVERIFIED`。
- 外装総厚8.695の方向性、ケース胴テーパー、りゅうず位置1／2、指掛かり、pull／push、保持リング方針、透過16%、回転・ズーム、時計機能、作動音、物理iPhone操作性は合格済み。最終候補の視覚的薄型化、全面テーパー維持、透過50%は人間確認待ち。
- Node全件、desktop総合86/86、390×844総合88/88、外装診断、S86 5/5、Phase 2C、A.7 9/9、三針拘束、禁止干渉に合格。単独WebGLタブの10秒idle候補差分はfps -0.52%、p95 -0.10msで差分基準内。初期化long frameを絶対性能の環境制約として分離し、閾値は変更していない。
- 通常pathは固定mainとPNG 237,334 byte／SHA-256 `a114aca62e07f03c9d67e7ada497b05f8007030a8b003f2171e4a8d82555ee5c`で一致。S86、Phase 2C、A.7、機構、カメラ、照明、材質、UI、作動音、APP_VERSIONは変更しない。状態は`IMPLEMENTATION_CANDIDATE_NOT_DEFAULT`のまま、最終候補のPC／物理iPhone確認前に既定採用しない。

## v3.15.0 — PR #10 S86 dial display proportions

- 人間確認で選定されたS86の文字板表示寸法を通常Geometryへ反映（dial ring 27.692、index円 25.456、分針 12.040、時針 8.600、小秒表示円 7.740、小秒針 3.268）。
- インデックスと補助マーカーの径方向位置・長さをS86比較Geometryと一致させた。
- ムーブメント、輪列、四番車軸・小秒中心、Y方向配置、針pivot／position／rotation／scale、照明・影・材質・透過、カメラ、UI、作動音を変更していない。
- S86を通常の文字板表示寸法として採用。v3.14.0は直前の機構・描画基準とする。
- 物理iPhoneで、S86の現在工程における文字板表示系寸法、小秒針の識別性、時針・分針の長さ、内部機構と表示系の主従関係、回転、ズーム、選択、作動音を人手確認し合格。最終外装ではケース開口・ベゼル・風防・物理文字板・インデックス・針との統合として表示開口と全体比率を再確認する。
- 試験状態を `ACCEPTED_WITH_TEST_ENVIRONMENT_LIMITATION` と記録。実施済みmain／PR A/BではPR固有回帰0件だが、in-app Browserの固定commitホストアクセス・安全ポリシーにより全ブラウザ試験マトリクスは未完了。閾値緩和および製品コードによる回避は行っていない。

## v3.14.0 — PR #6 機構同期作動音 Phase 1

- `audio-events.js`へ、既存ビート番号・巻上げ歯位相・逆転歯位相から離散音イベントを解決する純粋resolverを追加
- 脱進機tick／tock、正転巻上げ、逆転空転、りゅうずpull／pushの6原子音をWeb Audioで再生
- 初期OFF、明示的なユーザー操作後の`AudioContext`遅延生成、OFF時の早期終了、可視状態に応じたsuspend／resumeを実装
- りゅうず音はUI操作による方向別`crownTransition`節度閾値交差時だけ発音し、30／60／120fps相当で端点より70〜100ms先行する。初期化、リセット、診断、状態復元、同位置再選択では発音しない
- 毎フレームの位相音を最大1件、高速脱進機音を最大8件/秒へ抑制し、停止・再開・時刻ジャンプ時のバックログを破棄
- master gain 0.36と4系統の固定bus gain、短いgain ramp、音源読込失敗時の利用不能通知、診断カウンタを追加
- 操作タブの作動音セクションと音量sliderを削除し、右上に44×44px操作領域、Enter／Space、ARIA、focus-visible対応の薄いスピーカーアイコンを追加
- 48kHz／16-bit／mono PCMの選定済み合成音A3・W3・R2・S3と参照音、manifestを追加。実物のETA 6498-1録音ではない
- Node 52/52、既存デスクトップ86/86、UI 20/20、HUD 45/45、音声23/23、390×844／375×667のUI 22/22・HUD 57/57・音声23/23を確認
- 393×852はHUD 57/57・音声23/23。UI 21/22の1件は390×844／375×667 exact viewport専用条件のため非適用
- A.6性能はpointer／wheel／音ONで平均約59.9fps、p95 18.7ms以下、33ms／50ms超0件を確認
- 390×844の既存全回帰は既知のウォールナット前面サンプル数ガード（995、要求1000超）だけ未達の87/88。ウォールナット表裏差7.88%、全テーマ最大差12.42%で画質指標自体と残る87件は合格
- 内部機構、レンダリング、照明、影、材質、構造透過、適応DPR、カメラ、Issue #2を変更していない
- WebM（VP9 + Opus）4本、モバイルUI画像2枚、イベント・性能・ブラウザレポートを証跡として追加
- 物理iPhoneで、pull／pushの発音時刻と1操作1回、右上スピーカー操作、ON／OFF・タブ移動・ホーム復帰時の二重音／音残りなし、tick／tock・正転巻上げ・逆転空転の音量と識別性を人手確認し、全項目合格
- 必須6bufferの完全性を判定し、部分読込失敗後は欠損音源だけを再試行。欠損中はONへ遷移しない
- OFF時は25msのgain ramp後にsourceを停止し、AudioContextをsuspendする
- スピーカーと選択部品HUDの非重複を自動検証し、PR #5のD2c3／照明変更は取り込まない。main v3.13.0の暗い既定照明はIssue #2最終微調整へ申し送る

## v3.13.0 — PR #4 モバイルオーバーレイ・HUD整理

- 未選択時の右上部品情報HUDを非表示とし、選択成功・解除・表示無効化・リセットと`hidden`／`aria-hidden`を同期
- 部品名と説明は既存`partsInfo`と`setPartInfo()`系統を共有し、右上HUDと学習タブの二重管理を回避
- 3Dキャンバス上の常設バージョンピルを撤去し、`v3.13.0`とPR #3基準情報を学習タブ内へ移動
- 文字付きメニューピルを、44×44px以上の操作領域、`aria-label`、`aria-expanded`を備えたハンバーガーへ変更
- 実機レビュー対応でハンバーガーの外枠・影・常時背景を撤去し、PCパネル折りたたみ時は387pxから左端10pxへ追従、再展開時は387pxへ復帰
- モバイルパネルを最大56dvhのボトムシートへ変更し、上部3D表示領域、stickyタブ、本文スクロール、safe-areaを維持
- iOS相当の`HH:mm`／`HH:mm:ss`を厳密解析し、`input`中の旧時刻上書きを防いだうえで`change`／`blur`／ボタンを単一の手動時刻適用関数へ統合
- 手動時刻適用でLive Syncの内部値・チェック・モードを同時解除し、位置1／位置2往復後も表示時刻と3針角を維持
- 375〜393px幅では時刻欄を1列化し、`minmax(0,1fr)`と`min-width:0`で入力右端と横オーバーフローを本文内へ収容
- Live Sync、構造3項目、表示グループ9項目、診断2項目、振幅自動設定の全16個を、ON金色／OFFグレー／disabledグレーアウトの44pxトグルカードへ変更
- 全16カードでラベル全体のtouch相当操作とnative inputのSpace activationを統一し、1入力1反転とモデル状態への復帰を確認
- 390×844、393×852、375×667でパネル高さ60dvh以下、上部3D表示領域35dvh以上、横スクロール0を確認
- パネルを開いた状態で1本指回転、2本指ズーム・パン、選択・解除、位置1巻上げ、位置2時刻合わせを確認
- Node 33/33、デスクトップ既存回帰86/86、PR #3 UI回帰20/20・22/22・22/22、PR #4 HUD回帰42/42・54/54・54/54・54/54、Visual Viewport 390×520で54/54、A.7 9/9を確認
- 1280×720→390×844→1280×720の動的resizeで、ARIA同期、44px、枠なし、387→10→387px、モバイル自動close／手動open／PC復帰を確認
- A.6 pointer／wheel性能、位置2 600フレーム、100往復、30/60/120fps、禁止干渉0/0を維持
- 390×844の既存全回帰は既知のウォールナット前面サンプル数ガードだけが3反復で986／998／996（要求`> 1000`）となり未達の87/88。表裏輝度差は全テーマ12.42%以内で、暗部・クリップ率を含む画質値と残る87件は合格。A.6性能も別途維持
- ライト、影、露出、tone mapping、材質、構造透過、DPR、カメラ、内部機構を変更していない
- モバイル実機の暗部・影・露出差はIssue #2へコメント追記し、本PRでは実装せずIssueをOpenのまま維持

## v3.12.0 — PR #3 UIアーキテクチャ整理

- 操作パネルを「操作」「学習」「技術」の3タブへ分割し、初期表示を操作タブへ統一
- 既存IDとイベント結線を維持したまま、りゅうず・視点・時刻・表示、学習情報、技術設定を目的別に再配置
- ARIA tabパターン、左右矢印、Home、End、フォーカスリング、hiddenパネルのフォーカス除外へ対応
- デスクトップ／モバイルでタブ別スクロール位置とパネル開閉後の選択タブを保持
- 右上と学習タブの選択部品情報を同じ`partsInfo`データから同期し、説明文の二重管理を回避
- タブ処理を`js/panel-tabs.js`へ分離し、animation loop、機構Object3D、カメラ、rendererから独立
- Node 33/33、デスクトップ既存回帰86/86、A.7 9/9、PR #3 UI回帰1280×720で20/20、390×844と375×667で各22/22を確認
- 390×844の既存全回帰は、既知のウォールナット輝度サンプル数ガード1件だけ未達の87/88。輝度差自体は全テーマ12.30%以内
- 内部機構、レンダリング、照明、影、材質、構造透過方式、Issue #2を変更していない

## v3.11.0 — Refactor A.7

- りゅうず、巻真、二位置移動クラッチの毎フレーム累積X座標更新を廃止
- 生成直後の位置1基準、位置2クラッチ端点、分解ベクトルを固定し、単一関数で絶対ローカル座標を合成
- 3部品を汎用分解表示ライターから除外し、同一Object3Dへの複数position writerを解消
- 遷移値の0〜1 clamp、1e-5端点snap、非有限値の位置1安全復帰を追加
- animation、位置切替、同期リセット、初期化、診断を同じ絶対配置関数へ統合
- 実rAF保持、100往復、30/60/120fps、3,600フレーム長時間、scale・quaternion・機構トポロジー不変の診断APIを追加
- 最終差分で33件のNode試験を通過。診断監査前の同一絶対配置本体でデスクトップ実ブラウザ86件を通過し、600フレーム末尾幅・100往復累積誤差・両位置禁止干渉をすべて0で確認
- A.6 pointer回転で平均59.57fps、p95 16.80ms、p99 17.80ms、33ms／50ms超0件を確認
- 390×844ではA.7 9/9を通過。全体は既存A.5輝度サンプル数ガードのみ未達の87/88で、輝度差自体は全テーマ12.43%以内

## v3.10.0 — Refactor A.6

- A.4の内部機構とA.5の照明・座標規約を変更せず、Arcball入力用`controlCamera`と描画・選択用カメラを分離
- 描画カメラの位置、Quaternion、targetをrAFでフレームレート非依存の指数補間へ変更
- `scaleFactor=1.16`を廃止し、wheelの正規化deltaを目標距離へ蓄積する連続ズームへ変更
- デスクトップ／モバイル別のDPR上限、p95監視、1秒クールダウン、操作後の段階回復を備えた適応解像度を追加
- 影の自動更新を停止し、初期化・構造表示変更・操作終了時だけ更新する方式へ変更
- 主ゼンマイGeometryを最大10Hz、操作中のヒゲゼンマイGeometryを約30Hz、時刻・残量・状態DOMを約10Hzへ分離
- 選択Box3を選択・分解・表裏分離・親位置変更時だけ再計算し、毎フレームの`controls.update()`を廃止
- フレーム時間、long task、CPU区間、カメラ角速度、jerk proxy、ズーム距離、適応DPRの診断APIを追加
- 10秒の実pointer回転、wheelズーム、正面、裏面、透過、390×844で平均約59.9fps、p95 18.7ms以下、33ms／50ms超0件を確認
- 25件の静的試験、デスクトップ77件、390×844で79件の実ブラウザ試験、性能比較資料を追加

## v3.9.0 — Refactor A.5

- A.4の機構座標・回転符号・運動グラフを変更せず、負Y文字板側と正Yムーブメント側へ独立キーライトを配置
- 低強度のカメラ追従フィルと側面リムを追加し、全方向回転中の黒つぶれを抑制
- `OrbitControls`をThree.js 0.160.0の`ArcballControls`へ置換し、極角制限のないカメラ回転へ変更
- `VIEW_UP = [0, 0, 1]`を追加し、全カメラプリセットから個別`up`設定を廃止
- Arcballのstart/change/endを既存のタップ抑止、複数ポインター、クールダウン、部品選択へ統合
- カメラ、ライト、輝度、回転自由度、モデルワールド変換、ビューポート、タッチ操作の診断APIを追加
- 4背景テーマすべてで表裏平均輝度差24.48%以下を確認
- 水平・上下とも360度超の連続回転、10プリセット、ネイティブドラッグ／ホイール、390×844の1本指／2本指操作を実ブラウザで検証
- 22件の静的試験、デスクトップ73件、390×844で75件の実ブラウザ試験、および静止画・連続GIF証跡を追加

## v3.8.0 — Refactor A.4

- 位置1のりゅうず、巻真、二位置移動クラッチ、巻上げ固定クラッチ、短い巻上げピニオン、丸穴車、角穴車、香箱真、主ゼンマイを実Object3Dと専用機構グラフで連結
- 10/40/60歯を共通モジュール0.082とし、巻上げピニオン―下側クラウン歯のX/Y直交接点、上側丸穴車―角穴車の中心距離4.10、軸方向帯、歯位相を一致
- 丸穴車を下側クラウン歯・垂直軸・上側平歯車からなる複合実部品へ再構成し、長い模式軸や非接触の直接角度加算を廃止
- `resolveWindingState()`／`applyWindingState()`を追加し、正転伝達、逆転空転、位置2切離し、コハゼ歯位相を単一ライターで解決
- 香箱胴と香箱真を独立回転体へ分離し、read-only香箱胴入力と巻上げ香箱真入力の二項関係 `香箱胴角 - 香箱真角` から主ゼンマイ蓄力を導出
- 残量加算を正転時の香箱真巻取り増分だけに限定し、明示時刻変更・日跨ぎの角度ラップによる誤巻上げを防止
- 負Y側の内部配置を維持したまま、文字板側を時計の表面・起動／リセット画面、正Y側をムーブメント裏面として定義
- 正面法線・上・右・時計回り符号を共通定数化し、主輪列、日の裏輪列、設定入力、脱進機、3本の針の回転符号を統一
- 分針―筒かな管、時針―時針管、小秒針―四番車軸の1:1拘束を維持したまま、文字板正面で時間増加を時計回りへ修正
- 巻上げトポロジー、伝達、ラチェット、香箱エネルギー、正面規約、文字板投影、針画面方向の診断APIを追加
- 20件の静的試験、60件の実ブラウザ試験、19枚のWebGL証跡を追加

## v3.7.3 — Refactor A.3

- 筒かな12枚、ミニッツホイール36歯、設定車32/32/18歯をモジュール0.08125の同一歯列へ統一
- ミニッツかな10枚と時針車40歯をモジュール0.078とし、2組の複合噛合い中心距離を1.95へ一致
- 5組すべてのピッチ半径・ピッチ径・中心距離をモジュールと歯数から導出
- 位置1でも設定車2、設定車1、設定中間車が表示輪列から従動する常時噛合いグラフへ変更
- 設定入力―設定中間車を状態別クラッチ境界、中心車―筒かなを時刻合わせ時の摩擦スリップ境界として定義
- `applyDisplayKinematics()`と`applyKinematicState()`を廃止し、通常運転と時刻合わせを単一resolver/applyへ統合
- 筒かな管、時針管、四番車軸を文字板側の各針取付ボスまで延長し、3本の針を実軸角へ1:1拘束
- 位置切替時のクラッチ基準角と摩擦スリップ量を捕捉し、設定前後の角度ジャンプを防止
- モジュール、動的歯合い位相、双方向比、秒停止、針連結、遷移連続性を検証する17件の静的試験を追加
- 実Object3D回転、正逆転、3D干渉、実管端と針ボスの接触、絶対針角、位置2時刻入力、同期ON/OFF連続性と現在時刻収束、脱進機回転符号、透過選択を検証する39件のブラウザ試験と14枚の証跡を追加

## v3.7.2 — Refactor A.2

- 設定レバー、ヨーク、ジャンパー、秒停止レバーの未完成な模式形状を標準モデルから削除
- 斜行中間軸、設定中間傘歯車、巻上げ垂直・上側中間軸を削除し、文字板側を最小構成へ再編
- `axialGear()`を廃止し、小径の巻上げ固定クラッチ、二位置移動クラッチ、設定入力クラッチへ置換
- りゅうずから時針車までの10ノード・9接続を単一のキネマティックチェーンとして定義
- 5組の設定・日の裏輪列へ歯数と中心線角度から算出する初期位相を追加
- 実Object3Dを参照する14個の3D円柱包絡と意図接触・禁止干渉ルールを追加
- Raycaster専用Layer、部品優先順位、投影面積、Pointer Capture、125 msクールダウンを追加
- 実ブラウザで正逆転、回転比、位置1切離し、禁止干渉0件、透過時選択を検証する統合テストを追加
- 8枚の実ブラウザ画面証拠とA.2実装・干渉レポートを追加

## v3.7.1 — Refactor A.1

- 地板、受、加工層、支持柱、軸受・ねじ座周辺を構造透過対象として明示登録
- 低透過時の `depthWrite` 制御と100%時の元材質状態への復元を追加
- Pointer Eventsへ入力を統一し、OrbitControlsの操作中は選択しない判定を追加
- 非表示階層、非表示グループ、低透過材質、診断表示を除外する選択フィルターを追加
- MultiMaterial部品のハイライトと材質復元に対応
- 巻真を日の裏輪列から退避し、両面ドッグクラッチ、設定中間車、巻上げ中間軸を追加
- 中心車軸を地板の貫通穴から筒かなへ連続させ、時針車を中空構造へ変更
- カメラプリセットの姿勢ベクトルを共通化し、真上視点の極点を回避
- 裏側の段付き加工座、巻真溝、支点座と補助照明を追加
- 選択、干渉、同軸、軸連続性、カメラ姿勢、タップ判定の自動テストを追加

## v3.7 — Refactor A

- 主輪列、日の裏輪列、巻上げ輪列の歯車定義を `js/mechanism-config.js` へ集約
- ピッチ半径和と噛合い角度から各軸中心を自動配置
- 歯先円、ピッチ円、歯底円、歯厚相当値、歯数、厚さ、回転方向、回転比を分離管理
- 車とかなの噛合い面を軸方向レイヤー定数で統一
- 通常、巻上げ、時刻合わせ、秒停止、ゼンマイ停止の状態と可動部品を明示
- 巻真を地板内端からりゅうずまで連続する軸として再構成し、位置2のクラッチ移動方向を修正
- アンクル受の支持脚を入石・出石の接触包絡外へ移動
- 機構設定を検証するNode.jsテストを追加
- Issueテンプレート先頭の不要な添付リンクを削除

## v3.6.4

- 歯車噛合いの最終局所調整
- 入石・出石周辺の支持構造を移動
- 日の裏輪列の動作表示を補強
- 巻真連結軸を追加
- りゅうず・巻真・キー・レスワークの軸線を調整

## 次版予定

教育用歯形を製造向けインボリュート／クラウン歯へ置換し、CADソリッド干渉、軸受荷重、バックラッシュ、潤滑、ばねトルク、寸法公差を検討する。
