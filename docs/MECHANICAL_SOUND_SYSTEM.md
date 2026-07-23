# 機構同期作動音システム

## 目的と範囲

v3.14.0 Phase 1は、既存の機構状態を音へ変換し、視覚と聴覚で動作を理解できるようにする。対象は脱進機tick／tock、正転巻上げ、逆転空転、りゅうずpull／pushの6原子音である。音は教育・演出用の合成音であり、実物のETA 6498-1録音ではない。

この機能は機構状態を読み取るだけである。輪列・日の裏輪列・キーレスワーク・脱進機・針・主ゼンマイ、レンダリング、照明、影、材質、構造透過、適応DPR、Arcballカメラへ値を書き戻さない。モバイルの暗部・影・露出差を扱うIssue #2とも分離する。

## 構成

- `js/audio-events.js`: ビート番号と回転位相を離散イベントへ変換する純粋resolver。Web Audio、DOM、timerへ依存しない。
- `js/mechanical-audio.js`: 音源の遅延読込、Web Audioグラフ、gain ramp、source停止、可視状態、診断を管理する。
- `index.html`: 既存機構状態のread-only snapshot、UI操作の発音意図、resolverとengineの接続を担当する。
- `assets/audio/manifest.json`: 選定音、形式、用途、来歴を機械可読で記録する。

機構更新の後に音用snapshotを取得し、resolverがイベントを返した場合だけengineへ渡す。発音前後のsnapshotを比較し、音処理が主要機構値を変更していないことを診断へ記録する。音OFF時はresolverを呼ばず早期終了する。

## イベント源

### 脱進機

既存の`studyBeat`整数が進んだ境界を使い、偶奇でtick／tockを交互に解決する。停止・非表示・時刻ジャンプ・音のON/OFFではcursorを現在値へ再基準化し、経過分を遡及再生しない。高速時は最大8イベント/秒の決定論的strideを使い、1フレームに複数イベントを再生しない。

### 正転巻上げ

位置1で一方向巻上げグラフが接続され、正転中の角穴車実角がラチェット歯ピッチを越えたときにW3を発音する。りゅうず入力角を直接音へ変換しない。

### 逆転空転

位置1で逆転中の巻上げピニオン実角が歯ピッチを越えたときにR2を発音する。角穴車が従動しない一方向空転状態と一致させる。位置2では両巻上げ音を出さない。

### りゅうずpull／push

位置ボタンのユーザー操作からだけ発音意図を作る。pullは`crownTransition`が`0.999975`を上向きに、pushは`0.000025`を下向きに交差したフレームで各1回発音する。timerは使わず、既存の遷移更新を30／60／120fps相当で進めた場合に端点到達より70〜100ms先行する。同位置再選択、初期化、reset、診断、状態復元、テストの直接状態変更は発音しない。

## Web AudioとUI

初期状態はOFFで、`AudioContext`も音源も生成しない。ユーザーが右上のスピーカーボタンをpointerまたはkeyboardでONにした後、contextを生成・resumeし、6原子音をfetch／decodeする。ブラウザがWeb Audio非対応、または音源読込に失敗した場合は「利用不可」を通知し、失敗資産を診断へ残してアプリ本体を継続する。

マスターgainは0.36、bus gainは脱進機0.24、巻上げ0.32、逆転0.24、りゅうず0.38の固定値である。ON/OFFは短いrampを使い、OFF・非表示では活動中sourceを停止する。`visibilitychange`で非表示中はcontextをsuspendし、復帰時にcursorを再基準化してからresumeする。

UIは右上に固定した小型スピーカーアイコンだけを表示し、操作タブ内に作動音セクションや音量sliderを置かない。ボタンの操作領域は44×44px、`aria-label`と`aria-pressed`を状態に同期し、Enter／Spaceと`focus-visible`へ対応する。選択部品HUDは下方へ分離し、矩形重なりを自動試験する。

## 音源

全ファイルは48kHz、16-bit PCM、mono WAVである。

| 用途 | 実行時ファイル | 選定案 |
| --- | --- | --- |
| 脱進機tick | `escapement_tick_A3.wav` | A3 |
| 脱進機tock | `escapement_tock_A3.wav` | A3 |
| 正転巻上げ | `winding_click_W3.wav` | W3 |
| 逆転空転 | `reverse_click_R2.wav` | R2 |
| りゅうずpull | `crown_pull_S3.wav` | S3 |
| りゅうずpush | `crown_push_S3.wav` | S3 |

`assets/audio/references/`には選定判断用の4参照音を保存する。ライセンス・来歴は提供された選定済み音源パッケージに基づき、`manifest.json`でも「synthetic direction-study assets」と明記する。

## 診断と証跡

`getAudioDiagnostics()`は対応可否、ON/OFF、context状態、必須6bufferの完全性・欠損種別、読込済み・失敗資産、gain、最終イベント、種類別件数、drop／suppress件数、活動source、イベントログ、機構不変比較を返す。部分読込失敗後の再ONでは欠損bufferだけを再試行し、6種すべてが揃うまでONへ遷移しない。query指定の証跡モードはcanvas映像とWeb AudioのMediaStreamDestinationをMediaRecorderで合成し、VP9 + Opus WebMを生成する。通常の既定経路では有効にならない。

OFF操作ではmaster gainを25msで0へrampし、30ms後に活動sourceを停止してcontextをsuspendする。待機中に再ONされた場合はlifecycle sequenceにより古い停止処理を無効化し、新しい再生状態を停止しない。

自動試験は資産形式、方向別節度閾値、30／60／120fpsでの70〜100ms先行、engineライフサイクル、実pointerでのON、固定gain、6イベント、停止／再開、位置2切離し、可視状態、reset、読込失敗、機構不変、スピーカーと部品HUDの非重複を検証する。結果と動画は `docs/evidence/mechanical-operation-sounds/` に保存する。

## 物理iPhone受入

- 物理iPhone Safariで、pull／push音の時刻と1操作1回の発音を確認し合格した。
- 右上スピーカーボタンのtap操作、ON／OFF、タブ移動、ホーム復帰を確認し、二重音と音残りがないことを確認した。
- 5bpsのtick／tock、正転巻上げW3、逆転空転R2の音量と識別性を確認し合格した。

## 既知の制約

- 合成音はETA 6498-1の音響忠実再現ではない。将来実録音へ置換する場合も、機構イベントresolverとは独立して音源とgainを評価する。
- main v3.13.0の既定照明が実機で暗く見える件は既知事項であり、このPRへPR #5のD2c3や照明変更を取り込まず、Issue #2の最終微調整へ申し送る。
