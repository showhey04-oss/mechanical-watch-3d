# ChatGPTプロジェクト引き継ぎ

## プロジェクト名

Mechanical Watch 3D｜設計・開発

## プロジェクトの目的

ブラウザ上で操作できる教育用の機械式時計3Dモデルを開発する。

## 正本

GitHubリポジトリ `mechanical-watch-3d` をソースコードの正本とする。

## ChatGPT側の役割

- 開発方針の決定
- 機構・UI仕様の整理
- スクリーンショットレビュー
- Codexタスクの作成
- PR差分と受入条件の確認
- ステージ移行判断

## Codex側の役割

- コード解析
- 構造改修
- 回帰防止
- GitHubブランチとPRでの実装
- 検証結果の記録

## 現在地

v3.6.4まで完成。  
次は輪列・キーレスワーク・脱進機周辺の構造改修を行う。

## 最優先課題

- 歯車噛合いのパラメトリック化
- 入石・出石周辺の干渉解消
- 状態別の動作整理
- 巻真軸系の一体化

## 参照資料

- `docs/PROJECT_OVERVIEW.md`
- `docs/ROADMAP.md`
- `docs/ACCEPTANCE_TESTS.md`
- `docs/CODEX_HANDOFF.md`
- `docs/CODEX_REQUEST.md`
