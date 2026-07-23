# 機構同期作動音 Phase 1 証跡

## 結果

| 対象 | 結果 |
| --- | --- |
| Node | 52/52 |
| 既存デスクトップ 1280×720 | 86/86 |
| UI 1280×720 | 20/20 |
| HUD 1280×720 | 45/45 |
| 音声 1280×720 | 23/23 |
| UI 390×844 | 22/22 |
| HUD 390×844 | 57/57 |
| 音声 390×844 | 23/23 |
| UI 393×852 | 21/22（exact viewport専用1件は非適用） |
| HUD 393×852 | 57/57 |
| 音声 393×852 | 23/23 |
| UI 375×667 | 22/22 |
| HUD 375×667 | 57/57 |
| 音声 375×667 | 23/23 |
| A.7 | 9/9（Node内） |
| 位置1／位置2禁止干渉 | 0/0 |

390×844の既存全回帰は87/88である。未達1件はPR #4から記録済みのウォールナット前面サンプル数ガード（995、要求`>1000`）で、ウォールナット表裏輝度差は7.8822%、全テーマ最大差は12.4201%以内、画質値と残り87件は合格した。音・機構・UIの変更による新規失敗ではない。

393×852ではHUD・音声のresponsive試験が合格した。PR #3 UI runnerの21/22は、1件が390×844／375×667のexact viewport専用条件であるためこのviewportでは非適用。375×667でもUI・HUD・音声試験が合格した。pointerでのON、native EnterによるOFF、native SpaceによるONを実ブラウザで確認した。

pullは`crownTransition=0.999975`の上向き交差、pushは`0.000025`の下向き交差で1操作1回発音した。実遷移式の30／60／120fps相当Node試験では端点より83.33〜100ms先行し、同位置再選択、reset、100往復診断は無音だった。右上スピーカーは44×44pxで、選択部品HUDとの矩形重なりはdesktop／3モバイルとも0件である。

## 性能

| 条件 | 平均fps | p50 | p95 | p99 | 33ms超 | 50ms超 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop / pointer回転 | 59.92 | 16.7ms | 17.6ms | 17.7ms | 0 | 0 |
| Desktop / wheelズーム | 59.90 | 16.7ms | 17.6ms | 18.2ms | 0 | 0 |
| Desktop / 音ON | 59.91 | 16.7ms | 18.7ms | 18.7ms | 0 | 0 |
| 390×844 / 音ON | 59.91 | 16.7ms | 18.5ms | 18.7ms | 0 | 0 |

音ON計測でdrop／suppressは0件。音OFF時は音resolverを含む毎フレーム処理を早期終了する。

## ファイル

- `01-mobile-390-audio-off.png`: 390×844、作動音OFFのUI
- `02-mobile-390-audio-on.png`: 390×844、作動音ONのUI
- `03-desktop-escapement-10s-with-audio.webm`: 1280×720、脱進機10.5秒、tick 26／tock 27
- `04-desktop-winding-forward-reverse-with-audio.webm`: 1280×720、正転33／逆転33
- `05-desktop-crown-pull-push-with-audio.webm`: 1280×720、pull 1／push 1
- `06-mobile-390-escapement-10s-with-audio.webm`: 390×844、脱進機10.5秒、tick 26／tock 26
- `07-mobile-390-speaker-on.png`: 390×844、右上スピーカーON
- `08-mobile-390-speaker-off.png`: 390×844、右上スピーカーOFFとfocus-visible
- `audio-event-log.json`: 4動画のイベント列
- `recording-report.json`: viewport、時間、codec、byte数、イベント件数
- `performance-report.json`: 音OFF／ONのA.6フレーム計測
- `browser-report.json`: Node・既存回帰・音声統合試験の詳細
- `review-fix-report.json`: PR #6レビュー修正後の完全性・全回帰・性能再試験
- `detent-ui-review-report.json`: 節度閾値、右上スピーカー、全viewport、A.6性能の追加レビュー結果

4動画はいずれもWebMコンテナ内にVP9映像trackとOpus音声trackを含む。録画は同じ実ブラウザの`canvas.captureStream()`とWeb Audio `MediaStreamDestination`をMediaRecorderへ接続して作成した。

## 物理iPhone人手確認

物理iPhone Safariで次を人手確認し、すべて合格した。

- pull／push音の前倒し時刻と1操作1回の発音
- 右上スピーカーボタンのtap操作
- ON／OFF、タブ移動、ホーム復帰時に二重音と音残りがないこと
- 5bpsのtick／tock、正転巻上げ、逆転空転の音量と識別性

main v3.13.0の既定照明が暗く見える件は既知事項としてIssue #2の最終微調整へ申し送る。
