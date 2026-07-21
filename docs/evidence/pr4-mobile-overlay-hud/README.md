# PR #4 モバイルオーバーレイ・HUD証跡

基準コミット`368ac3d447627773605cbc8146d98779fae6eae3`から、機構・レンダリングを変更せずHUDとモバイルボトムシートを整理した実ブラウザ証跡である。キャプチャ対象のアプリ実装コミットは`63ce788d07aa729337f83530c4f3d82aad28054f`で、拡張した試験ハーネス、文書、証跡自体は後続のPR Headへ収録する。

## 静止画

| ファイル | 内容 |
| --- | --- |
| `01-mobile-390-initial-no-info.jpg` | 390×844・初期表示で部品情報HUDが非表示 |
| `02-mobile-390-selected-info.jpg` | 390×844・部品選択後だけHUDを表示 |
| `03-mobile-390-cleared-info.jpg` | 390×844・背景タップによる選択解除後 |
| `04-mobile-390-no-version-badge.jpg` | キャンバス上に常設バージョン表示がない通常画面 |
| `05-mobile-390-panel-model-info.jpg` | 学習タブ内のモデル名・v3.13.0・PR #3基準情報 |
| `06-mobile-390-hamburger.jpg` | 44×44pxのハンバーガーとキーボード`focus-visible`状態 |
| `07-mobile-390-panel-open.jpg` | 390×844・ボトムシートを開いた状態 |
| `08-mobile-390-visible-3d-region.jpg` | パネル上部に残る3D操作領域 |
| `09-mobile-390-position1-winding.jpg` | パネルを開いた位置1巻上げ |
| `10-mobile-390-position2-setting.jpg` | パネルを開いた位置2時刻合わせ |
| `11-mobile-393x852-open.jpg` | 393×852・開いたボトムシート |
| `12-mobile-375x667-open.jpg` | 375×667・開いたボトムシート |
| `13-desktop-expanded.jpg` | 1280×720・幅365pxのデスクトップパネル |
| `14-desktop-collapsed.jpg` | 1280×720・デスクトップ折りたたみ |

## GIF

| ファイル | 内容 |
| --- | --- |
| `15-hamburger-open-close.gif` | 実pointer入力によるハンバーガー開閉 |
| `16-open-panel-position1-winding.gif` | パネルを開いた位置1巻上げと実Object3D回転 |
| `17-open-panel-position2-setting.gif` | パネルを開いた位置2時刻合わせと針・機構の連動 |
| `18-part-select-show-clear.gif` | 上部キャンバスの部品選択、HUD表示、背景タップ解除 |
| `19-panel-close-then-rotate.gif` | パネルを閉じた後の実pointer 3D回転 |

## 実測寸法

| Viewport | パネル高さ | Viewport比 | 上部3D領域 | Viewport比 | 横オーバーフロー |
| --- | ---: | ---: | ---: | ---: | ---: |
| 390×844 | 472.63px | 56.00% | 371.37px | 44.00% | 0px |
| 393×852 | 477.12px | 56.00% | 374.88px | 44.00% | 0px |
| 375×667 | 373.52px | 56.00% | 293.48px | 44.00% | 0px |

## 自動検証

- Node 33/33
- デスクトップ既存回帰86/86、PR #3 UI回帰20/20、PR #4 HUD回帰20/20
- 390×844の既存回帰88/88、PR #3 UI回帰22/22、PR #4 HUD回帰31/31
- 393×852のPR #4 HUD回帰31/31
- 375×667のPR #3 UI回帰22/22、PR #4 HUD回帰31/31
- A.7 9/9、位置2の600フレーム最大ドリフト0、100往復累積誤差0、30/60/120fps最終座標一致、禁止干渉0/0
- A.6 pointer／wheelはデスクトップ、390×844ともp95 18.0ms以下、33ms／50ms超0件
- 実pointerで上部キャンバスの部品選択・背景解除、2点pointerの両接点がキャンバス内であることを確認
- 実キーボードのEnter／Spaceと、Visual Viewport縮小時の時刻入力可視性を確認

完全な数値は`browser-report.json`に記録した。

## 変更範囲と制約

ライト、影、露出、tone mapping、材質、構造透過、DPR、ArcballControls、カメラ、Raycaster候補選定、animation loop、内部機構は変更していない。Issue #2へモバイル暗部の追記コメントを追加したが、IssueはOpenのままであり、本PRではレンダリング修正を行っていない。

iPhone実機は未確認である。画像の暗部はIssue #2で扱う既知課題であり、本PRの改善証跡として扱わない。

`browser-report.json`は回帰・性能・HUD状態・寸法・Issue #2の扱いを機械可読にまとめた証跡である。
