# Issue #2 レンダリング品質改善 Phase 2A.1

> 物理iPhone確認結果（Phase 2A.2への引継ぎ）：端末再起動後、従来の黒潰れは解消方向へ改善し、nearでは部品の視認性が良好だった。一方、D2aとD2bの見た目の差は小さく、initial／farでは中間調が低く広い暗部とOLED上の強い明暗差が残った。このためD2a／D2bはいずれも未採用とし、D2aを次段の基盤、D2bを比較履歴とする。最新のD2c1／D2c2／D2c3比較とユーザー確認ゲートは[Phase 2A.2](ISSUE2_RENDERING_QUALITY_PHASE2A2.md)を参照する。

## 結論

物理iPhoneのホーム画面起動で確認されたCandidate D2の初期表示・ズームアウト時暗化は、RectAreaLightがカメラ距離へ追従したためではない。D2/D3のkey／fillは実装時からcamera配下ではなくscene直下にあり、カメラをnear／initial／farへ移動してもlight-to-model距離、寸法、強度、色は変化しなかった。

暗化の主要因は、モバイルの画面合わせで初期camera-to-model distanceが約106まで離れ、legacy fogのnear 68／far 125へ深く重なることである。390×844の初期距離は約105.99、393×852は約106.18で、デスクトップ初期距離約48.98とはfog寄与が大きく異なる。

- Candidate D2：物理iPhone結果により現方式を不採用
- Candidate D3：D2と同じlegacy fog条件を持つため未採用を維持
- Candidate D2a：world固定スタジオ＋候補限定fog 160/260。物理iPhone確認後も未採用だが、次段の中間調再調整の基盤とする
- Candidate D2b：方位追従・固定半径スタジオ＋候補限定fog 160/260。D2aとの差が小さかったため比較履歴として保持する
- 最終統合：なし
- Issue #2：Openを維持

D2a/D2bはquery限定でズーム安定性を比較し、物理iPhone結果に基づいてそのままの採用を見送った。通常アクセスのv3.13.0既定描画は変更していない。

## 診断

### ライトとカメラ距離

D2/D3のRectAreaLightについて、同一正面方向のnear／initial／farで次を記録した。

- parent、visible、position、quaternion
- width、height、intensity、color
- camera-to-model distance、light-to-model distance
- PMREM環境状態
- framebuffer平均輝度、dark ratio、clipped ratio
- 文字板、針、黄銅輪列、鋼輪列のisolated representative metricとvisibleSurface metric

keyのlight-to-model distanceは約36.90、fillは約33.87でカメラ距離にかかわらず一定だった。したがって「ズームアウトにRectAreaLightが距離追従し、物理的な距離減衰で暗くなる」という最優先仮説は棄却した。PMREMもページ内で1回だけ生成され、カメラ距離による再生成や強度変更はない。

### Fog

legacy fogはnear 68／far 125である。デスクトップ初期距離約48.98では対象がnearより手前にあるが、モバイル初期距離約106では対象がfog区間の後半へ入り、さらにfar距離ではfar 125へ近づく。D2/D3のライトが固定されていても、最終色へ合成されるfogがズームアウトに伴って増えるため、文字板・針・輪列が背景色へ近づき黒潰れして見えた。

この修正ではD2/D3や通常アクセスのlegacy fogを変更しない。D2a/D2bのquery限定ページだけnear 160／far 260へ退避し、候補比較と原因切り分けを行う。

## Candidate D2a／D2b

| 項目 | D2a | D2b |
| --- | --- | --- |
| PMREM | world固定 | world固定 |
| RectAreaLightのparent | scene | scene |
| 位置・向き | world固定 | カメラ方位へ追従 |
| モデル中心からの半径 | 固定 | 固定 |
| ズーム追従 | なし | なし |
| 候補限定fog | 160/260 | 160/260 |
| 既定採用 | なし | なし |

