# S86文字板表示比率 実装証跡

main `e9a223e1ec2b5d966354c73b7719ae81a14f50fa` とS86 Draft候補を同一状態で比較する。S86は実装済み候補であり、mainへは未マージである。

## 固定状態

- viewport: 1280×720、390×844、393×852、375×667
- 時刻: 10:10:30、03:00:00、06:30:00
- navy、front、paused、opacity 100%、non-exploded、non-split、panel collapsed、audio OFF

## 保存内容

- `images/`: desktop／mobile before-after、3時刻、背面、巻上げ、文字板側機構、小秒中心固定、ムーブメント外周と表示リングの比較図
- `adopted-dimensions.json`: S86確定値とH2到達比率
- `before-after-dimensions.json`: mainとS86の表示寸法差、および内部機構・軸中心・Y配置の不変性
- `regression-results.json`: 回帰、拘束、干渉、transform比較
- `performance.json`: 10秒性能計測
- `evidence-manifest.json`: 閉世界SHA-256 manifest

本証跡はS86の表示系だけを比較対象とし、照明、影、材質、透過、PR #5、Issue #2、D2c3を評価・変更対象に含めない。
