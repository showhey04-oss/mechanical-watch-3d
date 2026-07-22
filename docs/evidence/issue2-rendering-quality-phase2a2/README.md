# Issue #2 レンダリング品質 Phase 2A.2 証跡

## 判定

このフォルダは、物理iPhoneで確認されたD2aのinitial／farにおける中間調不足を、D2a、D2c1、D2c2、D2c3の同一条件で比較する閉世界証跡である。D2c候補は`issue2Candidate`クエリでだけ有効で、通常アクセスの既定レンダリングへ統合していない。

| 対象 | Phase 2A.2判定 | 理由 |
| --- | --- | --- |
| D2a | 基礎候補・未採用 | 物理iPhoneでは再起動後に旧D2相当の起動時黒潰れが解消方向、nearは見やすい一方、initial／farの中間調が低い |
| D2b | Phase 2A.1比較履歴 | 実機上でD2aとの差が小さく、カメラ方位追従を新候補へ継承しない |
| D2c1 | query限定・提示対象外 | room／floorと黒フラッグを持ち上げたが、initial／farのclipped ratio非悪化を118/120条件でしか満たさない |
| D2c2 | query限定・提示対象外 | key／fill比を縮めたが、median全条件上昇とdark ratio全条件低下を満たさない |
| D2c3 | query限定・暫定推奨・未採用 | 下側白レフを加え、4項目の自動相対ゲートを全120条件で満たした唯一の候補 |
| 既定レンダリング | 変更なし | D2c3も自動証跡だけでは採用せず、最終微調整工程の物理iPhone Safari／OLED／P3確認を待つ |

D2aの「再起動後に解消方向」を恒久解決または合格とは扱わない。D2c3の自動ゲート通過も画質採用、完成、Issue #2解決を意味しない。

## 固定条件と証跡規模

- 時刻10:10:30、停止、構造透過100%、非分解、表裏分離なし、パネル閉
- 4候補：D2a、D2c1、D2c2、D2c3
- 3 viewport：1280×720、390×844、393×852
- 4テーマ：navy、obsidian、walnut、gallery
- 5視点：front、back、side、winding、motion-works
- 3距離：near、initial、far
- master capture：4×3×4×5×3＝720枚
- 比較board：3 viewport×4テーマ×5視点＝60枚
- スタジオ配置図：4候補＝4枚
- watch silhouette／visibleSurface：各720条件
- 性能：4候補×2 viewport×3 scenario＝24 run

各比較boardは列をD2a／D2c1／D2c2／D2c3、行をnear／initial／farとする12セル構成である。撮影元はin-app browserが返したviewport実寸JPEGで、masterの階層とファイル名がcandidate、viewport、theme、view、distanceを自己記述する。

## 距離ラベルの注意

front／back／sideの実camera distanceは`near < initial < far`である。winding／motion-worksでは既存の専用プリセット初期距離が共通nearより近いため、`initial < near < far`となる。

したがってwinding近接、motion-works近接として読む正しいセルは`initial`行である。生成器はこの2種類の距離順を別々に検証し、ラベル上の`near`を機械的に最接近とは扱わない。

## Candidate設定

| Candidate | 環境／フラッグ | key | fill | 下側白レフ |
| --- | --- | --- | --- | --- |
| D2a | room／floor `#181818`、flags `#000000` | 1.000、30×20 | 0.350、28×22 | なし |
| D2c1 | room／floor `#202020`、flags `#080808` | D2a同値 | D2a同値 | なし |
| D2c2 | D2c1同値 | 0.850、30×20 | 0.455、32.2×25.3 | なし |
| D2c3 | D2c1同値 | D2c2同値 | D2c2同値 | 0.085、38×24、位置`[0,-22,-26]` |

全候補はworld固定、candidate限定fog 160/260、背景テーマから独立したPMREM、ニュートラル白RectAreaLightを使う。D2c1でも黒フラッグの面積・位置は残す。D2c3の下側白レフを含め、RectAreaLightはcastShadowを持たず、D3 shadow carrierやAmbientLightは追加していない。