D2aはカメラ回転でもライトを動かさず、物撮りスタジオと被写体の関係を固定する。D2bはカメラQuaternionが変化したときだけ、カメラ方位とモデル中心を基準に元のオフセットを固定半径上へ回す。カメラ位置やズーム距離をライト半径へ使用せず、方位が変わらないズームやパンではライト更新も発生しない。

D2bは裏面・側面の暗部を開きやすい一方、ハイライトがカメラへ貼り付いて見える可能性がある。自動測定だけではこの知覚上の差を確定できないため、D2aを先に物理iPhoneで確認し、D2bを同条件の代替として比較する。

## ズーム安定性

次の固定条件でD2現状／D2a／D2bを比較した。

- viewport：1280×720、390×844、393×852
- theme：navy、obsidian、walnut、gallery
- view：front、back、side
- distance：near、initial、far
- 時刻10:10:30、停止、構造透過100%、非分解、表裏分離なし、パネル閉

D2a/D2bの定量受入条件は、全viewport・4テーマの同じfront方向におけるnear／initial／farで、文字板、針、黄銅輪列、鋼輪列のisolated representative metricをinitial比±15%以内とし、ライト色、寸法、強度、固定半径がズームで変化しないこととする。証跡生成と`--check`はfrontの条件外結果を失敗にするため、確定値は機械可読レポートを正とする。

back／sideでも同じmetricを記録するが、金属反射面と画面への投影面積が距離により変化するため、±15%定量ゲートの対象外とする。これらの視点はD2現状／D2a／D2bの同一条件画像、visibleSurface、ライト距離を診断材料とし、反射帯・黒潰れ・ハイライト追従感を主観比較する。

ここで±15%判定に使用するisolated representative metricは、測定対象以外のObject3Dを一時的に非表示とし、対象Object3Dを実際の材質・ライト・カメラ・fogで描画した画素だけを、別途生成した可視面maskで集計する代表輝度である。bounding boxや固定矩形の平均ではなく、対象形状の描画画素を距離間で比較する。描画後は各Object3Dの`visible`と材質状態を正確に復元するため、診断は通常フレームの状態を変更しない。

同じレポートには、通常の合成画面で実際に見えている対象面だけを集計するvisibleSurface metricも併記する。frontでは文字板が輪列を遮蔽するため、黄銅輪列と鋼輪列の`visibleSurface.sampleCount`が0になる場合があり、これは測定失敗ではなく正しい遮蔽結果である。隠れた部品のズーム安定性はisolated representative metricで検証し、実画面での見え方はvisibleSurface metricと画像比較で確認する。

frontの±15%条件は自動測定上のズーム安定性だけを示す。isolated表示そのものを画質の採用根拠にはせず、back／sideを含む金属反射帯の自然さ、遮蔽を含む合成画面、ハイライト追従感の合否は物理iPhoneで判断する。

### 自動計測結果

| 指標 | 結果 |
| --- | --- |
| D2 key／fill light-to-model | 36.8951／33.8711、near／initial／farで不変 |
| D2・390×844 front camera distance | 79.4913／105.9884／120.0000 |
| 同legacy fog factor | 0.1055／0.7405／0.9783 |
| 同framebuffer平均輝度 | 0.1894／0.0999／0.0653 |
| D2a front主要4部位の最大絶対変動 | 12.6573%（全viewport・4テーマ、目標15%以内） |
| D2b front主要4部位の最大絶対変動 | 12.6573%（全viewport・4テーマ、目標15%以内） |

最大変動は1280×720・gallery・文字板・farで記録した。back／sideでは視点距離による金属反射面と投影面積の変化を含むため、この数値ゲートではなく画像boardと保存metricで比較する。

## 起動完了とホーム画面起動

起動後5秒間を250ms間隔で記録し、次の状態を明示した。

- `navigator.standalone`と`(display-mode: standalone)`
- `location.href`、`location.search`、解決Candidate、theme
- camera position、target、distance
- CSS viewport、Visual Viewport、DPR、drawing buffer
- PMREM生成、`scene.environment`適用
- RectAreaLightUniformsLib初期化、Candidateライト構築
- D3の初回shadow更新
- 初回正常描画と`renderStatus`

