# PR #4 モバイルオーバーレイ・HUD証跡

基準コミット`368ac3d447627773605cbc8146d98779fae6eae3`から、機構・レンダリングを変更せずHUDとモバイルボトムシートを整理した実ブラウザ証跡である。初期証跡01〜19のアプリ実装コミットは`63ce788d07aa729337f83530c4f3d82aad28054f`、実機レビュー追補20〜38は本READMEと同じPR Headの実装を対象とする。

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
| `20-desktop-expanded-borderless-hamburger.jpg` | PC展開時・外枠なしのハンバーガー |
| `21-desktop-collapsed-left-hamburger.jpg` | PC折りたたみ時・左端へ追従したハンバーガー |
| `22-mobile-390-borderless-hamburger.jpg` | 390×844・外枠なしのハンバーガー |
| `23-mobile-390-time-input-contained.jpg` | 390×844・本文内へ収まる時刻入力 |
| `24-mobile-375-time-input-contained.jpg` | 375×667・本文内へ収まる時刻入力とボタン文言 |
| `25-mobile-hhmm-applied-display.jpg` | iOS相当`HH:mm`の`change`適用後に一致する表示時刻 |
| `26-mobile-applied-hand-angles.jpg` | 適用時刻と一致する時・分・秒針角 |
| `27-toggle-card-on.jpg` | トグルカードONの金色強調 |
| `28-toggle-card-off.jpg` | トグルカードOFFのグレー表示 |
| `29-toggle-card-disabled.jpg` | disabledトグルカードの別グレー表示 |
| `30-toggle-card-display-groups.jpg` | 表示グループ9項目のカード配置 |
| `31-toggle-card-technical.jpg` | 技術タブのトグルカード |
| `32-toggle-card-learning.jpg` | 学習タブのトグルカード |
| `33-live-sync-state.jpg` | Live Syncのカード状態 |

## GIF

| ファイル | 内容 |
| --- | --- |
| `15-hamburger-open-close.gif` | 実pointer入力によるハンバーガー開閉 |
| `16-open-panel-position1-winding.gif` | パネルを開いた位置1巻上げと実Object3D回転 |
| `17-open-panel-position2-setting.gif` | パネルを開いた位置2時刻合わせと針・機構の連動 |
| `18-part-select-show-clear.gif` | 上部キャンバスの部品選択、HUD表示、背景タップ解除 |
| `19-panel-close-then-rotate.gif` | パネルを閉じた後の実pointer 3D回転 |
| `34-desktop-collapse-hamburger-follow.gif` | PCパネル開閉とハンバーガーの387→10→387px追従 |
| `35-mobile-time-change-apply.gif` | モバイル相当の時刻選択`change`から表示・針への反映 |
| `36-live-sync-manual-override.gif` | Live Sync ONから手動適用し同期OFFへ移行 |
| `37-toggle-card-on-off.gif` | 実pointerによるトグルカードON／OFF |
| `38-display-group-toggle-3d.gif` | 表示グループのカード切替と3Dモデル表示の同期 |

## 実測寸法

| Viewport | パネル高さ | Viewport比 | 上部3D領域 | Viewport比 | 横オーバーフロー |
| --- | ---: | ---: | ---: | ---: | ---: |
| 390×844 | 472.63px | 56.00% | 371.37px | 44.00% | 0px |
| 393×852 | 477.12px | 56.00% | 374.88px | 44.00% | 0px |
| 375×667 | 373.52px | 56.00% | 293.48px | 44.00% | 0px |

### 時刻入力と本文

| Viewport | input left | input right | input width | body left | body right | body width | document／grid overflow |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 390×844 | 17px | 373px | 356px | 1px | 389px | 388px | 0px |
| 393×852 | 17px | 376px | 359px | 1px | 392px | 391px | 0px |
| 375×667 | 17px | 358px | 341px | 1px | 374px | 373px | 0px |

Visual Viewport 390×520相当ではinput top／bottomが376.88／418.88px、本文top／bottomが285.80／510.00pxであり、入力全体が表示範囲内に収まった。

## 自動検証

- Node 33/33
- デスクトップ既存回帰86/86、PR #3 UI回帰20/20、PR #4 HUD回帰42/42
- 390×844の既存回帰87/88、PR #3 UI回帰22/22、PR #4 HUD回帰54/54
- 393×852のPR #4 HUD回帰54/54
- 375×667のPR #3 UI回帰22/22、PR #4 HUD回帰54/54
- Visual Viewport 390×520相当のPR #4 HUD回帰54/54
- 1280×720→390×844→1280×720の動的resizeで、ARIA、44px、枠なし、387→10→387px、モバイル自動close／手動open／PC復帰を確認
- A.7 9/9、位置2の600フレーム最大ドリフト0、100往復累積誤差0、30/60/120fps最終座標一致、禁止干渉0/0
- A.6 pointer／wheelはデスクトップ、390×844ともp95 16.8ms、33ms／50ms超0件
- 実pointerで上部キャンバスの部品選択・背景解除、2点pointerの両接点がキャンバス内であることを確認
- 実キーボードのEnter／Spaceと、Visual Viewport縮小時の時刻入力可視性を確認
- `HH:mm`／`HH:mm:ss`、`input`→`change`→`blur`、touch相当ボタン、Live Sync手動解除、位置1／位置2で表示時刻・`watchTimeSec`・3針角の一致を確認
- 全16カードのDOM・状態同期・44px・9px gapに加え、各カードでtouch相当pointer、ラベル操作、native keyboard focus／activation、モデル表示同期と元状態への復帰を確認

既存モバイル回帰の未達1件はウォールナット前面のサンプル数が3反復で986、998、996となり、既知の条件`sampleCount > 1000`へ届かなかったもの。表裏輝度差は全テーマ12.42%以内で、暗部率・クリップ率を含む画質値と残る87件は合格した。レンダリングや試験条件は変更していない。

完全な数値は`browser-report.json`に記録した。

## 変更範囲と制約

ライト、影、露出、tone mapping、材質、構造透過、DPR、ArcballControls、カメラ、Raycaster候補選定、animation loop、内部機構は変更していない。Issue #2へモバイル暗部の追記コメントを追加したが、IssueはOpenのままであり、本PRではレンダリング修正を行っていない。

iPhone実機は未確認である。画像の暗部はIssue #2で扱う既知課題であり、本PRの改善証跡として扱わない。

収録数は静止画28枚、GIF 10本である。

`browser-report.json`は回帰・性能・HUD状態・寸法・Issue #2の扱いを機械可読にまとめた証跡である。
