# Phase 3B.2 基本装着部統合

## 結論

Phase 3B.1で人間承認されたE-BALANCEDコア外装へ、4本のラグ、2本の簡略スプリングバー、12時側／6時側の構造確認用ストラップ、簡略バックルをquery限定候補として接続した。

この候補は次の状態である。

- `STRUCTURAL_IMPLEMENTATION_CANDIDATE_NOT_DEFAULT`
- Phase 3B.1承認Head：`d51e4f8790596f7bc894e8c716edb0d54968d260`
- Phase 3B.2実装コミット：`51ab089e898cc3d2216d97fece83e334d9cd49c3`
- Baseブランチ：`feature/final-exterior-balanced-phase3b1`
- Headブランチ：`feature/final-exterior-balanced-phase3b2`
- APP_VERSION：`v3.15.0`
- 有効化：`?exterior=balanced`
- 通常URL：Phase 3B.2 Object3D追加0

Phase 3B.1のケース胴、ベゼル、風防、文字板、裏蓋リング、透明窓、保持リング、ケースチューブ、りゅうずインターフェースは変更していない。Phase 3B.2を通常表示へ既定採用せず、物理iPhoneを含む人間確認後に次判断を行う。

## 寸法

| 対象 | 実装値 |
| --- | ---: |
| lug-to-lug | 46.600 |
| ラグ外端Z | ±23.300 |
| ラグroot基準Z | ±16.500 |
| 左右ラグ外幅 | 24.400 |
| 各ラグ見付け幅 | 2.000 |
| スプリングバー中心 | Y=2.800 / Z=±21.800 |
| スプリングバー主径／ピン径 | 1.500 / 0.800 |
| 主軸長／有効長 | 20.000 / 20.800 |
| ストラップ幅 | 20.000 → 16.500 |
| ストラップ厚さ | 2.400 |
| 12時側中心線長 | 42.000 |
| 6時側中心線長 | 58.000 |
| バックル内幅／外幅 | 16.800 / 18.400 |
| バックル内長／外長 | 3.200 / 4.800 |
| バックル厚さ | 0.650 |

ストラップは中心線テンプレートをCatmull-Rom補間し、中心線長を指定値へ正規化した閉合swept-prismである。ラグ側から端部へ幅を単調に縮小し、ケースから離れるほど正Yへ曲げる。物理シミュレーションや実革の曲げ剛性は再現しない。

## Geometry

4ラグ、2スプリングバー、2ストラップ、バックルはすべて有限の閉合indexed Meshである。実ブラウザruntimeとNode試験で次を確認した。

- 非有限position／normal／index：0
- 退化triangle：0
- 重複triangle：0
- 逆向き重複triangle：0
- non-manifold edge：0
- winding mismatch：0
- signed volume：正
- CSG：不使用
- Phase 3B.1 Geometry変更：なし

ラグは4個の独立Meshで左右・12時／6時対称とした。スプリングバーは教育表示用の段付き軸形状であり、実ばね・伸縮・製造公差は`UNVERIFIED`である。

## 接触と干渉

意図接触は次のように禁止干渉から分離した。

- ラグ ↔ ケース胴：`INTENDED_LUG_CASE_CONNECTION`
- スプリングバー ↔ ラグ：`INTENDED_SPRING_BAR_SEAT`
- スプリングバー ↔ ストラップ接続包絡：`INTENDED_STRAP_BAR_CONNECTION`
- 表示安定用の局所余裕：`EDUCATIONAL_RENDERING_CLEARANCE`

実Geometry診断結果：

| 状態 | 機構禁止干渉 | 既存外装禁止干渉 | Phase 3B.2禁止干渉 |
| --- | ---: | ---: | ---: |
| 位置1 | 0 | 0 | 0 |
| 位置2 | 0 | 0 | 0 |

ラグrootはケース胴へ狭く埋め込む意図接続で、算定clearanceは-0.294433である。これは禁止干渉件数へ含めない。ラグ―ベゼル2.014619、ラグ―裏蓋リング0.489619、ストラップ―ケース3.576280以上、ストラップ―りゅうず18.346425以上の正clearanceを確認した。

## 部品登録と選択

次の9部品を個別登録した。

1. E-BALANCED 12時側左ラグ
2. E-BALANCED 12時側右ラグ
3. E-BALANCED 6時側左ラグ
4. E-BALANCED 6時側右ラグ
5. E-BALANCED 12時側スプリングバー
6. E-BALANCED 6時側スプリングバー
7. E-BALANCED 12時側ストラップ
8. E-BALANCED 6時側ストラップ
9. E-BALANCED 簡略バックル

ラグは外装標準優先度、ストラップとバックルは内部選択を常に奪わない低優先度とした。スプリングバーはラグ／ストラップ非表示または分解表示で選択できる。実ブラウザの通常pointerでストラップを選択し、選択強調、右上HUD、学習タブ同期を確認した。透過16%では内部の設定車2を選択できる。

## 表示・透過・分解

次を同一Object3Dから確認した。

- 構造透過100%／50%／16%
- attachment family全表示／ラグ／バー／ストラップ／バックルの個別表示
- Phase 3B.2全非表示
- 分解表示
- 表裏分離
- 選択解除後の材質復元
- 表示復元後のposition／quaternion／scale完全復元

毎フレームの相対加算は使用せず、生成時の基準transformとUI状態から絶対配置する。

## 材質とPhase 3Cへの保留

