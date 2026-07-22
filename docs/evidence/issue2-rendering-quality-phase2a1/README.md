# Issue #2 レンダリング品質 Phase 2A.1 証跡

> 物理iPhone確認後の更新：端末再起動後、従来の黒潰れは解消方向へ改善し、nearは良好だった。一方でD2a／D2bの差は小さく、initial／farの中間調不足と広い暗部が残ったため、両候補をそのまま採用しない。D2aを次段の基盤、D2bを比較履歴とし、最新のD2c比較証跡は[Phase 2A.2証跡](../issue2-rendering-quality-phase2a2/README.md)、実機確認の実施時期は[最終微調整申し送り](../../ISSUE2_FINAL_POLISH_HANDOFF.md)を参照する。

## 判定

このフォルダは、物理iPhoneで確認されたCandidate D2の初期表示・ズームアウト時暗化を診断し、D2現状、D2a、D2bを同一条件で比較するための証跡である。D2a/D2bは`issue2Candidate`クエリでだけ有効な未採用候補であり、通常アクセスのv3.13.0既定レンダリングへ統合していない。

| 対象 | Phase 2A.1判定 | 理由 |
| --- | --- | --- |
| D2現状 | 不採用 | 物理iPhoneの初期表示・ズームアウトで暗化。ライトはworld固定だが、モバイルのカメラ距離約106がlegacy fog 68/125へ深く重なる |
| D3 | 未採用を維持 | D2と同じlegacy fog条件を持つ。距離・起動診断だけを継続し、D2a/D2bの画像boardへは含めない |
| D2a | query限定・未採用／次段基盤 | world固定スタジオ＋候補限定fog 160/260。nearは良好だったがinitial／farの中間調不足が残った |
| D2b | query限定・未採用／比較履歴 | カメラ方位追従・固定半径スタジオ＋候補限定fog 160/260。物理iPhoneでD2aとの差が小さかった |
| 既定レンダリング | 変更なし | 通常アクセス、D1/D2/D3、ライト、fog、材質、tone mapping、exposure、DPRは従来どおり |

D2a/D2bの自動測定passは、物理iPhone Safariまたはホーム画面起動での画質合格、採用、完成を意味しなかった。物理iPhoneではD2a／D2bの差が小さく、initial／farの中間調不足が残ったため、D2aを次段の基盤、D2bを比較履歴として保持する。

## 固定条件と規模

- 時刻10:10:30、停止、構造透過100%、非分解、表裏分離なし、パネル閉
- 3候補：D2現状、D2a、D2b
- 3 viewport：1280×720、390×844、393×852
- 4テーマ：navy、obsidian、walnut、gallery
- 3視点：front、back、side
- 3距離：near、initial、far
- master capture：3候補×3 viewport×4テーマ×3視点×3距離＝324枚
- 3候補×3距離の比較board：3 viewport×4テーマ×3視点＝36枚
- ライト配置図：3候補×3視点×3距離＝27枚
- 起動タイムライン：D2／D2a／D2b／D3×3 viewport＝12条件、各5秒・250ms間隔・21 sample
- camera/light距離診断：D2／D2a／D2b／D3×3 viewport×3視点×3距離＝108条件

生成処理は候補間のcamera position、Quaternion、target、DPR、描画pixel ratioが一致することを検証する。D2aは全条件でライトのworld位置・向き・モデル中心からの距離が一定、D2bは視点方位で位置・向きが変わる一方、同一視点のnear／initial／farで位置・向き・固定半径・寸法・強度・色が一定であることを検証する。

## 輝度metricの意味

全viewport・4テーマの同じfront方向における主要部near／initial／far変動±15%判定には、`dial`、`hands`、`brassTrain`、`steelTrain`のisolated representative metricを使用する。

isolated representative metricは、対象以外のObject3Dを一時的に非表示とし、対象Object3Dだけを実際の材質・ライト・カメラ・fogで描画する。その描画と同じカメラで対象形状の可視面maskを生成し、mask内の実画素だけから平均輝度、dark ratio、clipped ratio、sample countを集計する。固定矩形やbounding box全体の背景色を平均する方式ではない。診断後はObject3Dの`visible`と材質状態を正確に復元する。

