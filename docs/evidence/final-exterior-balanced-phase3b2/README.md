# Phase 3B.2 基本装着部 証跡

## 由来

- リポジトリ：`showhey04-oss/mechanical-watch-3d`
- Baseブランチ：`feature/final-exterior-balanced-phase3b1`
- Phase 3B.1承認Head：`d51e4f8790596f7bc894e8c716edb0d54968d260`
- Phase 3B.2実装コミット：`51ab089e898cc3d2216d97fece83e334d9cd49c3`
- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- APP_VERSION：`v3.15.0`
- capture mode：same-origin browser harness、actual WebGL canvas capture、actual in-app Browser screenshot
- viewport：Desktop 1280×720、Mobile 390×844
- 状態：navy、10:10:30、paused、panel collapsed、必要に応じてopacity／selection／display query

`desktop-*.png`、`mobile-390-*.png`、`before-desktop-*.png`、opacity／hidden／explode／split画像は、実Three.js sceneをoffscreen WebGLRenderTargetへ1回描画して取得したPNGである。選択とパネル画像は実in-app Browser screenshotである。空の背景から生成したモデル画像ではない。

`tests/generate-phase3b2-evidence.py`は正本captureを新規生成しない。正本を入力に、比較板、注記close-up、review GIFだけを生成する。

## 結果要約

- lug-to-lug：46.600
- 4ラグ：有限、indexed、closed、退化／重複／逆向き重複triangle 0、non-manifold edge 0
- 2スプリングバー：主径1.500、ピン径0.800、有効長20.800
- ストラップ：幅20.000→16.500、厚さ2.400、中心線長42.000／58.000
- バックル：内幅16.800、外幅18.400
- 登録部品：9
- 位置1／位置2の機構・既存外装・新規装着部禁止干渉：0／0
- Desktop／Mobile runtime world値：一致
- Phase 2C：6.645／3.190／6.745を維持
- 通常path：固定mainと237,380 byte／SHA-256 `f3bdd25d543c11a4ae1dc08a3020a60358a85d5d20a90ccff9b8242bc35bd003`で一致
- 性能：Desktop／390×844の10秒idle・pointer・wheelでA.6絶対閾値とPhase 3B.1差分基準に合格
- 物理iPhone：人間確認待ち

## 静止画

### 正本runtime capture

- `before-desktop-front.png`
- `before-desktop-side.png`
- `before-desktop-back.png`
- `desktop-front.png`
- `desktop-oblique-front.png`
- `desktop-side.png`
- `desktop-back.png`
- `desktop-oblique-back.png`
- `mobile-390-front.png`
- `mobile-390-side.png`
- `mobile-390-back.png`
- `opacity-50.png`
- `opacity-16.png`
- `attachments-hidden.png`
- `exploded.png`
- `side-split.png`
- `crown-position-1.png`
- `crown-position-2.png`

### 実in-app Browser

- `lug-selection.png`
- `spring-bar-selection-exploded.png`
- `strap-pointer-selection.png`
- `buckle-selection-back.png`
- `internal-selection-opacity-16.png`
- `mobile-390-panel-collapsed.png`
- `mobile-390-panel-open.png`

### 派生比較・注記

- `comparison-front.png`
- `comparison-side.png`
- `comparison-back.png`
- `lug-connection-12.png`
- `lug-connection-6.png`
- `crown-side-lug.png`
- `spring-bar-diagram.png`
- `strap-connection.png`
- `buckle-detail.png`
- `transparency-board.png`
- `visibility-display-board.png`
- `selection-board.png`
- `mobile-board.png`
- `camera-occupancy-diagram.png`

## Review GIF

- `video-01-full-rotation.gif`
- `video-02-lug-close-rotation.gif`
- `video-03-strap-close-rotation.gif`
- `video-04-crown-position-relation.gif`
- `video-05-opacity-cycle.gif`
- `video-06-selection-cycle.gif`
- `video-07-mobile-rotation-zoom.gif`
- `video-08-mechanism-operation.gif`

GIFは実runtime captureを順序付けたreview animationで、連続WebM録画ではない。カメラ入力の連続性はA.6 pointer／wheelの10秒実入力診断、モデル非回転はmodel transform invariantで検証する。

## Reports

- `reports/phase3b2-config.json`
- `reports/lug-geometry-report.json`
- `reports/spring-bar-report.json`
- `reports/strap-geometry-report.json`
- `reports/buckle-report.json`
- `reports/world-bounds-comparison.json`
- `reports/camera-occupancy-report.json`
- `reports/interference-report.json`
- `reports/selection-report.json`
- `reports/opacity-visibility-report.json`
- `reports/normal-path-diff.json`
- `reports/regression-results.json`
- `reports/performance-results.json`
- `reports/image-evidence-report.json`
- `reports/desktop-runtime.json`
- `reports/mobile-390-runtime.json`
- `reports/integration-raw.json`
- `reports/performance-raw.json`

`evidence-manifest.json`はmanifest自身を除くclosed-world一覧で、各ファイルのbytesとSHA-256を持つ。

## 判断

自動・実ブラウザ検証の判断は`AUTOMATED_PASS_PENDING_PHYSICAL_IPHONE_AND_HUMAN_VISUAL_REVIEW`である。

次を主張しない。

- 通常表示への既定採用
- 製造可能性
- 防水、耐久、実ばね、実着脱
- Phase 3C意匠完成
- 物理iPhone合格

人間確認では、ラグ接続、ストラップの曲がりと比率、バックル、100／50／16%透過、外装から内部への選択、回転・ズーム、位置1／2、巻上げ、時刻合わせ、秒停止、作動音を確認する。
