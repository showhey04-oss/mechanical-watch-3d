# Issue #2 レンダリング品質改善 Phase 2A.2

## 結論

Phase 2A.2では、物理iPhoneで確認されたD2aの引き表示における中間調不足を、D2aのworld固定スタジオと候補限定fog 160/260を維持したまま再調整した。変更は`issue2Candidate`クエリでだけ有効なD2c1／D2c2／D2c3へ隔離し、通常アクセスと既存候補の既定描画は変更していない。

- D2a：基礎候補として維持。物理iPhoneでは再起動後に旧D2相当の起動時黒潰れが解消方向、nearは内部機構と材質差を見やすい一方、initial／farは中間調が低く暗部が広い
- D2b：実機上のD2aとの差が小さく、カメラ方位追従によるハイライト貼り付きのリスクに見合う明確な利点が未確認のため、Phase 2A.1の比較履歴として保持する
- D2c1：PMREM room／floorと黒フラッグの最低反射レベルだけを持ち上げたquery限定候補。clipped ratioの全条件非悪化を満たさず、物理iPhone提示対象外
- D2c2：D2c1にkey／fill比の再調整を加えたquery限定候補。medianとdark ratioの全条件改善を満たさず、物理iPhone提示対象外
- D2c3：D2c2に弱い下側白レフを加えたquery限定候補。initial／farの全120条件で相対ゲートを満たした唯一の候補として、最終微調整再開時の暫定推奨候補とする
- 最終統合・既定採用：なし。D2c3も未採用で、申し送りの4依存工程完了後に物理iPhone Safari／OLED／P3での確認が必要
- PR #5：Draftを維持。Issue #2：Openを維持

物理iPhoneで「再起動後に解消方向」と確認された起動時黒潰れを、恒久解決または合格とは扱わない。D2a／D2bは現状のまま最終採用せず、D2c3も自動測定と比較画像だけで採用しない。Phase 2A.2の比較完了をもって追加のライティング反復を停止し、[最終微調整申し送り](ISSUE2_FINAL_POLISH_HANDOFF.md)に記載した作動音、寸法・比率調整、最終外装、完成時計の初回PC／iPhone確認が完了するまで採用・既定統合・Phase 2B最終判定を延期する。

## 物理iPhone評価からの判断

Phase 2A.1後の同一実機確認では、D2a／D2bに次の傾向があった。

- ホーム画面起動時の旧D2相当の黒潰れは、端末再起動後に解消方向だった
- nearでは内部機構、黄銅歯車、鋼部品、軸、ルビーをかなり識別しやすかった
- D2aとD2bの視覚差は小さかった
- initial／farでは時計全体のmedianと低位中間調が不足し、navy／obsidianで暗部が背景へ沈みやすかった
- 明るい反射帯と広い暗部の差が大きく、OLEDでは暗部がより沈んで見えた

D2a／D2bにD3のDirectionalLight shadow carrierはない。したがってPhase 2A.2ではshadow map、shadow camera、bias、normalBiasではなく、PMREMのroom／floor、保持した黒フラッグ、RectAreaLightのkey／fill比を独立に比較した。D2aを完全world固定の基礎とし、D2bは新候補へ継承していない。

旧D2の暗化は約106のモバイル初期カメラ距離がlegacy fog 68/125へ重なることが主因であり、D2a／D2b限定のfog 160/260では再起動後の初期黒潰れが解消方向へ改善した。一方、initial／farの中間調不足と強い明暗差は残ったため、fog修正だけを最終画質の合格とは扱わない。

## Candidate D2c

すべてのD2c候補はD2aと同じworld固定スタジオ、PMREM、候補限定fog 160/260を使用する。ライトはscene直下で、カメラ距離や方位へ追従しない。背景テーマは環境マップから独立し、navy／obsidian／walnut／galleryの色を変更しない。

| 項目 | D2a | D2c1 | D2c2 | D2c3 |
| --- | --- | --- | --- | --- |
| query | `studio-d2a` | `studio-d2c1` | `studio-d2c2` | `studio-d2c3` |
| studio profile | `base` | `d2c1-midtone-environment` | `d2c2-balanced-key-fill` | `d2c3-lower-bounce` |
| room／floor | `#181818` | `#202020` | `#202020` | `#202020` |
| 黒フラッグ | `#000000` | `#080808` | `#080808` | `#080808` |
| key intensity／size | 1.000／30×20 | 同左 | 0.850／30×20 | 0.850／30×20 |
| fill intensity／size | 0.350／28×22 | 同左 | 0.455／32.2×25.3 | 0.455／32.2×25.3 |
| key／fill intensity比 | 2.8571 | 2.8571 | 1.8681 | 1.8681 |
| 下側白レフ | なし | なし | なし | 0.085、38×24、keyの10% |
| RectAreaLight数 | 2 | 2 | 2 | 3 |
| shadow | なし | なし | なし | なし |
| 既定採用 | なし | なし | なし | なし |

