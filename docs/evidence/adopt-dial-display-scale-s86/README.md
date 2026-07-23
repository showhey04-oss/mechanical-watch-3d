# S86文字板表示比率 実装証跡

before比較基準main `e9a223e1ec2b5d966354c73b7719ae81a14f50fa` と、v3.15.0で通常文字板表示寸法として採用するS86を同一状態で比較する。v3.14.0は直前基準として維持する。

物理iPhone人手確認では、S86の文字板表示系寸法、小秒針の識別性、時針・分針の長さ、内部機構と表示系の主従関係、回転、ズーム、選択、作動音を現在工程の表示寸法として合格とした。最終外装工程でのケース、ベゼル、風防、物理文字板、インデックス、針との統合時には、表示開口と全体比率を再確認する。これは未解決不具合ではなく、外装統合の確認項目である。

試験判定は `ACCEPTED_WITH_TEST_ENVIRONMENT_LIMITATION`。実施済みmain／PR A/B比較でPR固有失敗は0件だが、全ブラウザ試験マトリクスは未完了である。in-app Browserの安全ポリシーがraw.githack固定commit URLと一時runnerを拒否し、ローカルサーバーも到達不能だったためであり、試験閾値の緩和および製品コードによる回避は行っていない。よって本証跡は全回帰completeまたは`ABSOLUTE_PASS`を主張しない。

## 固定状態

- viewport: 1280×720、390×844、393×852、375×667
- 時刻: 10:10:30、03:00:00、06:30:00
- navy、front、paused、opacity 100%、non-exploded、non-split、panel collapsed、audio OFF

## 保存内容

- `images/`: 4 viewport（1280×720、390×844、393×852、375×667）×3時刻のfront before／after、背面、巻上げ、文字板側機構、小秒中心固定、ムーブメント外周と表示リングの比較図
- `adopted-dimensions.json`: S86確定値とH2到達比率
- `before-after-dimensions.json`: mainとS86の表示寸法差、および内部機構・軸中心・Y配置の不変性
- `reports/current-s86-dimensions.json`: S86実行時診断の保存結果。Phase 1履歴証跡は参照・更新しない
- `reports/s86-dimension-differences.json`: mainからの表示寸法差と不変条件
- `reports/runtime-saved-integration.json`: 実行時診断とS86専用保存JSONの統合結果
- `regression-results.json`: 回帰、拘束、干渉、transform比較と試験環境制約。全WebGL回帰が完了していないため`complete`にはしない
- `performance.json`: 10秒性能計測
- `evidence-manifest.json`: 閉世界SHA-256 manifest

本証跡はS86の表示系だけを比較対象とし、照明、影、材質、透過、PR #5、Issue #2、D2c3を評価・変更対象に含めない。