設定の一次記録は[`reports/lighting/candidate-profiles.json`](reports/lighting/candidate-profiles.json)、配置の数値記録は[`reports/lighting/layouts.json`](reports/lighting/layouts.json)を正とする。

## 主比較

- [390×844・navy・front](comparisons/390x844/navy/d2c-midtone-grid-navy-front-390x844.jpg)
- [390×844・obsidian・front](comparisons/390x844/obsidian/d2c-midtone-grid-obsidian-front-390x844.jpg)
- [390×844・navy・back](comparisons/390x844/navy/d2c-midtone-grid-navy-back-390x844.jpg)
- [390×844・obsidian・side](comparisons/390x844/obsidian/d2c-midtone-grid-obsidian-side-390x844.jpg)
- [390×844・navy・winding](comparisons/390x844/navy/d2c-midtone-grid-navy-winding-390x844.jpg)
- [390×844・navy・motion-works](comparisons/390x844/navy/d2c-midtone-grid-navy-motion-works-390x844.jpg)
- [390×844・gallery・front](comparisons/390x844/gallery/d2c-midtone-grid-gallery-front-390x844.jpg)
- [393×852・navy・front](comparisons/393x852/navy/d2c-midtone-grid-navy-front-393x852.jpg)
- [1280×720・gallery・back](comparisons/1280x720/gallery/d2c-midtone-grid-gallery-back-1280x720.jpg)
- [1280×720・gallery・side](comparisons/1280x720/gallery/d2c-midtone-grid-gallery-side-1280x720.jpg)
- [D2aスタジオ配置図](light-layouts/d2a-studio-layout.svg)
- [D2c1スタジオ配置図](light-layouts/d2c1-studio-layout.svg)
- [D2c2スタジオ配置図](light-layouts/d2c2-studio-layout.svg)
- [D2c3スタジオ配置図](light-layouts/d2c3-studio-layout.svg)

navy／obsidianのfront initial／farでは背景分離と中間調、gallery nearでは白飛びと平板化、back／sideでは金属反射帯とnegative fillの輪郭、winding／motion-worksの`initial`では黄銅・鋼・ルビー・歯先・穴・軸・段差を確認する。

必須boardのChromium目視では、D2c3はnavy／obsidianのinitial／farでD2aより下側・外周の中間調がわずかに開き、外形とnegative fillの輪郭を維持した。galleryとwinding／motion-worksの実最接近では広範な白飛びや白い平板化を認めず、黄銅、鋼、ルビー、歯先、穴、軸の識別も維持した。D2c1の変化は小さく、D2c2は全条件の暗部改善が揃わない。これらは物理iPhoneの知覚評価を代替しない。

## watch silhouette metric

watch root全体をscreen-space silhouette mask passで抽出し、背景を除く実画素からmean、median、p10、p25、p75、p90、dark ratio、clipped ratio、sample countを求めた。さらにwatch medianと背景medianの差、およびwatch p25と背景p75の差を保存する。

採用判定に固定絶対閾値は使わない。D2aに対するinitial／farのmedian、p25、dark ratio、clipped ratioを、3 viewport×4テーマ×5視点×2距離＝120条件／候補で比較する。nearの60条件／候補は白飛び監視として分離した。

| Candidate | median平均差 | p25平均差 | dark ratio平均差 | clipped ratio平均差 | 全条件ゲート |
| --- | --- | --- | --- | --- | --- |
| D2c1 | +0.006792、改善120/120 | +0.005782、改善120/120 | -0.004371、改善120/120 | +0.000000145、非悪化118/120 | 不合格 |
| D2c2 | +0.009096、改善116/120 | +0.005474、改善120/120 | -0.004547、改善118/120 | -0.000011849、非悪化120/120 | 不合格 |
| D2c3 | +0.017207、改善120/120 | +0.010214、改善120/120 | -0.009323、改善120/120 | -0.000011723、非悪化120/120 | 合格 |

