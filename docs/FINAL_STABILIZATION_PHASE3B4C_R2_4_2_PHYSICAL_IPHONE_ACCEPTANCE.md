# Final Stabilization Phase 3B.4c-R2.4.2 Physical iPhone Acceptance

## 結論

固定Head `0e260fdfc7495293319682ae7b998858641cdd26` のquery限定候補を、production timeout profileのNative Safari自動試験と物理iPhone人間確認の両方で受け入れた。

正式状態は次のとおりである。

- `PHASE3B4C_R2_4_2_NATIVE_SAFARI_SESSION_ESTABLISHED`
- `PHASE3B4C_R2_4_2_NATIVE_SAFARI_PRODUCTION_PROFILE_CONFIRMED`
- `PHASE3B4C_R2_4_2_NATIVE_SAFARI_ACTUAL_WEB_AUDIO_GATE_PASSED`
- `PHASE3B4C_R2_4_2_NATIVE_SAFARI_TRUSTED_GESTURE_GATE_PASSED`
- `PHASE3B4C_R2_4_2_PHYSICAL_IPHONE_ACCEPTANCE_PASSED`
- `PHASE3B4C_R2_4_2_FOREGROUND_AUTO_RESUME_PASSED_6_OF_6`
- `PHASE3B4C_R2_4_2_AUDIO_UI_FALSE_POSITIVE_NOT_REPRODUCED`
- `PHASE3B4C_R2_4_2_HUMAN_ACCEPTED`
- `PHASE3B4C_R2_4_2_READY_FOR_FINAL_PR_REVIEW`

これはPR #26をReady化またはマージする許可ではない。Issue #2のクローズ、既定採用、Phase 3B.4d開始も未承認のままである。

## 検証対象

- device: iPhone 16
- OS: iOS 26.5.2
- browser: Safari
- APP_VERSION: v3.15.0
- source Head: `0e260fdfc7495293319682ae7b998858641cdd26`
- candidate query: `audioLifecycle=r2-3-l4&audioPlatform=p3`
- timeout profile: `PRODUCTION_TIMEOUT_PROFILE`
- diagnostic override: false
- diagnostic setter calls: 0

Production profileは`resumeTimeoutMs=450`、`clockProbeMs=80`、`decodeTimeoutMs=1200`、`closeTimeoutMs=250`、`transactionTimeoutMs=5500`である。診断用の短縮profileを物理iPhone受入へ使用していない。

## Native Safari自動試験

Safari／SafariDriver 26.5.2で、Desktop 1280×720およびMobile 390×844の18条件・400 cycleをproduction profileのactual Web Audioで完了した。trusted WebDriver clickを確認し、`event.isTrusted === true`、user activation有効、AudioContextは`RUNNING_AND_ADVANCING`であった。

- buffer／raw asset: 6/6
- duplicate／backlog／catch-up: 0/0/0
- console error／warning、runtime error、unhandled rejection: 0/0/0/0
- 最大transaction時間: 1213 ms（wrapper 1339 ms）
- Web Audio currentTime進行: 1.430929705 → 1.520907029（delta 0.089977324秒）

この自動試験は実Macスピーカーからの可聴出力を単独では証明しないため、物理iPhone人間確認と区別して記録する。

## 物理iPhone人間確認

Human報告を正式な受入根拠とする。

- 初期起動・作動音: PASS
- sleep復帰: 3/3 PASS
- Home／app復帰: 3/3 PASS
- 時刻合わせ: PASS
- 巻上げ・りゅうず音: PASS
- 最終60秒連続動作: PASS
- foreground自動復帰: 6回
- 1タップfallbackが必要だった回数: 0
- 2タップ以上を要した回数: 0
- 緑ON表示のまま無音となるfalse positive: 再現なし
- duplicate／burst: なし
- 視覚的slowdown: なし
- 総合: PASS

R2.4.1で実装したfresh Contextの1 trusted gesture fallbackは保持されているが、今回の物理iPhone試験では6回すべて自動復帰したため使用されなかった。

## 動画証跡

4本の画面収録はリポジトリへ格納せず、外部Human証跡としてファイル名、長さ、byte数、SHA-256だけを`video-manifest.json`へ記録する。動画音量が低い可能性があるため、音の受入判断は動画のみではなくHumanの直接聴取結果を正式根拠とする。

## 変更範囲と判断

この閉鎖作業は文書と証跡だけを追加・更新する。R2.4.1 transaction、R2 timebase、production timeout、音源、gain、Geometry、rendering、camera、multi-touch、APP_VERSION、試験閾値は変更しない。

最終判断は`HUMAN_ACCEPTED`かつ`READY_FOR_FINAL_PR_REVIEW`である。ただし、Ready化、マージ、Issue #2クローズ、既定採用、Phase 3B.4d開始には別の明示承認が必要である。
