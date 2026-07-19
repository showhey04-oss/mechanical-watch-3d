[gear-train-refactor.md](https://github.com/user-attachments/files/30159395/gear-train-refactor.md)
---
name: Gear train and keyless works refactor
about: Refactor gear geometry, axial layers, motion states, and stem connection
title: "Refactor: gear train and keyless works"
labels: ""
assignees: ""
---

## 目的

輪列・日の裏輪列・キーレスワークをパラメトリックに再構成する。

## 対象

- ピッチ半径、歯先円、歯底円、歯数、厚さ
- 車／かなの高さ面
- ピッチ半径からの中心距離計算
- 状態別の回転管理
- 巻真軸系
- パレット石周辺の干渉

## 受入条件

`docs/ACCEPTANCE_TESTS.md` を満たすこと。

## 参照

- `docs/CODEX_HANDOFF.md`
- `docs/CODEX_REQUEST.md`