金属部品は既存E-BALANCED金属材質を複製し、既存ケース材質を変更しない。ストラップは`STRUCTURAL_PLACEHOLDER_NOT_PHASE3C_STYLE`の中立低光沢グレーである。

次はPhase 3Cへ保留する。

- 最終ラグ造形
- サテン／ポリッシュ
- ダークブラウンレザー
- 革シボ、ステッチ、穴列、コバ
- ループ、裏材、ロゴ
- 最終バックル意匠と可動舌
- りゅうずのコインエッジ意匠
- 高級仕上げ

製造公差、防水、耐久、曲げ剛性、実着脱は`UNVERIFIED`である。本実装は製造CADではない。

## World boundsとカメラ

| 包絡 | X | Y | Z |
| --- | ---: | ---: | ---: |
| Phase 3B.1コア | 39.600 | 8.695 | 39.600 |
| Phase 3B.2装着部 | 24.400 | 30.070 | 88.162 |
| 統合候補 | 39.600 | 32.685 | 88.162 |

APPの既存reset／frontはケース径を従来と同じ比率で表示するため、全ストラップ端を同時に確認するにはwheelで可逆にzoom-outする。これは寸法調整の根拠ではなくレビュー方法である。

次を変更していない。

- ArcballControls
- 入力用／描画用カメラ分離
- `VIEW_UP`
- preset位置・target
- near／far
- DPR
- camera smoothing
- pointer／wheel処理

候補boundsを通常カメラfitへ混入させず、既定ケース表示を小さくしない。

## 回帰

### Node

最終文書・証跡試験を含むNode 134/134に合格した。

### 実ブラウザ

| suite | 結果 |
| --- | ---: |
| Phase 3B.2 Desktop 1280×720 harness | 30/30 |
| Phase 3B.2 Mobile 390×844 harness | 30/30 |
| Desktop総合 | 86/86 |
| 390×844総合 | 88/88 |
| PR #3 UI 375×667 | 22/22 |
| PR #4 HUD 393×852 | 57/57 |
| v3.14音声 | 23/23 |
| Phase 2C 3包絡 | 6.645 / 3.190 / 6.745 |
| 位置1／位置2禁止干渉 | 0 / 0 |
| 三針1:1拘束 | 合格 |

Desktop／MobileでGeometry、干渉、world bounds、Phase 2C包絡が一致し、viewport依存値だけが変化した。通常pathは固定mainと237,380 byte、SHA-256 `f3bdd25d543c11a4ae1dc08a3020a60358a85d5d20a90ccff9b8242bc35bd003`でpixel exactである。

### A.6性能

同一in-app BrowserでPhase 3B.1 → Phase 3B.2を比較した。

| viewport / 操作 | candidate fps | p50 | p95 | p99 | >33ms | >50ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop idle | 59.113 | 16.7 | 16.8 | 18.3 | 1 | 1 |
| Desktop pointer | 59.074 | 16.7 | 17.2 | 18.3 | 1 | 1 |
| Desktop wheel | 59.052 | 16.7 | 17.2 | 18.4 | 1 | 1 |
| Mobile idle | 59.197 | 16.7 | 18.6 | 18.7 | 1 | 1 |
| Mobile pointer | 59.256 | 16.7 | 16.8 | 18.3 | 1 | 1 |
| Mobile wheel | 59.248 | 16.7 | 16.8 | 18.2 | 1 | 1 |

全条件でreversal 0、stop-then-jump 0、wheel距離単調、model transform invariantを維持した。A.6絶対閾値およびfps -5%／p95 +2msの同一環境差分基準に合格し、試験閾値は変更していない。

## 証跡

証跡ルートは`docs/evidence/final-exterior-balanced-phase3b2/`である。

- 実WebGL canvas：Desktop正面／斜め／側面／裏面、Mobile正面／側面／裏面
- 実in-app Browser：ラグ／バー／ストラップ／バックル／内部選択、Mobileパネル開閉
- 派生比較板：Phase 3B.1対3B.2、透過、表示、選択、camera occupancy
- review GIF：全周、ラグ、ストラップ、りゅうず位置、透過、選択、Mobile、機構操作
- JSON：設定、各Geometry、bounds、camera occupancy、干渉、選択、透過、回帰、性能
- closed-world manifest：bytes／SHA-256

GIFは実ランタイムcaptureを時系列に並べた5〜10秒のreview animationであり、連続WebM録画ではない。モデル本体の回転を証明する用途には使わず、A.6の実pointer／wheel診断でカメラ入力とmodel transform invariantを確認する。

## 人間確認

実装コミット固定URL：

`https://raw.githack.com/showhey04-oss/mechanical-watch-3d/51ab089e898cc3d2216d97fece83e334d9cd49c3/?exterior=balanced`

PCと物理iPhoneで次を確認する。

- 4ラグとケース胴の接続形状
- スプリングバーの教育表示としての理解しやすさ
- 12時側／6時側ストラップの幅、曲がり、全長バランス
- バックル位置と簡略形状
- りゅうず位置1／2の指掛かり、pull／push
- 100%／50%／16%／非表示
- 外装から内部への選択切替
- パネル開閉後の1本指回転、2本指ズーム
- 巻上げ、時刻合わせ、秒停止、作動音
- ケース表示を小さくせず、wheel zoom-outで全ストラップを確認できること

人間確認前にReady化、マージ、既定採用、Phase 3C開始を行わない。
