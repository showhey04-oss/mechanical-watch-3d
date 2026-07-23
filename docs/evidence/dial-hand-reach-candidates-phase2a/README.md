# Phase 2A 時針・分針 到達比率候補比較 証跡

## 状態

- baseline: `e9a223e1ec2b5d966354c73b7719ae81a14f50fa`
- branch: `experiment/dial-hand-reach-candidates`
- app version: v3.14.0
- candidate adoption: none
- human confirmation: required
- Phase 2B: not started

## 固定条件

- viewport: 1280×720、390×844、393×852、375×667
- time: 10:10:30、03:00:00、06:30:00
- state: paused、navy、front、opacity 100%、non-exploded、non-split、panel collapsed、audio OFF
- query: `dialHandCandidate=h0|h1|h2|h3`
- no query / invalid query: H0

## 画像

- [`comparison-board-desktop-1010.png`](images/comparison-board-desktop-1010.png): 1280×720、10:10:30、4候補横並び
- [`comparison-board-mobile-390-1010.png`](images/comparison-board-mobile-390-1010.png): 390×844、10:10:30、4候補横並び
- [`comparison-board-desktop-0300.png`](images/comparison-board-desktop-0300.png): 1280×720、03:00:00
- [`comparison-board-desktop-0630.png`](images/comparison-board-desktop-0630.png): 1280×720、06:30:00
- [`annotated-tip-index-h2.png`](images/annotated-tip-index-h2.png): H2の針先端、インデックス円半径、到達比率
- [`normal-baseline-main.png`](images/normal-baseline-main.png): 固定main通常アクセス
- [`normal-branch.png`](images/normal-branch.png): branch通常アクセス

## JSON

- [`candidate-h0.json`](reports/candidate-h0.json)
- [`candidate-h1.json`](reports/candidate-h1.json)
- [`candidate-h2.json`](reports/candidate-h2.json)
- [`candidate-h3.json`](reports/candidate-h3.json)
- [`pixel-comparison.json`](reports/pixel-comparison.json)
- [`performance.json`](reports/performance.json)
- [`regression-results.json`](reports/regression-results.json)

候補別JSONは各12条件（4 viewport × 3時刻）を保存し、比率、針先screen座標、dial ring内判定、線幅、先端識別性、3針拘束、transform／camera／state不変、有限Geometryを含む。

## closed-world

`evidence-manifest.json`自身をdigest対象から除外し、同階層以下の全ファイルを列挙する。各ファイルのbytesとSHA-256を保存し、missing／unexpectedを0件とする。

## 判定

- H0: `REJECT`
- H1: `RETAIN_FOR_REVIEW`
- H2: `PROVISIONAL_RECOMMENDATION`
- H3: `RETAIN_FOR_REVIEW`

いずれも `ADOPTED` ではない。物理iPhoneを含む人間確認後に採否を判断する。