D2c1では黒フラッグの面積と位置を維持し、完全黒から`#080808`へ持ち上げた。輪郭を作るnegative fillは残しつつ、PMREM room／floorを`#181818`から`#202020`へ持ち上げる。floor radiance 0.7、白パネルの色・位置・放射、PMREM sigmaはD2aから変えていない。

D2c2ではkeyをD2a比85%、fillを130%とし、fillの幅・高さを各115%へ拡張した。総露出を単純に上げず、明るい反射帯を抑えながら暗部へ広いfillを回す比較である。

D2c3ではD2c2へ`studioRectLowerBounce`を追加した。位置は`[0, -22, -26]`、寸法38×24、intensity 0.085、色はニュートラル白、castShadowはfalseである。keyの10%だけを歯車下面、軸、地板下側へ返し、AmbientLightによる一律の持ち上げは行わない。

## 固定条件と禁止範囲

比較は次を固定した。

- viewport：1280×720、390×844、393×852
- theme：navy、obsidian、walnut、gallery
- view：front、back、side、winding、motion-works
- distance：near、initial、far
- 時刻10:10:30、停止、構造透過100%、非分解、表裏分離なし、パネル閉

次は変更していない。

- exposure、tone mapping、output color space
- 材質のcolor／metalness／roughness、CSS brightness／filter
- User-Agent別補正、iPhoneだけの照明値
- D2a/D2c候補限定fog 160/260、camera distance、camera smoothing、DPR
- D3 shadow carrier、shadow map、shadow camera、bias、normalBias
- AmbientLight、背景テーマの明るさ、すべての黒フラッグの削除
- 構造透過、ArcballControls、Raycaster、部品選択、UI／HUD
- 内部機構、A.7絶対配置、巻上げ、時刻合わせ、針拘束、禁止干渉条件

## 証跡規模と距離の意味

4候補×3 viewport×4テーマ×5視点×3距離の720枚をbrowser JPEG masterとして保存した。同一viewport・theme・viewごとに、列をD2a／D2c1／D2c2／D2c3、行をnear／initial／farとする12セルの比較boardを60枚生成し、各候補1枚のスタジオ配置図を4枚生成した。

front／back／sideでは実camera distanceが`near < initial < far`である。一方、既存のwinding／motion-worksプリセットは対象機構を画面いっぱいに見せる専用初期距離を持つため、実距離は`initial < near < far`となる。この2視点で「近接」と記す証跡は`initial`行を正とし、ラベル名だけで`near`を最接近と解釈しない。

## watch silhouette metric

合成画面の背景を除いたwatch root全体をscreen-space mask passで抽出し、全720条件で次を記録した。

- mean、median、p10、p25、p75、p90
- dark ratio、clipped ratio、sample count
- 背景medianとの差、watch p25と背景p75との差

固定絶対閾値で採用せず、D2aに対するinitial／farの相対変化を評価した。比較対象は3 viewport×4テーマ×5視点×2距離の120条件／候補である。nearは白飛び監視として60条件／候補を別集計した。

| Candidate | median平均差／改善数 | p25平均差／改善数 | dark ratio平均差／改善数 | clipped ratio平均差／非悪化数 | 自動相対ゲート | 物理iPhone提示 |
| --- | --- | --- | --- | --- | --- | --- |
| D2c1 | +0.006792／120/120 | +0.005782／120/120 | -0.004371／120/120 | +0.000000145／118/120 | 不合格 | なし |
| D2c2 | +0.009096／116/120（非悪化120） | +0.005474／120/120 | -0.004547／118/120（非悪化119） | -0.000011849／120/120 | 不合格 | なし |
| D2c3 | +0.017207／120/120 | +0.010214／120/120 | -0.009323／120/120 | -0.000011723／120/120 | 合格 | 候補、未採用 |

D2c1は2条件でclipped ratioが増加し、最大差は+0.000013021だった。D2c2はmedianが4条件で同値、dark ratioが2条件で改善せず、そのうち1条件は+0.000043442増加した。D2c3だけがmedian上昇、p25上昇、dark ratio低下、clipped ratio非増加を全120条件で満たした。

nearの最大clipped ratioはD2c1 0.033883、D2c2 0.017377、D2c3 0.017727、最大p90は全候補0.915995だった。D2c3のinitial／farにおけるp90平均差は+0.007295、最大差は+0.080969であるため、gallery近接と金属反射帯は物理iPhoneでも継続監視する。

## visibleSurface metric

通常の合成画面で実際に見えているObject3D表面をobject-mask passで抽出し、全720条件で`dial`、`hands`、`brassTrain`、`steelTrain`、`ruby`、`plate`、`outerBezel`を記録した。各領域はwatch silhouetteと同じ輝度分位、dark／clipped ratio、sample countに加え、対象Mesh数と遮蔽状態を持つ。

`outerBezel`は独立したcase／bezel Object3Dがモデルに存在しないため、`dialRing`と地板上下面の外周リングを合わせた簡易外形代理領域である。実ケースやベゼルそのものの材質評価ではない。frontで文字板が輪列を完全に遮る条件では`brassTrain`／`steelTrain`のsample countが0となるが、これはmask欠損ではなく正しい遮蔽結果である。

