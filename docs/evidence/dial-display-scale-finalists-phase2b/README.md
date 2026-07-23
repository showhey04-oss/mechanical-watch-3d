# Phase 2B S92／S86 finalist 人間確認

## 結論

人間確認の結果、S86を `SELECTED_FOR_IMPLEMENTATION`、S92を `RETAINED_ALTERNATIVE`、S100とS80を `REJECTED` とする。S86は実装対象に選定されたが、mainへはまだ `ADOPTED` ではない。PR #9は候補値、query resolver、Geometry、既定表示を変更しない比較履歴としてDraftのまま保持し、実装はmain起点の専用PRで行う。

## 固定commit確認URL

確認commitは `6d30c20de32c84296818393451e4094e6270babf`。URLはcommit SHAを含むimmutableなraw.githack配信を使用する。

| 候補 | 10:10:30 | 03:00:00 | 06:30:00 |
|---|---|---|---|
| S92 | [開く](https://raw.githack.com/showhey04-oss/mechanical-watch-3d/6d30c20de32c84296818393451e4094e6270babf/index.html?dialDisplayScale=s92&theme=navy&camera=reset&time=10%3A10%3A30&paused=1&opacity=1&panel=collapsed) | [開く](https://raw.githack.com/showhey04-oss/mechanical-watch-3d/6d30c20de32c84296818393451e4094e6270babf/index.html?dialDisplayScale=s92&theme=navy&camera=reset&time=03%3A00%3A00&paused=1&opacity=1&panel=collapsed) | [開く](https://raw.githack.com/showhey04-oss/mechanical-watch-3d/6d30c20de32c84296818393451e4094e6270babf/index.html?dialDisplayScale=s92&theme=navy&camera=reset&time=06%3A30%3A00&paused=1&opacity=1&panel=collapsed) |
| S86 | [開く](https://raw.githack.com/showhey04-oss/mechanical-watch-3d/6d30c20de32c84296818393451e4094e6270babf/index.html?dialDisplayScale=s86&theme=navy&camera=reset&time=10%3A10%3A30&paused=1&opacity=1&panel=collapsed) | [開く](https://raw.githack.com/showhey04-oss/mechanical-watch-3d/6d30c20de32c84296818393451e4094e6270babf/index.html?dialDisplayScale=s86&theme=navy&camera=reset&time=03%3A00%3A00&paused=1&opacity=1&panel=collapsed) | [開く](https://raw.githack.com/showhey04-oss/mechanical-watch-3d/6d30c20de32c84296818393451e4094e6270babf/index.html?dialDisplayScale=s86&theme=navy&camera=reset&time=06%3A30%3A00&paused=1&opacity=1&panel=collapsed) |

固定状態はpaused、navy、front、opacity 100%、non-exploded、non-split、panel collapsed、audio OFF。初回表示ではCDN読込完了まで待ってから比較する。

## Finalist計測値

| 候補 | dial ring径 | index円径 | 分針長 | 時針長 | 地板外周露出面積比 | 小秒円―主中心余白 |
|---|---:|---:|---:|---:|---:|---:|
| S92 | 29.624 | 27.232 | 12.880 | 9.200 | 34.49% | 0.661266 |
| S86 | 27.692 | 25.456 | 12.040 | 8.600 | 42.75% | 0.931266 |

S86の選定値は、dial ring径 `27.692`、index円径 `25.456`、分針長 `12.040`、時針長 `8.600`、小秒表示円径 `7.740`、小秒針長 `3.268` である。選定は内部機構、小秒中心、四番車軸、Y方向配置を変更しない。

## 比較ボード

- [`images/finalist-s92-s86-desktop-1010.jpg`](images/finalist-s92-s86-desktop-1010.jpg): 1280×720のS92／S86、10:10:30
- [`images/finalist-s92-s86-mobile-390-1010.jpg`](images/finalist-s92-s86-mobile-390-1010.jpg): 390×844のS92／S86、10:10:30

両ボードは同一のpaused／navy／front／opacity 100%条件で、dial ring径、index円径、分針／時針長、地板外周露出面積比、小秒円―主中心余白を併記する。

## 物理iPhone確認項目

- 小秒針の識別性
- 文字板表示系と内部機構の主従関係
- 10:10、03:00、06:30での針長

人間確認は完了し、S86を実装対象として選定した。mainへ未マージのため `ADOPTED` にはせず、Phase 2Cは開始しない。S92は代替候補として記録し、S100とS80は却下履歴として保持する。

## 閉世界証跡

`review-links.json`に確認commit、6 URL、finalist値、除外理由、物理iPhone確認項目を保存する。`evidence-manifest.json`自身を除く本ディレクトリ内の全ファイルについてbytesとSHA-256を記録し、missing／unexpectedを0件とする。
