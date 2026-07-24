# Phase 2C Y-stack evidence

この証跡は、同一origin・sandboxなしiframeから明示的に呼び出した読取専用監査です。数値監査の生成元は`da473d7d569f1b43b9d6adc04087a0a8011e9951`、オフスクリーンキャプチャ実装は`c8d59606810026a69ddef1a9a7c4e68bd379cf51`です。親ページ・iframeとも`http://127.0.0.1:8000`、iframeの`document.readyState`は`complete`で確認しました。

## 画像の生成元

- `desktop-side.png`: Three.js sceneを1280×720のWebGLRenderTargetへ描画した実ランタイムPNG
- `mobile-390-side.png`: 同じsceneを390×844のWebGLRenderTargetへ描画した実ランタイムPNG
- `annotated-side-y-datums.png`: desktop実ランタイムPNGへ実測基準面を重ねた画像
- `base-movement-envelope.png`: desktop実ランタイムPNGへ基礎ムーブメント包絡を重ねた画像
- `hand-fitting-envelope.png`: desktop実ランタイムPNGへ実軸Mesh・針ボス包絡を重ねた画像
- `complete-display-envelope.png`: desktop実ランタイムPNGへ文字板・針を含む包絡を重ねた画像
- `y-layer-stack-diagram.png`: `reports/y-layer-stack.json`から生成した独立模式図

PNG本文は監査JSONへ含めず、24,000 byte単位のDOMチャンクを個別回収して再構成しました。ブラウザSHA-256と保存後SHA-256はdesktop／mobileとも一致し、カメラ、renderer、control target、world transform、機構状態の復元判定は全項目trueです。画素分布は`reports/image-authenticity.json`に記録しています。

## 実行環境制約

入れ子iframeで要求した1280×720に対し、live canvas drawing bufferは640×300、live aspectは2.1333333333、desktop証跡aspectは1.7777777778でした。この制約は`TEST_ENVIRONMENT_NESTED_VIEWPORT_LIMITATION`、`productDefect: false`として記録し、live canvasの拡大転記は採用していません。正式画像は、通常canvas、DOM、DPRを変更せず、指定解像度のWebGLRenderTargetから取得しました。

## 結論

基礎ムーブメント6.645、実Mesh参照による針取付・突出軸系3.190、文字板・針を含むアプリ6.745 model unitです。ETA 4.50 mmとの基準面は未対応付けであり、差分を調整量として扱いません。判断は`REFERENCE_DATUM_UNRESOLVED` / `UNVERIFIED`、寸法変更判断は`NO_DIMENSION_CHANGE`、次工程推奨はPR #11のReady化・マージ後の`FINAL_EXTERIOR_INTEGRATION`です。

`reports/`には実測JSON、capture metadata、画像真正性、回帰結果を保存し、`evidence-manifest.json`で閉世界SHA-256を管理します。Phase 1証跡は変更していません。