同時にvisibleSurface metricを記録し、通常の合成画面で実際に見えている対象面だけを集計する。frontでは文字板が黄銅輪列・鋼輪列を完全に遮蔽するため、両輪列の`visibleSurface.sampleCount = 0`となる場合がある。これは正常な遮蔽結果であり、mask失敗や証跡欠損ではない。frontで隠れている輪列を含むズーム安定性はisolated representative metricで判定し、実際の合成画面はvisibleSurface metricとmaster／比較boardで確認する。

back／sideもisolated representative／visibleSurface metricを診断値として保存するが、金属反射面と画面への投影面積が距離で変化するため、±15%定量ゲートから除外する。back／sideは3候補の同一条件master／比較boardを使い、反射帯、黒潰れ、白飛び、ハイライト追従感を主観比較する。

この分離により、主要部そのものの照明安定性と、文字板・受・輪列の遮蔽を含む最終画面の見え方を混同しない。isolated表示だけで画質を採用せず、金属反射帯、黒潰れ、白飛び、色差、ハイライト追従感は物理iPhoneで判断する。

## 主比較

- [1280×720・navy・正面](comparisons/1280x720/navy/d2-zoom-grid-navy-front-1280x720.jpg)
- [1280×720・gallery・裏面](comparisons/1280x720/gallery/d2-zoom-grid-gallery-back-1280x720.jpg)
- [390×844・navy・正面](comparisons/390x844/navy/d2-zoom-grid-navy-front-390x844.jpg)
- [390×844・obsidian・側面](comparisons/390x844/obsidian/d2-zoom-grid-obsidian-side-390x844.jpg)
- [393×852・walnut・裏面](comparisons/393x852/walnut/d2-zoom-grid-walnut-back-393x852.jpg)
- [D2a・390×844・navy・正面・initial master](captures/d2a/390x844/navy/front/initial/d2a-navy-front-initial-390x844.jpg)
- [D2b・393×852・gallery・側面・far master](captures/d2b/393x852/gallery/side/far/d2b-gallery-side-far-393x852.jpg)
- [D2a・正面・initialライト配置図](light-layouts/d2a-front-initial.svg)
- [D2b・側面・farライト配置図](light-layouts/d2b-side-far.svg)

比較boardは行をnear／initial／far、列をD2現状／D2a／D2bとする9セル構成である。撮影元はin-app browserが返すviewport実寸のJPEGを一時領域に置き、再圧縮せずコミットするJPEG masterへコピーする。masterとboardは候補・theme・view・distance・viewportをファイル名と階層で自己記述する。

## 機械可読レポート

| パス | 内容 |
| --- | --- |
| [`capture-matrix.json`](capture-matrix.json) | 324条件の直接起動URL、camera、viewport、DPR、ライト、framebuffer、isolated representative／visibleSurface metric、master画像パス |
| [`reports/startup/timelines.json`](reports/startup/timelines.json) | D2／D2a／D2b／D3の12起動条件、各21 sample、query維持、PMREM、environment、uniform、ライト、D3 shadow、初回正常描画 |
| [`reports/zoom/camera-light-distances.json`](reports/zoom/camera-light-distances.json) | 108条件のcamera-to-model、light-to-model、ライトtransform／寸法／強度／色、environment intensity |
| [`reports/zoom/luminance-comparison.json`](reports/zoom/luminance-comparison.json) | 主要4部位のisolated representative metric、visibleSurface metric、initial比のnear／far変動 |
| [`reports/lighting/layouts.json`](reports/lighting/layouts.json) | 27ライト配置図の条件、model center、camera、key／fill配置 |
| [`reports/browser-report.json`](reports/browser-report.json) | Node、desktop/mobile、PR #3 UI、PR #4 HUD、描画品質、A.7を含む全回帰 |
| [`reports/performance/summary.json`](reports/performance/summary.json) | A.6 pointer rotate／wheel zoom／opacity idle、p50／p95／p99、33ms／50ms超過数 |
| [`evidence-manifest.json`](evidence-manifest.json) | 全証跡の相対パス、byte数、SHA-256、MIME、画像寸法 |

## 確定した自動結果

