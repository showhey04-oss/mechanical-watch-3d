# Issue #2 Final Polish Phase 3B.4b — iOS Multi-Touch Gesture Stability

## 結論

Phase 3B.4bでは、完成外装、D2c3、Phase 3B.4a framingを維持したまま、iOS相当のPointer Events lifecycleだけをquery限定で監査・補強した。

自動技術ゲートは合格したが、物理iPhoneで必要なA／B／C各5分および候補Cの連続15分確認は未実施である。したがって正式判定は次とする。

`STOPPED_PHYSICAL_IPHONE_REPRODUCTION_INCONCLUSIVE`

候補を既定採用せず、Ready化、マージ、Issue #2のクローズは行わない。

## Query

完成外装queryへ次のいずれかを追加する。

- 診断: `input=issue2-ios-multitouch-diagnostics`
- 修正候補: `input=issue2-ios-multitouch-stability`

完成外装、`rendering=issue2-d2c3`、`continuity=issue2-current`が揃わない場合は無効である。`framing`は省略、または`issue2-mobile-full-length-fit`だけを許可する。`input`を省略した既存pathは変更しない。

## Stage 0コード監査

現行入力はThree.js r160のArcballControlsとPointer Eventsを使用し、canvasの`touch-action`は既に`none`である。アプリ側はactive pointerを`Set`で保持し、ArcballControlsはtouch配列、click履歴、動的window listener、入力状態を内部保持する。

候補前の監査で次を確認した。

- `lostpointercapture`後の遅延したstale-state確認がない
- `pointercancel`時にArcballの動的listenerとclick履歴が残り得る
- アプリ側にblur、visibility、page lifecycleの一括cleanupがない
- 二本指から一本指へ戻った際、旧二本指基準を捨てて一本指基準を即時再初期化しない
- pointer ID再利用時のstale-state guardがない

実ブラウザのsynthetic sequenceでは、stale reset後にArcballのdouble-tap click履歴が残ると、次のtapで未定義pointerを距離計算へ渡し得る経路を再現した。これはコード上の実在する欠陥である。ただし、物理iPhoneで2〜3分後に報告された劣化の原因と同一であることは未確認である。

原因分類は次とする。

`LIKELY_STALE_ARCBALL_AND_APPLICATION_POINTER_LIFECYCLE_STATE`

`rootCauseConfirmedOnPhysicalDevice=false`

## 実装

候補query時だけ、既存ArcballControlsのbound pointer handlerをevent-driven wrapperで補強する。

- pointerup／pointercancel／真のlostpointercaptureで対象pointerを除去
- normal release直後のlostpointercaptureをmicrotaskで区別
- pointer ID再利用時に古い状態を破棄
- window blur、visibility hidden、pagehide、pageshowで入力状態をreset
- 二本指から一本指への遷移で旧centroid／pinch／angleを破棄し、残ったpointerから一本指gestureを再初期化
- Arcballのtouch配列、click履歴、動的listener、入力状態、captureをcleanup
- capture中のpointerだけを安全にrelease

毎frame reset、timer reset、pointermove間引きは追加していない。camera sensitivity、damping、zoom／rotation速度、target、FOV、maxDistanceも変更していない。

## 自動入力結果

Desktop 1280×720で24 cycle、Mobile 390×844で60 cycleのone-to-two-to-one sequenceを実行した。

- pointercancel後idle: 100%
- lostpointercapture後idle: 100%
- pointer ID再利用衝突: 0
- blur／visibility／pagehide／pageshow後idle: 合格
- gesture終了後active pointer: 0
- capture残留: 0
- stale pointer age超過: 0
- desired／actual camera state: finite
- model transform invariant: true
- `設定車2`選択、HUD／学習同期、空白解除: 合格

ログにはpointer情報、active pointer、capture、gesture mode、centroid、pinch、angle、desired／actual camera、visibility／focus、reset count／reasonをイベント単位で保存した。per-frame診断は0である。

## A／B／C比較

in-app Browserの短時間自動試験では、A、B、Cすべてが合格した。

- A: D2c3、framingなし、診断input
- B: D2c3、framingあり、診断input
- C: D2c3、framingあり、修正input

短時間自動試験は物理iPhoneで報告された2〜3分後の劣化を分類できないため、framing固有性は`INCONCLUSIVE_WITHOUT_A_B_PHYSICAL_RUNS`とする。

## 性能

同一in-app BrowserでDesktop／390×844、current／candidateをidle、pointer、wheel各3反復し中央値を比較した。6比較すべてで平均fps悪化5%以内、p95悪化2ms以内に合格した。

- requestAnimationFrame数変更: なし
- camera update数変更: なし
- bounds計算数変更: なし
- Light／draw-call契約変更: なし
- audio scheduler変更: なし
- per-frame診断: 0

A.6絶対性能はin-app Browser環境の既知制約を受けるため、絶対合格とは記載しない。

## 回帰

- Node: 294/294
- Desktop comprehensive: 81/86
- Mobile 390×844 comprehensive: 83/88
- UI: 合格
- HUD: 合格
- trusted audio: 合格
- S86 runtime-to-saved: 5/5
- A.7: 9/9
- 禁止干渉: 位置1 0／位置2 0
- application console error／warning: 0／0
- candidate-specific regression: 0
- test threshold変更: なし

Desktop／Mobileに共通する5件は、D2c3の既知A.5 lighting contract差とin-app BrowserのA.6絶対性能であり、候補固有ではない。

## Protected path

Part A完了commit `ece9d99c4e0ff95afd155475ef963e2984c5d05f`と比較した。

初期front、最大距離front／back／side、opacity 16%、初期復帰の6条件はPNG byte／SHA-256 exactである。selected captureはBase自身でも時間位相によりSHAが変動するためpixel exact判定外とし、選択対象、camera、transformの機能一致を確認した。

`input` queryなしでは製品Object追加0で、D2c3 current、D2c3＋framing current、Shadow-off、Phase 3C.1〜3C.3、Phase 3A〜3B.4aを維持する。

## 物理iPhone確認

Codex実行環境には物理iPhoneがないため未実施である。自動試験を代替としない。

必要な確認:

1. A、B、Cを各5分以上
2. Cを連続15分
3. 一／二本指遷移、pinch、pan、rotation、画面端、素早いrelease
4. 最大／最小距離、preset、split／explode／restore
5. 選択、HUD／学習同期、空白解除
6. active pointer leak、unexpected jump、manual reload、WebGL loss、console

物理確認完了まで`IOS_MULTITOUCH_STABILITY_TECHNICAL_FINALIST`または人間合格とはしない。

## 未変更・保留

- D2c3、framing、fog、RectAreaLight、PMREM
- Geometry、Material、shadow、透過処理
- camera FOV、target、near／far、damping、sensitivity、maxDistance
- UI、HUD、selection priority
- audio、beat phase、scheduler、background clock
- APP_VERSION、試験閾値
- 100%／99%、55%／54%、OIT
- iOS音響ペーシング
- 時分針中央干渉、ミニッツホイール軸表出

Issue #2はOpen、PR #5はOpen／Draftを維持する。
