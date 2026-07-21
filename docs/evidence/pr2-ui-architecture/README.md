# PR #2 UIアーキテクチャ証跡

基準コミット`c11724a199e427c1c756fe834d6e75ffa2c35430`から、機構・レンダリングを変更せず操作パネルを3タブへ整理した実ブラウザ証跡である。

| ファイル | 内容 |
| --- | --- |
| `01-desktop-operation.jpg` | 1440×900・操作タブ |
| `02-desktop-learning.jpg` | 1440×900・学習タブ |
| `03-desktop-technical.jpg` | 1440×900・技術タブ |
| `04-desktop-collapsed.jpg` | 1440×900・折りたたみ |
| `05-mobile-operation-390x844.jpg` | 390×844・操作タブ |
| `06-mobile-learning-390x844.jpg` | 390×844・学習タブ |
| `07-mobile-technical-390x844.jpg` | 390×844・技術タブ |
| `08-mobile-sticky-tabs-390x844.jpg` | 390×844・本文スクロール中のstickyタブ |
| `09-position2-tab-roundtrip.jpg` | 位置2を保持したタブ往復 |
| `10-learning-selected-part.jpg` | 右上と学習タブで共有する選択部品情報 |
| `11-desktop-tab-switch.gif` | デスクトップ3タブ切替 |
| `12-mobile-panel-toggle.gif` | モバイルパネル開閉 |
| `13-rotation-after-tab-switch.gif` | タブ切替後の3D回転 |
| `browser-report.json` | 回帰・性能結果の要約 |

静止画とGIFはローカルの実ブラウザで同じ実装を操作して取得した。Issue #2の透明・影課題は変更していない。
