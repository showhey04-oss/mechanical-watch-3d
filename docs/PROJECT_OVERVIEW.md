# プロジェクト概要

## 目的

機械式時計の内部機構を、ブラウザ上で回転・透過・分解・操作できる教育用3Dモデルとして構築する。

完成時には以下の3モードを統合する。

1. 時計モード  
   現在時刻または指定時刻を表示する。

2. 機構観察モード  
   輪列、脱進機、調速機、巻上げ、時刻合わせを観察する。

3. 学習モード
   部品名称、機能、動力経路を確認する。

## 設計方針

- 完全な製造CADではなく、教育用としての理解しやすさを優先する
- ただし、歯車噛合い・部品接続・動作状態は視覚的に納得できる精度を目指す
- iPhoneを含むモバイルブラウザで利用できること
- GitHub Pagesで公開可能な静的構成を維持する
- UIの機能追加より、機構の整合性を優先する段階では構造改修を先行する

## 基準版

初期構造基準はv3.6.4、main公開基準はv3.15.0とする。v3.15.0はS86文字板表示比率を通常寸法として採用し、v3.14.0の機構・描画基準を維持する版である。v3.14.0は直前基準として、v3.13.0の機構・描画基準を維持した音響追加版である。

## 現在の開発判断

Refactor Aで輪列・高さ面・回転状態をパラメータ化し、PR #3／#4でUIを整理した。PR #6で、機構と描画の既存挙動を変更せず、既存のビート番号・実Object3D回転角・ユーザーりゅうず操作の方向別節度閾値交差を読み取る機構同期作動音をv3.14.0へ追加した。

作動音は教育・演出用の合成音であり、実物のETA 6498-1の録音ではない。初期状態はOFFとし、ユーザーがONにした後にだけWeb Audioと音源を初期化する。音イベント系は機構状態へ値を書き戻さず、初期化・診断・状態復元も発音契機にしない。

現在の改修フェーズは「Final Stabilization Phase 3B.4 stack promotion audit、ChatGPTレビュー待ち」とする。統合証跡Head `d16037a75d85d705434d8b73ef5293511052f65e`でPhase 3B.4aのモバイル全長構図、Phase 3B.4bのiOSマルチタッチ、Phase 3B.4c R2.4.2のproduction audio／foreground復帰を統合し、PR #25はmerge commit `d4fa76182d4955e0a78f31120ea2705a19f67220`としてPR #24へ統合済みである。Node 442/442、Chrome／Playwright WebKit／Native Safari Desktop・Mobile、preset、9部品選択、HUD／learning同期、blank clear、multi-touch 100 cycle、production audio、visibility 30 cycle、10分相当stress、12/12 protected pathは合格した。性能は既存の隔離実行で製品回帰を再現せず`PHASE3B4_STACK_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION`とするが、endpoint security高負荷のためclean-process最終測定は`NOT_TESTED`である。clean環境の絶対性能PASSやMcAfee停止環境PASSとはせず、製品修正も行わない。PR #24はOpen／Draft、D2c3、framing、input、audio候補はquery限定・未採用、Issue #2はOpenを維持する。Phase 3B.2の透過不連続受容とOIT完成後延期、Phase 3C.1～3C.3の人間承認済み基準、v3.15.0、S86、内部機構、通常レンダリング、DPRを変更しない。

人間確認で選定したS86をv3.15.0の通常文字板表示寸法として採用する。対象は文字板表示系だけで、dial ring径27.692、index円径25.456、分針長12.040、時針長8.600、小秒表示円径7.740、小秒針長3.268である。内部機構、小秒中心、四番車軸、Y方向配置、針と軸／管の1:1回転拘束は維持する。試験状態は`ACCEPTED_WITH_TEST_ENVIRONMENT_LIMITATION`であり、実施済みA/BでPR固有回帰は0件、全ブラウザ試験行列は環境制約により未完了である。

寸法・比率調整はPR #10のS86採用とPR #11のPhase 2C監査で完了扱いとする。Phase 3Aは外装Geometryを追加せず候補を比較し、E-BALANCEDを`APPROVED_FOR_PHASE_3B_IMPLEMENTATION`かつ`NOT_APPROVED_FOR_DEFAULT_ADOPTION`として選定した。Phase 3B.1では`?exterior=balanced`だけでコア外装を生成し、通常URLのObject3D／Geometry／Material追加数を0に保つ。第4候補でベゼルと裏蓋リングを全面テーパー化し、最終候補はその断面を維持したままケース胴の最大径帯を3.450から1.950へ短縮、前側／後側テーパーを2.160／3.385へ延長したquery限定実装である。総厚8.695、最大径39.600、端部径38.900、表示開口29.800は不変である。主テーパー被覆率はベゼル0.888889、裏蓋リング0.956766で、保持座以外の意図しない水平区間は0である。総厚方向性、ケース胴テーパー、りゅうず位置1／2、指掛かり、pull／push、保持リング方針、透過16%、回転・ズーム、時計機能、作動音、物理iPhone操作性はPhase 3B.1で人間確認済みである。

