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

defaultとexplicitはcanvas、inventory、camera、lighting、transformがexactである。先行測定のChrome Desktop wheel 6.14%差は、時間駆動loopでwheel件数がrun間一致しない測定契約を含んでいたため、製品修正前に原因分離した。

`reports/chrome-desktop-wheel-closure.json`はInstalled Chrome 151.0.7922.72、1280×720で、I（暗黙default）、A（`defaultProfile=completed-watch`）、E（明示12-key）を2つのfresh browser processで各7回、合計42有効runとして保存する。各runはfresh page、10秒settle、`canvas#app`への60 wheel event、50ms interval、固定1秒settleで、dispatch／receive／pacing countはすべて60、console／runtime／unhandled rejectionは0である。

全14 run中央値はI 34.7011fps／p95 34.05ms、A 34.5370fps／34.10ms、E 34.5302fps／34.10msだった。IはE比0.49%、A比0.47%速く、p95も両比較で0.05ms良好だったため、変更していない5%／2ms差分閾値に合格した。正式分類は`FINAL_COMPLETED_WATCH_CHROME_DESKTOP_WHEEL_FAILURE_NOT_REPRODUCED`、`FINAL_COMPLETED_WATCH_PERFORMANCE_MEASUREMENT_VARIABILITY_ISOLATED`、`FINAL_COMPLETED_WATCH_PERFORMANCE_DIFFERENTIAL_GATE_PASSED`である。McAfee／endpoint securityは停止せず、各runのloadとprocess inventoryをraw reportへ保存した。clean-process absolute PASSやHuman受入は主張しない。

## Manifest

`reports/evidence-manifest.json`は本ファイル、9 report、4 captureをclosed-worldで列挙する。manifest自身は自己参照を避けるため対象外とし、`missing`、`unexpected`、`shaMismatch`をすべて空配列とする。
