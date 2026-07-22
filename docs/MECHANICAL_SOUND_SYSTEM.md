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

位置ボタンのユーザー操作からだけ発音意図を作り、位置遷移の端点到達時に各1回発音する。同位置再選択、初期化、reset、診断、状態復元、テストの直接状態変更は発音しない。

## Web AudioとUI

初期状態はOFFで、`AudioContext`も音源も生成しない。ユーザーが作動音カードをpointerまたはkeyboardでONにした後、contextを生成・resumeし、6原子音をfetch／decodeする。ブラウザがWeb Audio非対応、または音源読込に失敗した場合は「利用不可」を表示し、失敗資産を診断へ残してアプリ本体を継続する。

マスターgainの初期値は0.36、bus gainは脱進機0.24、巻上げ0.32、逆転0.24、りゅうず0.38である。音量変更とON/OFFは短いrampを使い、OFF・非表示では活動中sourceを停止する。`visibilitychange`で非表示中はcontextをsuspendし、復帰時にcursorを再基準化してからresumeする。

UIは操作タブの作動音カード、音量slider、状態表示、説明文からなる。カードは44px以上で、状態と音量は説明文へ`aria-describedby`で関連付ける。

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

自動試験は資産形式、resolver境界、engineライフサイクル、実pointerでのON、音量、6イベント、停止／再開、位置2切離し、可視状態、reset、読込失敗、機構不変を検証する。結果と動画は `docs/evidence/mechanical-operation-sounds/` に保存する。

## 既知の制約と人手確認

- 音色・実機音量・スピーカー特性は自動試験だけでは完成判定できない。
- 実機iPhone Safariで、5bpsのtick/tock知覚、W3/R2の識別、pull/pushの一回性、操作遅延、尾引き、二重発音、タブ／ホーム復帰を確認する必要がある。
- 合成音はETA 6498-1の音響忠実再現ではない。将来実録音へ置換する場合も、機構イベントresolverとは独立して音源とgainを評価する。
