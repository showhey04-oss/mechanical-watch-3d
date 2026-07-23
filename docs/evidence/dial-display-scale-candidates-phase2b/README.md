# Phase 2B 文字板表示系 縮小率候補比較 証跡

## 固定条件

- baseline: `e9a223e1ec2b5d966354c73b7719ae81a14f50fa`
- query: `dialDisplayScale=s100|s92|s86|s80`
- viewport: 1280×720、390×844、393×852、375×667
- time: 10:10:30、03:00:00、06:30:00
- state: paused、navy、front、opacity 100%、non-exploded、non-split、panel collapsed、audio OFF

## 画像

- `images/comparison-board-desktop-1010.png`: desktop 10:10横並び
- `images/comparison-board-mobile-390-1010.png`: 390×844 10:10横並び
- `images/comparison-board-desktop-0300.png`: desktop 03:00横並び
- `images/comparison-board-desktop-0630.png`: desktop 06:30横並び
- `images/overlay-movement-display-ring.png`: ムーブメント外周とdisplay ring
- `images/overlay-small-second-fixed-center.png`: 小秒中心固定と円径縮小
- `images/overlay-exposed-plate-area.png`: plate外周露出面積
- `images/normal-main.png` / `images/normal-branch.png`: 通常アクセスpixel exact比較

## JSON

- `reports/candidate-s100.json`
- `reports/candidate-s92.json`
- `reports/candidate-s86.json`
- `reports/candidate-s80.json`
- `reports/regression-results.json`
- `reports/performance.json`
- `reports/pixel-comparison.json`

候補別JSONは、候補値・比率・余白と、4 viewport × 3時刻の12実測を保存する。screen座標、線幅、ring突出、マーカー干渉、3針拘束、小秒軸距離、transform・camera・機構状態不変を含む。

## 結果

- 固定条件: 48/48
- finite Geometry: 全件
- dial ring突出: 0
- マーカー干渉: 0
- 小秒中心―四番車軸距離: 最大0
- 3針角度誤差／取付距離: 最大0
- 最小線幅: 分針2.424330 px、時針3.342986 px、小秒針0.808061 px
- 通常アクセス: mainとpixel exact、PNG SHA-256 `56d9b7e9865190171215db89d6c1b62165e09fc976018b032bebf1efadde18a4`
- clean performance: 通常59.91fps、S92 59.89fps、33ms／50ms超過0

小秒針の線幅・材質・色はmainから変更していないが、モバイルscreen-spaceでは1px未満となるため物理iPhone確認を人間ゲートとして残す。

## 回帰

- Node: 66/66
- desktop 86/86
- 390×844 DPR2 88/88
- UI: 20/20、22/22、22/22
- HUD: 各57/57
- 音声: 各23/23
- Phase 1: 11/11
- Phase 2A: H0〜H3各12/12
- Phase 2B: S100〜S80各15/15
- A.7: 9/9
- 禁止干渉: 0/0

`evidence-manifest.json`はこのREADME自身を含む全証跡ファイルを列挙し、manifest自身だけを除外するclosed-world方式とする。