## 画像比較と候補選別

4列boardで次を確認対象とした。

- navy／obsidianのfront initial／farで時計外周、文字板、針、輪列が背景へ同化しないこと
- winding／motion-worksの`initial`近接で黄銅、鋼、ルビー、歯先、穴、軸、段差を識別できること
- gallery近接で針、歯車、地板に広範な白飛びや白い平板化がないこと
- back／sideで黒フラッグ由来の輪郭線と金属反射帯を維持すること

D2c1／D2c2は比較履歴として保持するが、自動相対ゲートを満たさないため物理iPhoneへ提示しない。D2c3だけを最終微調整再開時の実機レビュー候補として保持する。ただし画像boardと定量値はOLED／P3表示、ホーム画面起動、知覚的な金属階調を代替しないため、採用・既定化・完成判定は保留する。

必須boardのChromium目視では、D2c3はnavy／obsidianのinitial／farでD2aより下側と外周の中間調がわずかに開き、時計外形とnegative fillの暗い輪郭を維持した。galleryおよびwinding／motion-worksの実最接近で広範な白飛びや白い平板化は見られず、黄銅、鋼、ルビー、歯先、穴、軸の識別も維持した。D2c1の変化は小さく、D2c2はkey／fill再配分だけでは全条件の暗部改善が揃わなかった。これはChromium画像上の選別であり、物理iPhoneの採用判定ではない。

## 回帰と性能

- Node：33/33
- desktop browser：baseline 86/86、D2a／D2c1／D2c2／D2c3は各87/87
- 390×844 browser：D2a／D2c1／D2c2／D2c3は各89/89。baselineは既知のIssue #2輝度項目だけを再現して87/88
- rendering quality：D2a／D2c1は3 viewportすべて22/22、D2c2／D2c3は3 viewportすべて23/23
- PR #3 UI：1280×720 20/20、390×844 22/22、375×667 22/22
- PR #4 HUD：1280×720 42/42、390×844／393×852／375×667は各54/54
- A.7：9/9、位置ドリフト0、位置1／位置2禁止干渉0/0
- A.6：4候補×2 viewport×pointer rotate／wheel zoom／opacity idleの24計測が全件gate pass

性能の全採用runにおける最悪値は平均FPS 54.9348、p50 16.7ms、p95 17.7ms、p99 50.0ms、33ms超過合計46、50ms超過合計6、wheel最大step share 0.003637だった。最小FPSと50ms超過6件は390×844のD2a pointer runで、mobile基準の45 FPS以上、50ms超過率2%以下を満たす。pointerは有限値、方向反転0、停止後跳躍0、wheelは有限・単調である。

D2a・1280×720 pointerの最初の計測は、連続capture直後の一時的outlierとして53.0980 FPS、p95 33.3ms、p99 65.8ms、33ms超過32、50ms超過9を記録した。再計測は59.9296 FPS、p95 16.8ms、p99 17.4ms、超過0/0でgate passした。最初の試行を削除せず`attempts`へ残し、採用runと区別している。閾値は変更していない。

## 証跡

720 master capture、60比較board、4ライト配置図、watch silhouette、visibleSurface、候補設定、性能、全回帰は[Phase 2A.2 evidence README](evidence/issue2-rendering-quality-phase2a2/README.md)を索引とする。`evidence-manifest.json`は相対パス、byte数、SHA-256、MIME、JPEG寸法を記録し、未掲載・残存ファイルを含む閉世界整合を検証する。

## 既知制約と最終微調整ゲート

- 自動ブラウザはiPhone Safari、OLED、Display P3、`navigator.standalone`、ホーム画面起動を再現しない
- D2aの再起動後の改善は方向性の観察であり、起動経路を含む恒久解決を意味しない
- screen-space metricはviewport、遮蔽、投影面積を含む合成画面診断であり、材質の知覚品質を単独で決定しない
- watch silhouetteの面積輝度maskはMesh表面を対象とし、線だけで描く主ゼンマイ／ヒゲゼンマイは含めない。線材は近接boardの目視で別途確認する
- `outerBezel`はcase／bezelの代理領域である
- winding／motion-worksでは`initial`が実距離上の最接近であり、共通`near`より近い
- baseline 390×844の87/88は既知のIssue #2輝度項目であり、失敗を隠さず許容済み既知結果として記録する
- D2c1／D2c2／D2c3はquery限定で、通常アクセスの既定描画へ統合していない

作動音、寸法・比率調整、最終外装、完成時計の初回PC／iPhone確認が完了した後、D2c3を同じ物理iPhone Safariのタブ起動とホーム画面起動で開き、initial／farの中間調、navy／obsidianでの背景分離、gallery近接の白飛び、front／back／sideの金属反射帯、winding／motion-works近接、パネル開閉、3D操作、部品選択を確認する。それまではD2c3を未採用のまま、PR #5をDraft、Issue #2をOpenに維持し、Ready化、マージ、Issue close、完成・合格・最終採用の判定を行わない。
