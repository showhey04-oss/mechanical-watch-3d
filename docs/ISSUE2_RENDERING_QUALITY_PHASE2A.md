# Issue #2 レンダリング品質改善 Phase 2A

> 追補（Phase 2A.1／2A.2）：物理iPhoneでD2の初期表示・ズームアウト時暗化が確認され、現方式は不採用となった。D2/D3のRectAreaLightは元からworld固定であり、暗化原因はモバイル初期カメラ距離約106とfog 68/125の重なりだった。本資料のD2/D3判定と数値はPhase 2A時点の履歴として残す。ズーム診断とD2a/D2b比較は[Phase 2A.1](ISSUE2_RENDERING_QUALITY_PHASE2A1.md)、物理iPhone結果を受けた最新のD2c比較とユーザー確認ゲートは[Phase 2A.2](ISSUE2_RENDERING_QUALITY_PHASE2A2.md)を参照する。

## 結論

Phase 2Aでは、時計物撮りの白い反射帯・黒い反射帯・弱い接触影をThree.jsへ翻訳し、Baseline、Candidate C、Candidate D1/D2/D3を同一条件で比較した。通常アクセスの既定描画は変更していない。

- Candidate C：物理iPhone確認により不採用
- Candidate D1：IBL単独案は不採用
- Candidate D2：未採用、物理iPhone確認待ち
- Candidate D3：Phase 2Bの推奨候補。ただし未採用
- 最終統合：なし
- Issue #2：Openを維持

自動検査とChromium比較は実装条件・回帰を確認するものであり、画質の完成判定ではない。D2/D3の採否はユーザーの物理iPhone Safari確認後に決める。

## Candidate Cの最終判定

Phase 1で有望とした強度0.02のdistance-invariant fillは、ユーザーの物理iPhone確認では明るさ自体に大きな問題はなかった。一方で、光源色差と硬い・局所的な見え方が残り、受入不可だったため不採用とする。Phase 1当時の未確認評価は履歴として残し、Phase 2Aのこの判定を最新とする。

## 実装

### 共通PMREMスタジオ

`PMREMGenerator.fromScene()`で背景から独立した環境反射を1回生成し、候補ページの`scene.environment`だけへ適用する。

| 要素 | 色 | 寸法 | 位置 | 放射強度 |
| --- | --- | --- | --- | ---: |
| 大型キー反射面 | `#ffffff` | 34×22 | (16, -30, 20) | 4.80 |
| 大型フィル反射面 | `#ffffff` | 32×26 | (-20, 28, 10) | 2.75 |
| 細長い輪郭反射面 | `#ffffff` | 8×32 | (-28, -3, -12) | 2.10 |
| 前側黒フラッグ | `#000000` | 7×30 | (-23, -25, 3) | — |
| 裏側黒フラッグ | `#000000` | 8×28 | (24, 22, -4) | — |
| 周辺room／floor | `#181818` | 半径70／96×96 | floor z=-24 | — |

ブラウザ実測のPMREM初期化はD1 14.2ms、D2 21.9ms、D3 18.9msで、各ページ1回、texture増分1だった。背景テーマそのものは変更していない。

### Candidate D1

PMREM環境だけを使用し、PointLight、RectAreaLight、影を主照明から外す。反射環境単独の切り分け候補である。

### Candidate D2

D1にニュートラル白の大型RectAreaLightを加える。`RectAreaLightUniformsLib.init()`はD2/D3でだけ動的に初期化する。

| Light | 色 | 強度 | 寸法 | 位置 |
| --- | --- | ---: | --- | --- |
| studioRectKey | `#ffffff` | 1.00 | 30×20 | (15, -28, 18) |
| studioRectFill | `#ffffff` | 0.35 | 28×22 | (-18, 27, 11) |

RectAreaLightは影を生成しない。既存キー、リム、カメラPointLightはD候補のページ内だけ強度0にし、Baselineでは元設定を維持する。

### Candidate D3

D2へ接触影専用のDirectionalLightを1灯加える。

- 色：`#ffffff`
- 強度：0.15
- 位置：(14, -28, 21)
- shadow map：`PCFSoftShadowMap`
- map size：desktop 2048、mobile 1024
- bias：-0.00018
- normalBias：0.018
- frustum：実モデルboundsをlight spaceへ変換し、margin付きtight fitとtexel snapを適用
- 更新：通常の`shadowMap.autoUpdate=false`を維持する。運動由来の継続更新は、運転・巻上げ・時刻合わせ・時刻ジャンプ・Live Syncで影を落とすObject3Dの位置または回転に実差分が生じた場合だけ最大1回／200msとし、`running=true`だけでは更新しない。透過・表示・viewportなど描画状態変更時の明示更新は維持する

Three.js r160の`LightShadow`には`shadow.intensity`がなく、`PCFSoftShadowMap`使用時の`shadow.radius`も有効な調整値ではない。したがって影寄与はcarrier本体の0.15だけで制御し、radius調整済みとは扱わない。

## PointLight診断

既存`cameraFill`は`#d9e8ff`、intensity 0.38、distance 125、decay 2でカメラ原点に追従する。対象中心までの距離はfront/back約48.98、side約48.21、winding約12.81、motion-works約40.93だった。

4 viewport×5視点の画面空間差分では、平均正方向輝度寄与の全条件平均は0.000292、条件別最大0.00199、p99寄与の最大0.03136、最大局所差0.1244、新規クリップ画素は全20条件で0だった。最大値はいずれも対象距離が最短となる巻上げ拡大で発生した。PointLight単独の平均輝度は最大0.0458、クリップ率は0だった。

