# Post-Freeze Public UI Copy Polish

## 結論

Mechanical Watch 3D v3.15.0の公開UIから開発工程向け文言を除去し、選択部品、りゅうず操作、部品説明、メニュー説明を完成版向けに整理する。これは`prototype/final`後の限定的なeditorial correctionであり、機能開発の再開ではない。

## 基準

- 開始main／`prototype/final` peeled commit: `15567d8d9fa5c2f2af8254d12ec31e8a21c5d49f`
- branch: `fix/post-freeze-public-ui-copy-polish`
- APP_VERSION: `v3.15.0`
- 対象route: default root、`?defaultProfile=legacy`
- viewport: Desktop 1280×720、Mobile 390×844

## 実装

- 固定見出し「選択部品情報」と接頭辞「選択部品：」を削除した。選択時は公開名そのものをHUDと学習タブの見出しにする
- 未選択時は空見出しを隠し、「部品を選択すると説明を表示します。」だけを表示する
- 利用者向けのりゅうず表記を「巻上げ」「時刻合わせ」へ統一し、ボタン、状態、ヘルプ、ARIAを同期した
- `getPublicPartName()`と`getPublicPartDescription()`を表示境界に置き、内部`partName`、選択ID、機構状態を保持したまま公開名と説明だけを整える
- 既に簡潔な説明は維持し、開発履歴・実装用語を含む説明だけを1～2文へ整理した

## 保護範囲

Geometry、輪列中心、部品寸法、機構配置、外装寸法、Material、Light、Shadow、透過、fog、DPR、camera、Raycaster、split、explode、section clip、りゅうず機構、巻上げ、時刻合わせ、秒停止、音響、mobile panel、既存query route、APP_VERSIONは変更しない。

内部ID変更は0件、挙動変更は0件である。`prototype/final` annotated tagは変更しない。

## 検証契約

- Node全件、fail／skip／todo 0
- default／legacyのDesktop・Mobileで開発工程文言0、可視文言／ARIA不一致0、horizontal overflow 0
- 未選択、りゅうず、歯車、テンプの選択とHUD／学習同期
- 操作／学習／技術タブ、panel開閉、巻上げ、時刻合わせ、現在時刻設定
- console error／warning、runtime error、unhandled rejection 0
- evidence manifest missing／unexpected／SHA mismatch 0

## 検証結果

- Node: 507／507合格、fail 0、skip 0、todo 0
- Installed Chrome: default／legacy、Desktop 1280×720／Mobile 390×844で合格
- 公開画面の開発工程文言0、可視文言／ARIA不一致0、horizontal overflow 0
- 未選択、りゅうず、歯車、テンプでHUD／学習タブ同期を確認
- 操作／学習／技術タブ、panel開閉、巻上げ、時刻合わせ、時刻入力を確認
- console error／warning、runtime error、unhandled rejection 0
- evidence manifest missing／unexpected／SHA mismatch 0

物理iPhoneは自動検証後の固定commit URLで、表示文言、bottom sheet、選択同期、時刻入力、りゅうず操作だけを人間確認する。長時間、音響、Geometryの再試験は対象外とする。