Phase 3B.2では、Phase 3B.1のGeometryを変更せず、query時だけ4ラグ、2スプリングバー、簡略ストラップ2本、簡略バックルを追加する。lug-to-lug 46.600、ラグ側幅20.000、ストラップ中心線長42.000／58.000を構造候補として実装し、位置1／位置2の新規禁止干渉0、Phase 2C包絡・S86・A.7・三針拘束・通常path pixel exactを維持する。ストラップ材質とバックルは教育表示用placeholderで、製造公差、防水、耐久、着脱機構とPhase 3C意匠は`UNVERIFIED`または`DEFERRED`である。追加world boundsのため全装着部の確認にはwheel zoom-outが必要だが、カメラ基盤とプリセット定数は変更しない。物理iPhoneでの接続、回転・ズーム、選択、透過、操作性は人間確認待ちである。ETA 4.50 mmは`REFERENCE_DATUM_UNRESOLVED / UNVERIFIED`のまま外装厚さの調整量に使用せず、表示開口と全体比率を外装統合レビューで再確認する。

Phase 3C.1では、Phase 3B.2構造を保護したまま、query時だけ正式時計本体意匠を生成する。実テンプworld中心[7.700,1.730,1.800]を文字板へ投影し、直径6.600、細身profiled metal rim、中央軸受landを保持する2つの物理地板窓を配置する。白系アイボリー`#F2EDE5`、安定silver`#E7EAED`、大型faceted bar、半径14.200の同径60 minute dots、視覚径8.500の小秒recess、外径7.120のopen-heart rim、非屈折近似dome、6時通常バーを含む13 index Meshを人間承認済み基準とする。候補専用「外装」表示グループは25部品を既存FRONT／CORE／BACK／PLATE状態と合成し、針3本とりゅうずをON／OFF対象外に保つ。

Phase 3C.2では、`strapStyle=phase3c2`追加時だけPhase 3B.2の構造確認用ストラップ2本と簡略バックルを置換する。中心線長75.000／115.000、幅19.700→16.000、厚さ2.600→2.050、12 model-unitの初期直線と曲率反転0の中心線、実スプリングバーポケット、7貫通穴、丸い自由端、定革・遊革、尾錠枠・つく棒・取付バー、尾錠側巻込みを閉合indexed Geometryで構成する。128×128 procedural calf DataTexture、同系色ステッチ、黒いコバを用い、外部画像、CSG、革物理、締結アニメーションは追加しない。位置1／位置2の禁止干渉0、通常path／Phase 3C.1-only path pixel exact、選択、opacity、外装ON／OFF、split／explode、Desktop／390×844性能基準を維持する。Head `f245a5a9d68d5205e7609479ffefd711376e4930`は`HUMAN_ACCEPTED_PHASE3C2_WITH_DEFERRED_RENDERING_POLISH`である。

Phase 3C.3では、`integration=phase3c3`追加時だけ小秒凹面へ非描画selection proxyを4枚生成し、既存の小秒表示へ選択を委譲する。Desktop／390×844の100%／50%で4/4、16%時の内部選択、外装ON/OFF、split／explode、復元、位置1／2、三針拘束、Object3D整合を確認した。queryなし、Phase 3C.1-only、Phase 3C.2-onlyは承認Headとpixel exactである。PCと物理iPhoneでは完成時計、小秒表示、内部選択、選択解除、外装OFF、分離・分解・復元、りゅうず、時計機能、作動音、学習モードを人間確認合格とした。15分後に軽微な発熱を観察したが機能劣化は報告されず、Issue #2最終候補で再試験する。Issue #2の矩形影、透過不連続、前後輝度差、PC／iPhone差、D2c3はPhase 3C.3で修正・採用していない。Ready化・マージ・既定採用は未実施である。

Issue #2 Phase 3Aでは完成外装にbaseline／D2a／D2c3をquery限定で重ね、198枚の実WebGL PNGと性能・回帰を保存した。正式判断は`ISSUE2_PHASE3A_AUDIT_ACCEPTED_CANDIDATES_REJECTED_NO_ADOPTION`で、coverageは`DIMENSIONAL_COVERAGE_SET_NOT_FULL_CARTESIAN`とする。D2a／D2c3は矩形影を除去するが、前後輝度差、A.5ライト契約、性能差分を満たさない。D2aは視覚参考として棄却し、D2c3は`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`としてquery実装と証跡だけを維持する。通常pathとPhase 3C.1／3C.2／3C.3-onlyは変更せず、採用候補なしとする。