`renderStatus`は、対象Candidateに必要なPMREM、environment、uniforms、ライト、D3 shadow、および1フレーム以上の正常描画が揃うまで完了扱いにしない。自動ブラウザの直接URL起動ではqueryと解決Candidateが維持された。

自動ブラウザではiOSの`navigator.standalone`を再現できないため、ホーム画面からの実起動でquery、D2a/D2b、PMREM、初期表示、ズーム、パネル開閉、3D操作が維持されるかを物理iPhoneのユーザー確認項目として残した。後続の実機確認結果は冒頭の追補と末尾の「物理iPhone確認結果と次のゲート」を正とする。

12条件すべてで21 sample、query維持、PMREM／environment／Candidateライト／初回描画の起動ゲートを確認し、D3では実shadow map寸法の生成後にshadow-readyとなった。自動環境のstandalone値は`navigator.standalone = null`、display modeは`false`であり、物理iPhone合格を代替しない。

## 回帰と性能

- Node：33/33
- desktop：baseline 86/86、D2a 87/87、D2b 87/87
- 390×844：D2a 89/89、D2b 89/89。baselineは既知のIssue #2輝度項目だけが未合格で87/88
- PR #3 UI：1280×720 20/20、390×844 22/22、375×667 22/22
- PR #4 HUD：1280×720 42/42、390×844／393×852／375×667はいずれも54/54
- 描画品質：D2a／D2bとも3 viewportで20/20
- A.7：9/9、位置ドリフト0、位置1／位置2禁止干渉0/0
- 現行HeadのA.6 12計測：p50 16.7ms、p95 17.4–17.8ms、p99 18.2–18.5ms、33ms／50ms超過0

Phase 2Aの45 browser runと36 performance runは履歴補助証跡として保持し、現行Head実行とは区別してレポートへ記録した。Phase 2A.1の現行Headではbrowser／UI／HUD／描画19 runとperformance 12 runを追加実行している。

## 変更していない範囲

- 通常アクセス、D1/D2/D3のfogと既定描画
- D3のshadow camera、shadow map、bias、normalBias、transform-driven更新
- tone mapping、exposure、output color space、材質、構造透過、背景テーマ、DPR
- ArcballControls、カメラ平滑化、Raycaster、部品選択、PR #3 UI、PR #4 HUD／時刻入力
- 内部機構、A.7絶対配置、巻上げ、時刻合わせ、3針拘束、禁止干渉条件

## 証跡

画像324枚、比較board 36枚、ライト配置図27枚、距離・isolated representative／visibleSurface輝度・起動タイムライン、性能、全回帰の機械可読レポートは[Phase 2A.1 evidence README](evidence/issue2-rendering-quality-phase2a1/README.md)を索引とする。`evidence-manifest.json`で相対パス、byte数、SHA-256、MIME、画像寸法、未掲載・残存ファイルの閉世界整合を検証する。

## 物理iPhone確認結果と次のゲート

D2a/D2bを物理iPhoneで確認した結果、端末再起動後は従来の黒潰れが解消方向へ改善し、nearでは文字板・針・内部部品を良好に識別できた。D2aとD2bの知覚上の差は小さく、initial／farでは中間調が不足し、広い暗部と明部のコントラストがOLED上で強く見えた。したがって、D2a／D2bをそのまま採用せず、D2aを基盤、D2bを比較履歴としてPhase 2A.2へ引き継ぐ。

後続のPhase 2A.2でD2c3だけが自動定量条件を満たしたが、実施時期は[最終微調整申し送り](ISSUE2_FINAL_POLISH_HANDOFF.md)を正とし、4依存工程完了後まで物理iPhone確認を延期する。D2c3は未採用のまま通常アクセスへ統合せず、PR #5をDraft、Issue #2をOpenに維持し、Ready化、マージ、Issue close、「完成」「合格」「最終採用」の報告は行わない。
