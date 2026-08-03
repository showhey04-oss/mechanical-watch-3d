# Final completed watch default adoption evidence

## 範囲

この証跡は、main `0aa04a582ee7238b4ef3da81bf9f0eb4ccf2acff`から作成した実装commit `1b1e2c22d09389e27489797f666ed2358b1ca35a`を対象とする。APP_VERSIONはv3.15.0で、通常rootへ12-key完成時計profileを内部注入するresolver、明示query優先、`defaultProfile=legacy`保護を検証した。

## 実行環境

- Installed Chrome
- Playwright WebKit
- Native Safari／SafariDriver 26.5.2
- Desktop 1280×720
- Mobile 390×844
- localhost same-origin HTTP

`reports/route-matrix.json`はChrome／WebKit各26セル、`reports/default-vs-explicit.json`と`reports/legacy-protected-path.json`はdeterministic startup条件のcanvas／pixel／inventory／camera比較を保存する。`reports/native-safari.json`はqueryなしrootでtrusted gestureとactual Web Audioを検証した結果である。

## Capture

- `captures/default-root-desktop.png`：Installed Chromeの実Three.js描画、1280×720
- `captures/default-root-mobile-390.png`：Installed Chromeの実Three.js描画、390×844
- `captures/legacy-desktop.png`：`defaultProfile=legacy`、1280×720
- `captures/legacy-mobile-390.png`：`defaultProfile=legacy`、390×844

## 性能制約

defaultとexplicitはcanvas、inventory、camera、lighting、transformがexactである。修正後Headの同一環境反復測定は12セル中11セルが合格し、Chrome Desktop wheelの1セルだけがFPS悪化6.14%で未達だった。`reports/performance.json`は未達をそのまま保存し、`FINAL_COMPLETED_WATCH_PERFORMANCE_DIFFERENTIAL_GATE_PASSED`やclean-process absolute PASSを主張しない。製品閾値の変更は0である。

## Manifest

`reports/evidence-manifest.json`は本ファイル、8 report、4 captureをclosed-worldで列挙する。manifest自身は自己参照を避けるため対象外とし、`missing`、`unexpected`、`shaMismatch`をすべて空配列とする。