D2c1はclipped ratio、D2c2はmedianとdark ratioのall-conditionゲートで外れた。D2c3だけがmedian上昇、p25上昇、dark ratio低下、clipped ratio非増加を全120条件で同時に満たす。

near最大clipped ratioはD2c1 0.033883、D2c2 0.017377、D2c3 0.017727で、最大p90は全候補0.915995である。D2c3のinitial／far p90平均差は+0.007295、最大差は+0.080969であり、galleryと金属のハイライトは実機確認項目として残す。

詳細は[`reports/midtone/watch-silhouette.json`](reports/midtone/watch-silhouette.json)、判定集約は[`reports/midtone/decision-summary.json`](reports/midtone/decision-summary.json)を正とする。

## visibleSurface metric

通常の合成画面で見えているObject3D表面だけをobject-mask passで集計し、次の7領域を全720条件で保存した。

- `dial`：dialRingと文字板marker mesh
- `hands`：分針、時針、小秒針のaxis
- `brassTrain`：香箱、二番車、三番車root
- `steelTrain`：四番車、ガンギ車、アンクルroot
- `ruby`：watch root内で共通ruby materialを使うmesh
- `plate`：mainPlate root
- `outerBezel`：dialRingと地板上下面の外周リングによる簡易外形

モデルに独立したcase／bezel Object3Dがないため、`outerBezel`は実ケース材質ではなく外周分離を見る代理領域である。frontで文字板に隠れる`brassTrain`／`steelTrain`のsample countが0になる条件は正常な遮蔽で、mask欠損ではない。領域定義、mesh count、遮蔽状態、輝度分位は[`reports/midtone/visible-surfaces.json`](reports/midtone/visible-surfaces.json)を正とする。

## 機械可読レポート

| パス | 内容 |
| --- | --- |
| [`capture-matrix.json`](capture-matrix.json) | 720条件の直接起動query、camera、viewport、fog、environment、RectAreaLight、watch silhouette、visibleSurface、master画像パス |
| [`reports/lighting/candidate-profiles.json`](reports/lighting/candidate-profiles.json) | D2a／D2c1／D2c2／D2c3のPMREM、flags、panels、RectAreaLight、key／fill比 |
| [`reports/lighting/layouts.json`](reports/lighting/layouts.json) | 4枚のスタジオ配置図とworld座標 |
| [`reports/midtone/watch-silhouette.json`](reports/midtone/watch-silhouette.json) | 全720条件のwatch root screen-space metricとD2a相対差 |
| [`reports/midtone/visible-surfaces.json`](reports/midtone/visible-surfaces.json) | 全720条件・7領域の合成画面visibleSurface metric |
| [`reports/midtone/decision-summary.json`](reports/midtone/decision-summary.json) | initial／farの120条件相対ゲート、near白飛び監視、物理iPhone提示可否 |
| [`reports/browser-report.json`](reports/browser-report.json) | Node、browser、rendering、PR #3 UI、PR #4 HUD、A.7、ドリフト、禁止干渉 |
| [`reports/performance/summary.json`](reports/performance/summary.json) | 24件のA.6 pointer／wheel／opacity計測、閾値、初回outlierと再試行 |
| [`evidence-manifest.json`](evidence-manifest.json) | 全証跡の相対パス、byte数、SHA-256、MIME、画像寸法 |

## 確定した回帰結果

- Node 33/33
- desktop browser：baseline 86/86、D2a／D2c1／D2c2／D2c3は各87/87
- 390×844 browser：D2a／D2c1／D2c2／D2c3は各89/89
- baseline 390×844：既知の`a5-all-background-themes-keep-front-back-luminance-within-thirty-percent`だけが未合格で87/88。許容済み既知結果として明記し、閾値を緩和していない
- rendering quality：D2a／D2c1は各viewport 22/22、D2c2／D2c3は各viewport 23/23
- PR #3 UI：20/20、22/22、22/22
- PR #4 HUD：42/42、54/54、54/54、54/54
- A.7 9/9、位置2保持・100往復・30/60/120fpsのドリフト0、位置1／位置2禁止干渉0/0

