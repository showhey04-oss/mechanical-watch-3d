# Phase 3B.4c-R2.4.2 Native Safari and Physical iPhone Acceptance Evidence

固定Head `0e260fdfc7495293319682ae7b998858641cdd26` に対するNative Safari production validationと、iPhone 16／iOS 26.5.2／SafariでのHuman acceptanceを記録する閉鎖証跡である。

## 判定

- Native Safari session／production profile／actual Web Audio／trusted gesture: PASS
- 物理iPhone: PASS
- foreground自動復帰: 6/6
- fallback tap: 0
- 緑ONのまま無音: 再現なし
- duplicate／burst／視覚的slowdown: なし
- 状態: `PHASE3B4C_R2_4_2_HUMAN_ACCEPTED`
- 次の状態: `PHASE3B4C_R2_4_2_READY_FOR_FINAL_PR_REVIEW`

`READY_FOR_FINAL_PR_REVIEW`はPRのReady化またはマージの許可ではない。PR #26はOpen／Draftを維持する。

## ファイル

- `reports/decision-summary.json`: 総合判断、保護範囲、権限状態
- `reports/human-acceptance.json`: 物理iPhone人間確認の構造化結果
- `reports/video-manifest.json`: 外部動画4本の同一性情報
- `reports/evidence-manifest.json`: 自己参照を除くclosed-world manifest

## 動画の扱い

4本のMP4バイナリはリポジトリへcommitしない。ファイル名、実測byte数、MP4 duration、SHA-256をmanifestへ記録し、ローカル実体との一致を確認した。動画は補助証跡であり、音響合格の正式根拠はHumanの直接聴取結果である。

## 不変範囲

既存のR2.4.2 production／diagnostic profile証跡は再生成せず不変に保つ。製品コード、音源、timeout、APP_VERSION、Geometry、描画、入力、UI、試験閾値は変更しない。
