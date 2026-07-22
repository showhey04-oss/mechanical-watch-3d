# 機構同期作動音 Phase 1 証跡

## 結果

| 対象 | 結果 |
| --- | --- |
| Node | 50/50 |
| 既存デスクトップ 1280×720 | 86/86 |
| UI 1280×720 | 20/20 |
| HUD 1280×720 | 42/42 |
| 音声 1280×720 | 17/17 |
| HUD 390×844 | 54/54 |
| 音声 390×844 | 17/17 |
| HUD 393×852 | 54/54 |
| 音声 393×852 | 17/17 |
| HUD 375×667 | 54/54 |
| 音声 375×667 | 17/17 |
| A.7 | 9/9（Node内） |
| 位置1／位置2禁止干渉 | 0/0 |

390×844の既存全回帰は87/88である。未達1件はPR #4から記録済みのウォールナット前面サンプル数ガード（997、要求`>1000`）で、表裏輝度差は全テーマ12.4209%以内、画質値と残り87件は合格した。音・機構・UIの変更による新規失敗ではない。

393×852ではHUD・音声のresponsive試験が合格した。PR #3 UI runnerの21/22は、1件が390×844のexact viewport専用条件であるためこのviewportでは非適用。375×667でもHUD・音声試験が合格した。pointerでのONとnative SpaceによるOFF／ONを実ブラウザで確認した。

## 性能

| 条件 | 平均fps | p50 | p95 | p99 | 33ms超 | 50ms超 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop / 音OFF | 59.94 | 16.7ms | 16.8ms | 17.2ms | 0 | 0 |
| Desktop / 音ON | 59.90 | 16.7ms | 17.6ms | 18.4ms | 0 | 0 |
| 390×844 / 音ON | 59.91 | 16.7ms | 18.0ms | 18.6ms | 0 | 0 |

音ON計測でdrop／suppressは0件。音OFF時は音resolverを含む毎フレーム処理を早期終了する。

## ファイル

- `01-mobile-390-audio-off.png`: 390×844、作動音OFFのUI
- `02-mobile-390-audio-on.png`: 390×844、作動音ONのUI
- `03-desktop-escapement-10s-with-audio.webm`: 1280×720、脱進機10.5秒、tick 26／tock 27
- `04-desktop-winding-forward-reverse-with-audio.webm`: 1280×720、正転33／逆転33
- `05-desktop-crown-pull-push-with-audio.webm`: 1280×720、pull 1／push 1
- `06-mobile-390-escapement-10s-with-audio.webm`: 390×844、脱進機10.5秒、tick 26／tock 26
- `audio-event-log.json`: 4動画のイベント列
- `recording-report.json`: viewport、時間、codec、byte数、イベント件数
- `performance-report.json`: 音OFF／ONのA.6フレーム計測
- `browser-report.json`: Node・既存回帰・音声統合試験の詳細
- `review-fix-report.json`: PR #6レビュー修正後の完全性・全回帰・性能再試験

4動画はいずれもWebMコンテナ内にVP9映像trackとOpus音声trackを含む。録画は同じ実ブラウザの`canvas.captureStream()`とWeb Audio `MediaStreamDestination`をMediaRecorderへ接続して作成した。

## 人手確認待ち

実機iPhoneはこの環境から操作できないため未実施。Safari実機で音量、5bpsの知覚、正転／逆転の識別、pull/push、遅延、尾引き、二重発音、タブ／ホーム復帰をユーザーが確認するまで、PRはDraftのまま完成判定しない。
