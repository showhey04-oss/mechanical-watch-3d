# Final Stabilization Phase 3B.4c-R2.1

## 判定

`TECHNICAL_PASS_PHYSICAL_IPHONE_R2_1_RETEST_REQUIRED`

R2のforeground mechanism timebaseを維持したまま、時刻不連続後に旧timelineの
audible cursorを参照してテンプ音が停止する問題と、foreground復帰時に
AudioContextの`running`到達を確認せずgainを戻す問題を修正した。

物理iPhoneで合格済みの次の結果は維持する。

- `PHASE3B4C_R2_PHYSICAL_IPHONE_FREE_RUNNING_PASS`
- `PHASE3B4C_R2_PHYSICAL_IPHONE_LIVE_SYNC_PASS`
- `PHASE3B4C_R2_WINDING_AND_REVERSE_AUDIO_PASS`

R2.1の物理iPhone確認は未実施である。PR #26はOpen／Draftを維持し、
Ready化、マージ、既定採用、Issue #2のクローズ、Phase 3B.4d開始は行わない。

## 原因

通常のre-anchorは`lastTargetBeat`やpending sourceを初期化していたが、
`lastActuallyAudibleBeat`、audible時刻、event sequence、scan cursorを保持していた。
時計時刻を過去へ変更すると次の予約対象が旧timelineに引っ張られ、
`await-mechanism-projection-window`から復帰できなかった。

また、visible復帰時の`AudioContext.resume()`はPromiseの完了後に
`context.state === "running"`を確認せず、suspendedのままでもgainを復帰していた。

## 実装

### Mechanism timeline discontinuity

専用の`resetForMechanismTimelineDiscontinuity()`を追加した。次を新しいgenerationへ
切り替える際に初期化する。

- pending escapement source
- target beat／start time
- audible beat／audio time／event sequence
- active audio markers
- starvation、epoch、clock sample、no-op state
- audible scan cursor

次のtargetは必ず`floor(new studyBeat) + 1`から開始する。入力時刻、現在時刻、
simulation jump、りゅうず位置1／2、live-sync開始／解除へ適用した。
過去beatのcatch-up、duplicate、backlog burstは行わない。

### Verified AudioContext recovery

`resumeVisibleAudio({ trustedGesture, reason })`はresume前後state、Promise結果、
`running`到達、trusted gesture要求、attempt sequenceを記録する。
gainはAudioContextが実際に`running`へ到達した場合だけ復帰する。

自動resumeが失敗またはsuspendedのままの場合は`resume-required`へ移行し、
44×44pxの既存スピーカーボタンを「作動音を再開」として利用する。
成功するまで論理的な作動音ONと6bufferを維持し、OFF／ON自動切替、
buffer再読込、context再生成、独立timerは行わない。

## 検証

- Node決定論的試験：時刻前後変更、日跨ぎ、同時刻、current-time、
  crown set／wind、live-sync、fake AudioContext 8系統
- actual Web Audio：Desktop 1280×720、Mobile 390×844
- actual UI：入力時刻前後、現在時刻、pause／resume、sound OFF／ON
- lifecycle：hidden／visible、pagehide／pageshow、resume-required復旧
- winding／reverse freewheel
- phase contract、buffer 6/6、source inventory、禁止干渉0
- 10秒audio-on-idle performance、model transform invariant
- application console error／warning 0

Codex Browserの自動操作イベントは`isTrusted=false`として配信されるため、
actual Web Audioの復旧は明示スピーカー操作経路で確認した。trueのtrusted gesture
分岐はfake AudioContextのNode試験で合格しているが、物理iPhoneでの1 gesture復旧を
Human確認するまで最終受入とはしない。

## 変更しない範囲

- R2 foreground mechanism timebase
- watch／train timebase、power reserve、rate、escapement
- Geometry、照明、透過、カメラ、iOS multi-touch
- audio sample、master gain 0.36、各bus gain
- APP_VERSION v3.15.0
- 試験閾値、hidden elapsed restoration

## Human確認

- free-running 5分 sanity
- live-sync 5分 sanity
- 入力時刻前後と現在時刻を3サイクル
- 位置2／位置1を3サイクル
- 画面スリープ、ホーム、別アプリ往復を各3サイクル
- `resume-required`表示時に1回のgestureで復旧
- sound OFF／ONを繰り返さずテンプ音が復旧

証跡は
`docs/evidence/final-stabilization-phase3b4c-r2-1-audio-recovery/`
に保存する。
