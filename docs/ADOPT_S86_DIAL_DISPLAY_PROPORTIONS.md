# S86文字板表示比率 実装報告（v3.15.0 Draft）

## 結論

Phase 2A–2Bの人間確認で選定されたS86を、main `e9a223e1ec2b5d966354c73b7719ae81a14f50fa` から独立したDraft実装候補へ反映する。main公開基準はマージまでv3.14.0であり、S86は実装済み候補・未マージである。

物理iPhoneで、現在工程の文字板表示系寸法としてS86を人手確認し合格とした。小秒針の識別性、時針・分針の長さ、内部機構と表示系の主従関係、回転・ズーム・部品選択・作動音はいずれも合格である。これは現在工程の表示寸法に対する受入であり、ケース、ベゼル、風防、物理文字板、インデックス、針を統合する最終外装工程では、表示開口と全体比率を改めて確認する。これは未解決不具合ではなく、外装統合の確認項目である。

## 確定表示寸法

| 項目 | S86値 |
|---|---:|
| dialRingDiameter | 27.692 |
| indexCircleDiameter | 25.456 |
| minuteHandLength | 12.040 |
| hourHandLength | 8.600 |
| smallSecondRingDiameter | 7.740 |
| smallSecondHandLength | 3.268 |

分針／index半径は0.945946、時針／index半径は0.675676、時針／分針は0.714286で、Phase 2A H2到達比率を維持する。

## 実装境界

通常モデル用の読み取り専用 `DIAL_DISPLAY_DIMENSIONS` へ確定値だけを集約し、分針・時針・小秒針、dial ring、index、補助マーカー、12時マーカー、小秒リングのGeometry生成値へ適用する。`dialHandCandidate`、`dialDisplayScale`、query resolver、比較overlay、候補UI、候補診断は本番コードへ含めない。

針Object3Dのpivot、position、rotation、scaleは不変とし、分針―筒かな、時針―時針管、小秒針―四番車軸の1:1拘束を維持する。ムーブメント基準径36.6、地板・受、輪列、日裏、軸中心、小秒中心、四番車軸、りゅうず・巻真・キーレスワーク、回転比・位相、Y配置、カメラ、照明、影、材質、透過、DPR、UI、作動音は変更しない。Phase 2Cは開始しない。

## 証跡

mainとのbefore／after、3時刻、4 viewport、背面、巻上げ、文字板側機構、小秒中心固定、表示リング重ね合わせ、回帰・性能JSONと閉世界manifestは [`docs/evidence/adopt-dial-display-scale-s86/README.md`](evidence/adopt-dial-display-scale-s86/README.md) に保存する。