このChromium実測は、cameraFillが近接視点で局所ピークを強めることを示す一方、実際の新規クリップは示さなかった。物理iPhoneでの色差・硬さをこの一灯だけが主因と断定せず、D候補では小光源主体を避ける設計比較として扱う。部品選択用のamber PointLightは主照明ではなく、診断のpoint-only passから明示的に除外する。

## 定量比較

400条件のモデルsilhouette mask内framebuffer集約値を示す。クリップ率の最大は全候補とも巻上げ拡大で発生した。

| 対象 | 平均輝度 | 暗部率 | 平均クリップ率 | 最大クリップ率 |
| --- | ---: | ---: | ---: | ---: |
| Baseline | 0.1337 | 8.69% | 0.00922% | 0.0967% |
| Candidate C | 0.1535 | 6.37% | 0.00923% | 0.0967% |
| Candidate D1 | 0.1977 | 7.70% | 0.01646% | 0.2558% |
| Candidate D2 | 0.2279 | 6.49% | 0.03932% | 0.4790% |
| Candidate D3 | 0.2312 | 6.30% | 0.04272% | 0.5231% |

D2/D3は広い反射帯と両面の基礎照度を得た一方、巻上げ拡大の局所クリップがBaselineより増えた。これを許容できるか、黒潰れ・金属感・接触感との釣合いを物理iPhoneで確認する必要がある。

## 改善と副作用

| Candidate | 改善 | 副作用・Phase 2A判定 |
| --- | --- | --- |
| C | Chromiumの暗部をわずかに開く | 実機で色差・硬さ・局所性が受入不可。不採用 |
| D1 | 白／黒反射帯の切り分け、主照明の色統一 | 既存表裏輝度ガードを満たさず、面光源なしでは安定した基礎照度が不足。不採用 |
| D2 | 大型面光源でfront/backと内部輪列を柔らかく照明 | D1より平均輝度と局所クリップが増える。接触影なし。実機確認待ち |
| D3 | D2の見え方を保ち、針・文字板、歯車・受へ弱い接触影を追加 | shadow mapコストと局所クリップを要確認。Phase 2B推奨、未採用 |

## 性能

Baseline/C/D1/D2/D3について、1280×720と390×844のpointer回転、wheelズーム、opacity idleを各10秒、計30条件で測定した。

| 候補 | 最大p50 | 最大p95 | 最大p99 | 33ms超 | 50ms超 | 最小平均fps |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| D1 | 16.70ms | 17.60ms | 17.70ms | 0 | 0 | 59.91 |
| D2 | 16.70ms | 17.60ms | 17.70ms | 0 | 0 | 59.91 |
| D3 | 16.70ms | 17.40ms | 17.70ms | 0 | 0 | 59.91 |

Candidate Cはdesktop wheelで33ms超25・50ms超2、mobile pointerでp95 34.2ms、p99 116.6ms、33ms超66・50ms超19を記録した。これらを一時的な外れ値として除外せず、生データをreportへ残した。D1/D2/D3の全18条件はA.6基準内だった。

D3のtransform-driven 200ms影更新を有効にした運転中も追加6条件を各10秒再計測した。最大p95 17.70ms、最大p99 18.30ms、33ms超0、50ms超0、最小平均fps 59.90だった。運転中idleでは47回、pointer／wheel操作中は操作品質制御後に1〜3回のshadow refreshを記録した。

## 回帰

- Node：33/33
- Baseline desktop：86/86
- Baseline 390×844：87/88（既知のwalnut表裏輝度サンプルガード1件、閾値は未変更）
- Candidate D2：86/86、88/88
- Candidate D3：86/86、88/88
- D3影更新：停止idleは増分0、停止中の12時間ジャンプ・りゅうず遷移・Live Syncは増加、位置2で無変位の`running=true`は増分0（desktop／390×844）
- Candidate D1：desktop 85/86、mobile再実行88/88。desktop表裏輝度ガードと基礎照度不足のため不採用
- PR #3 UI：20/20、22/22、22/22
- PR #4 HUD：42/42、54/54、54/54、54/54
- 描画品質専用：24条件すべてpass
- A.7：9/9、位置2 600フレームのmax drift 0、100往復の累積誤差0、30/60/120fps一致
- 位置1／位置2の禁止干渉：0/0

Baseline mobileの既知ガードや不採用候補の未達を隠すための閾値緩和は行っていない。

## 変更していない範囲

内部機構、歯数・中心距離・位相、キーレス絶対配置、3針拘束、ArcballControls、カメラプリセット、Raycaster、PR #4 HUD／時刻入力、tone mapping、exposure、output color space、材質、構造透過、DPR、背景テーマは変更していない。

## Phase 2Bユーザー確認

D1/D2/D3を同じ物理iPhone Safariで開き、4テーマ×5視点、色差、黒潰れ、白飛び、柔らかな反射帯、接触影、金属感、黄銅／鋼／ルビー、選択ハイライトを比較する。D1は不採用の比較基準として提示し、採否ゲートはD2/D3とする。D3は推奨候補であるが、ユーザー確認前にReady化・マージ・Issue close・最終採用は行わない。

証跡索引は[Phase 2A evidence README](evidence/issue2-rendering-quality-phase2a/README.md)を参照する。