## 性能結果

4候補×1280×720／390×844×pointer rotate／wheel zoom／opacity idleの24件はすべて`gatePassed = true`である。

- 全採用runの最小平均FPS：54.9348
- 最大p50：16.7ms
- 最大p95：17.7ms
- 最大p99：50.0ms
- 33ms超過合計：46
- 50ms超過合計：6
- wheel最大step share：0.003637（閾値0.08）
- pointer：有限、方向反転0、停止後跳躍0
- wheel：有限、単調

最小FPS、p99 50.0ms、50ms超過6件は390×844のD2a pointerで、平均FPS 45以上、50ms超過率2%以下のmobile基準内だった。D2a・1280×720 pointerの最初の試行はcapture-session transient outlierとして53.0980 FPS、p95 33.3ms、p99 65.8ms、超過32/9を記録し、再試行は59.9296 FPS、p95 16.8ms、p99 17.4ms、超過0/0で受け入れた。両試行を`attempts`へ保持し、閾値は変更していない。

## 再生成と検証

browser capture harnessが次の一時入力を`/tmp/issue2-rendering-quality-phase2a2/`へ用意した後に実行する。

- `capture-matrix.json`と`raw/`配下の720 JPEG
- `reports/`配下のbrowser、performance JSON
- 各候補の`describeIssue2StudioRig()`設定

```text
python3 -m pip install -r scripts/requirements-evidence.txt
python3 scripts/generate_issue2_phase2a2_evidence.py
python3 scripts/generate_issue2_phase2a2_evidence.py --check
```

生成時は候補／viewport／theme／view／distanceの720条件、固定query、camera／Quaternion／target／DPR一致、world固定ライト、D2c1／2／3の設定値、距離順、watch silhouette、visibleSurface、相対ゲート、全回帰、24性能run、60 board、4 SVGを検証する。`--check`はmanifestと実フォルダを閉世界で照合し、未掲載・残存ファイル、hash／MIME／寸法差、JSON／SVG不正を失敗にする。

## 既知制約と最終微調整ゲート

- 自動ブラウザはiPhone Safari、OLED、Display P3、ホーム画面起動を再現せず、実機の知覚評価を代替しない
- D2aの再起動後改善は恒久解決を示さない
- watch silhouetteとvisibleSurfaceはscreen-space metricで、viewport、投影面積、遮蔽を含む
- watch silhouetteの面積輝度maskはMesh表面を対象とし、Line primitiveだけで描く主ゼンマイ／ヒゲゼンマイは含めない。線材は近接boardの目視対象とする
- `outerBezel`は独立case／bezelがないモデルでの簡易外周代理領域である
- winding／motion-worksの最接近は`initial`で、共通`near`より近い
- D2c1／D2c2は比較履歴、D2c3は最終微調整再開時の物理iPhone候補にとどまり、いずれも既定未採用
- 通常アクセス、D1／D2／D3、fog、shadow、tone mapping、exposure、output color space、材質、構造透過、背景テーマ、DPR、camera、機構、UI／HUDは変更していない

[最終微調整申し送り](../../ISSUE2_FINAL_POLISH_HANDOFF.md)の4依存工程が完了した後、D2c3を同じ物理iPhone Safariのタブ起動とホーム画面起動で開き、query維持、initial／farの中間調、navy／obsidianでの背景分離、gallery近接の白飛び、front／back／sideの金属階調、winding／motion-worksの`initial`近接、パネル開閉、3D操作、部品選択を確認する。それまではD2c3を採用せず、PR #5をDraft、Issue #2をOpenに維持し、Ready化、マージ、Issue close、完成・合格・最終採用の判定を行わない。