- D2のkey／fill light-to-modelは36.8951／33.8711で、near／initial／farを通して不変
- D2・390×844 frontはcamera distance 79.4913／105.9884／120.0000に対してlegacy fog factor 0.1055／0.7405／0.9783、framebuffer平均輝度0.1894／0.0999／0.0653
- D2a／D2bのfront主要4部位最大絶対変動はいずれも12.6573%で、全viewport・4テーマの15%目標内
- 起動12条件は各21 sample、query維持、起動ゲート成立。自動環境は`navigator.standalone = null`、display mode `false`
- Node 33/33、desktop baseline 86/86、D2a／D2b desktop 87/87、D2a／D2b 390×844 89/89
- PR #3 UI 20/20・22/22・22/22、PR #4 HUD 42/42・54/54・54/54・54/54、D2a／D2b描画品質は3 viewportすべて20/20
- A.7 9/9、ドリフト0、禁止干渉0/0
- 現行HeadのA.6 12計測はp50 16.7ms、p95 17.4–17.8ms、p99 18.2–18.5ms、33ms／50ms超過0

390×844 baselineのbrowser suiteは既存Issue #2のfront/back輝度項目だけを再現して87/88であり、D2a／D2bのquery限定候補は同条件で89/89だった。履歴補助runと現行Head runは`source`で区別している。

## 再生成と検証

ブラウザcapture harnessが次の一時入力を`/tmp/issue2-rendering-quality-phase2a1/`へ用意した後に実行する。

- `capture-matrix.json`と`raw/`配下の324 JPEG
- `reports/`配下の起動、距離、輝度、ライト配置、ブラウザ回帰、性能JSON
- `light-layouts/`配下の27 SVG

```text
python3 -m pip install -r scripts/requirements-evidence.txt
python3 scripts/generate_issue2_phase2a1_evidence.py
python3 scripts/generate_issue2_phase2a1_evidence.py --check
```

証跡生成だけが使用するPillowは`scripts/requirements-evidence.txt`へ固定し、アプリ本体の依存には含めない。生成時は324 capture、固定クエリ、camera／DPR一致、D2a/D2bのライト不変条件、全viewport・4テーマのfrontに限定した±15%輝度条件、必須JSON件数、36 board、27 SVGを検証する。back／sideは値を保存して比較対象に含めるが、この定量ゲートでは失敗にしない。`--check`はmanifestと実フォルダを閉世界で照合し、未掲載・残存ファイル、hash／MIME／寸法差、JSON／SVG不正を失敗にする。

## 既知制約と物理iPhone確認結果

- 自動ブラウザではiOSの`navigator.standalone`とホーム画面起動を再現できない。直接URLでquery維持と起動完了ゲートを検証しても実機確認の代替にはならない
- D2a/D2bのcandidate限定fog 160/260は原因切り分けと比較のための設定であり、最終方式として採用していない
- isolated representative metricは部品単体のズーム安定性を測る診断値であり、遮蔽を含む実画面の画質判定ではない
- frontの黄銅輪列・鋼輪列のvisibleSurfaceが0でも、文字板による完全遮蔽なら正常である
- D2bは固定半径でもカメラ方位へ追従するためハイライト貼り付きリスクを実機比較したが、D2aに対する明確な利点は確認できず比較履歴とした
- 通常アクセスの既定描画、D1/D2/D3、機構、カメラ、UI/HUD、構造透過、DPRは変更していない

D2aとD2bの物理iPhone確認では、端末再起動後に黒潰れが解消方向へ改善し、nearの視認性は良好だった。一方、D2a／D2bの差は小さく、initial／farでは中間調不足、広い暗部、OLED上の強い明暗差が残った。そのためD2aを基盤、D2bを比較履歴としてPhase 2A.2へ引き継ぎ、両候補をそのまま採用しない。

Phase 2A.2のD2c1／D2c2／D2c3もquery限定であり、自動定量条件を満たしたD2c3だけを最終微調整再開時の物理iPhone確認対象として保持する。4依存工程完了まで確認を延期し、D2c3を未採用のまま、PR #5をDraft、Issue #2をOpenに維持して、Ready化、マージ、Issue close、完成・合格・最終採用の判定を行わない。
