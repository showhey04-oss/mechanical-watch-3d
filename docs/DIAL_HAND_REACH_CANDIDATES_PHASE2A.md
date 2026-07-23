# Phase 2A 時針・分針 到達比率候補比較

## 1. 結論

main `e9a223e1ec2b5d966354c73b7719ae81a14f50fa` の通常表示をH0として維持し、`dialHandCandidate` queryだけで時針・分針のGeometry長を切り替える4候補を比較した。通常アクセス、queryなし、無効なqueryはH0へ戻り、mainとの1280×720通常表示はpixel exactである。

Phase 2Aでは候補を既定採用しない。自動計測と同一条件画像から、H0を `REJECT`、H1とH3を `RETAIN_FOR_REVIEW`、H2を `PROVISIONAL_RECOMMENDATION` と整理する。これは人間の視覚確認前の暫定分類であり、`ADOPTED` ではない。

## 2. 実装境界

- query: `?dialHandCandidate=h0|h1|h2|h3`
- queryなし／無効値: H0
- 適用先: `makeHand()`へ渡す分針・時針のGeometry長だけ
- 非対応: 実行中の候補切替、UIからの候補選択、候補の永続化
- 診断: `getDialHandCandidateDiagnostics()`
- 自動統合: `?dialHandCandidateTest=1`
- 注記図: `?dialHandOverlay=1`

通常モデル定義の `minuteHandLength: 10.3`、`hourHandLength: 7.2` は変更していない。針Object3Dのpivot、position、rotation、scale、軸／管の回転拘束へ候補値を書き戻さず、候補はページ生成時のGeometryだけへ一度適用する。

## 3. 候補と比率

基準はインデックス円半径14.8、dial ring半径16.1とする。

| 候補 | 分針 | 時針 | 分針／index | 時針／index | 時針／分針 | 分針／dial ring | 分針ring余白 | 判定 |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| H0 baseline | 10.3 | 7.2 | 0.695946 | 0.486486 | 0.699029 | 0.639752 | 5.8 | `REJECT` |
| H1 conservative | 13.3 | 9.2 | 0.898649 | 0.621622 | 0.691729 | 0.826087 | 2.8 | `RETAIN_FOR_REVIEW` |
| H2 balanced | 14.0 | 10.0 | 0.945946 | 0.675676 | 0.714286 | 0.869565 | 2.1 | `PROVISIONAL_RECOMMENDATION` |
| H3 extended | 14.4 | 10.6 | 0.972973 | 0.716216 | 0.736111 | 0.894410 | 1.7 | `RETAIN_FOR_REVIEW` |

4候補とも分針・時針先端はdial ring内に収まる。H2は分針をindex半径の約94.6%まで延長しつつ、dial ringまで2.1 model unitを残す。H3は分針がindex半径の約97.3%へ達するため、先端余白と時針の長さ感を人間が確認する必要がある。

## 4. 固定比較

次の48条件を全数計測した。

- viewport: 1280×720、390×844、393×852、375×667
- 時刻: 10:10:30、03:00:00、06:30:00
- 候補: H0、H1、H2、H3
- 状態: paused、navy、front、構造透過100%、非分解、表裏分離なし、パネル閉、作動音OFF

48/48で次を満たした。

- Geometry頂点は有限
- 分針・時針先端はdial ring内
- 分針―筒かな管、時針―時針管、小秒針―四番車軸の角度誤差と取付中心距離が許容値内
- pivot、position、rotation、scale、camera、時刻、機構状態が診断前後で不変
- query切替用のanimation-loop処理、バックログ、camera preset変更は0
- screen座標は有限で、全針先端がviewport内

全48条件の最小screen-space線幅は分針2.424259 px、時針3.342845 pxで、診断上は全条件で線幅と先端を識別できた。これはエミュレートしたviewportの結果であり、物理iPhoneの表示品質判定を代替しない。

## 5. 保護した機構・表示

- 小秒針長3.8、小秒中心、四番車軸、小秒表示円径9.0
- インデックス円径29.6、dialRingDiameter 32.2
- 針幅、厚さ、中心キャップ、材質
- 3針と軸／管の1:1回転拘束
- 主輪列、日の裏輪列、歯数、モジュール、軸中心、Y方向層
- カメラ、プリセット、照明、影、材質、構造透過、UI、作動音
- PR #5、Issue #2、D2c3

通常アクセスの画像SHA-256はmainとbranchで一致し、pixel exactを確認した。

## 6. 試験

- Node: 61/61
- desktop総合回帰: 86/86
- 390×844総合回帰: 88/88（DPR 2の既存ハーネス、ウォールナット採取数閾値は未変更）
- PR #3 UI: 1280×720 20/20、390×844 22/22、375×667 22/22
- PR #4 HUD: 390×844、393×852、375×667 各57/57
- v3.14音声: desktop、390×844 各23/23
- A.7: 9/9
- 位置1／位置2禁止干渉: 0/0
- 3針拘束最大誤差／取付距離: `1.652011860642233e-13`
- Phase 1寸法監査: 11/11、schemaVersion 2
- Phase 2A候補統合: H0〜H3各12/12
- 固定比較: 48/48
- 通常表示main比較: pixel exact
- `git diff --check`: 合格

390×844をDPR 1で直接上書きした補助試行では、全テーマの表裏輝度差は30%以内だったが、既知のウォールナット採取数ガードが997／978となり既存閾値 `>1000` に届かなかった。閾値を変更せず、Phase 1と同じDPR 2ハーネスで1740サンプルを取得し88/88を確認した。補助試行は合格結果へ数えない。

## 7. 性能

1280×720、DPR 2、front idle、10秒のクリーン再計測:

| 対象 | fps | p50 | p95 | p99 | >33 ms | >50 ms | long task |
|---|---:|---:|---:|---:|---:|---:|---:|
| 通常H0 | 59.92 | 16.70 | 16.80 | 17.60 | 0 | 0 | 0 |
| query H2 | 59.91 | 16.70 | 17.10 | 18.00 | 0 | 0 | 0 |

両計測でモデルtransformは不変だった。候補resolverおよび診断はanimation loopから呼ばれない。

## 8. 証跡

固定画像、候補別12条件JSON、pixel比較、性能、回帰、closed-world manifestは [`docs/evidence/dial-hand-reach-candidates-phase2a/README.md`](evidence/dial-hand-reach-candidates-phase2a/README.md) にまとめた。

## 9. 人間確認ゲート

H2は自動採用しない。次の確認後に、H0維持、H1、H2、H3、または別候補のいずれかを人間が判断する。

- desktopと物理iPhoneでの時針・分針の視覚階層
- 10:10、03:00、06:30での時針先端とインデックスの関係
- H3の分針先端余白と、H2／H3の時針長の好み
- 既定化する場合のPhase 2A専用PRと全証跡再確認

Phase 2Bの文字板表示系縮小候補は同じDraft PR内の [`DIAL_DISPLAY_SCALE_CANDIDATES_PHASE2B.md`](DIAL_DISPLAY_SCALE_CANDIDATES_PHASE2B.md) でquery限定比較を行った。人間確認では、H2の到達比率を維持したS86が `SELECTED_FOR_IMPLEMENTATION` と選定された。H2の絶対値 `14.0／10.0` はmainへ既定採用していない。S86の実装はmain起点の専用Draft PRで行い、内部機構、小秒中心、四番車軸、Y方向配置は変更しない。Phase 2Cは開始していない。