Issue #2 Phase 3B.1では、Phase 3A判断記録Headから別Draftを作り、既存DirectionalLightのshadow carrier OFF、5状態unionの固定shadow camera fit、fog 160／260を単独・単純合成した6候補を比較した。1056枚の実WebGL PNG、性能、protected path、回帰を取得したが、矩形影、前後面バランス、Mobile far visibilityを同時に満たす候補はない。状態は`ISSUE2_PHASE3B1_NO_TECHNICAL_FINALIST`、Stage 2は`SKIPPED_ZERO_TECHNICAL_GATE_CANDIDATES`で、物理iPhoneと既定採用を実施しない。

Issue #2 Phase 3B.1bでは5状態tight shadow cameraを512／1024で再監査し、projection boundary intersection 0でも広い斜め帯が残るためtight routeを終了した。Phase 3B.1cは`dial-exterior`を主要caster群として特定し、opacity連動smoothstep attenuationと固定normalBias候補をquery限定比較した。attenuationは境界・斜め帯・性能を改善したが前後面のbaseline比悪化上限を満たさず、normalBias候補はMobile性能も満たさない。状態は`ISSUE2_SHADOW_ROUTE_EXHAUSTED_NO_TECHNICAL_FINALIST`、Stage 2未実施、34 protected pathはPR #20固定Headとpixel exactである。Shadow-offとD2c3は未採用の人間判断候補として保持し、追加shadow実験は推奨しない。

Issue #2 Phase 3B.2はShadow-offとD2c3をdual baselineとし、13 opacityで`transparent`／`depthWrite`の固定方式3候補をquery限定比較した。3候補はproperty toggle 0、Material replacement／UUID change 0を達成したが、`stable-depth-base`は内部視認性、`stable-depth-off`はD2c3 wheel性能、`group-stable-depth`はD2c3 selected性能で不合格となった。候補固有browser failure 0、UI 22/22、HUD 57/57、audio 23/23、A.7 9/9、禁止干渉0/0、protected path 42/42を維持したが、技術finalist 0件のためStage 2と物理iPhoneを実施しない。状態は`TRANSPARENCY_CONTINUITY_LIGHTWEIGHT_ROUTE_EXHAUSTED_OIT_DECISION_REQUIRED`であり、OITは未実装、Issue #2はOpen、PR #5はOpen／Draft、D2c3は未採用fallbackのままとする。

Issue #2 Phase 3B.3は新しい描画方式を追加せず、現行透過方式を共有するShadow-offとD2c3の最終人間レビューpackageを作成した。PCでは両候補合格、物理iPhone 15分ではShadow-offを暗いfull-length表示のため不合格、D2c3を性能tradeoff込みで合格・選定した。D2c3は既定採用せず、モバイル全長構図、iOS音響ペーシング、温度再試験を安定化工程へ残す。冷却5分は`COOLDOWN_PROTOCOL_DEVIATION_5MIN`、progressive frame dropとSafari reloadは`NOT_REPORTED`である。

Issue #2 Phase 3B.4aは、選定D2c3のモバイル全長構図だけをquery限定で変更する。390×844の実Geometry 407,428頂点からraw fit 199.068109、2.5%安全余裕込み204.044811を導出し、静的`maxDistance=204.1`を採用候補とした。最小余白4.0265%、near／far clipping 0、初期／復帰32比較とDesktop固定画像48比較はpixel exact、Desktop selected 8比較は選択・camera・transform exact、pinch／wheel、復帰、差分性能6比較に合格した。iPhone 16／iOS 26.5.2の15分確認では初期構図、全長、余白、fog許容、preset、最大距離回転、設定車2選択、HUD／学習同期、解除、split／explode／restore、軽微な発熱を合格とした。一般tap異常は報告されていないが、2～3分後の二本指pan／pinch／rotation劣化は`DEGRADATION_REPORTED`、手動reloadで復旧し、Phase 3B.4bへ分離する。iOS音響ペーシング低下は再現済みだが本工程では修正しない。

ケース胴はY=-2.860～4.635の単一閉合Meshとし、外径38.900→39.600→38.900の前後テーパー、内径37.800不変、実りゅうず包絡に対する局所逃げを持つ。局所逃げは必要最小0.249174から生成後gapを再計測して0.304118を採用し、上限0.330、位置1gap 0.030063、最小壁厚0.550000を満たす。CSGは使用せず、りゅうず―チューブの0.056857シート関係は`PHASE3B1_IMPLEMENTATION_ASSUMPTION`のまま禁止干渉から分離する。

## 本体完成要件

- 寸法・比率調整、最終外装、全体品質とIssue #2の最終調整を完了する
- 動画、PC、iPhoneによる統合レビューを行い、指摘修正と最終確認を完了する
- 時計モード、機構観察モード、学習モードを統合し、部品名称、機能、動力経路を確認できる

厳密な組立順序や組立／分解手順は本体完成要件に含めない。

## 完成後の任意改善

- 厳密な組立順序と組立／分解手順
- オフライン対応とPWA化
- 高級仕上げ
