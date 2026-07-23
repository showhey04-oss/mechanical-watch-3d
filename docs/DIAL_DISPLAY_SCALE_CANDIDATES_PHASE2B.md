# Phase 2B 文字板表示系 縮小率候補比較

## 1. 結論

Phase 2AのH2到達比率を基準に、文字板表示系だけを同率縮小するS100、S92、S86、S80をquery限定で比較した。通常アクセス、`dialDisplayScale`なし、無効値はmain `e9a223e1ec2b5d966354c73b7719ae81a14f50fa` と同じ表示へ戻り、1280×720の通常アクセスはmainとpixel exactである。

Phase 2Bでは候補を既定採用しない。自動計測と同一条件画像による暫定分類を経て、人間確認の結果、S86を `SELECTED_FOR_IMPLEMENTATION`、S92を `RETAINED_ALTERNATIVE`、S100とS80を `REJECTED` と記録する。S86は実装対象として選定されたが、mainへはまだ `ADOPTED` ではない。比較用queryを含む本PR #9はDraftの比較履歴として保持し、実装はmainから独立した専用PRで行う。

## 2. 実装境界とquery競合

- query: `?dialDisplayScale=s100|s92|s86|s80`
- queryなし／無効値: main相当のH0表示
- 適用先: dial ring半径、index配置半径、マーカー径方向長、時針・分針長、小秒円半径、小秒針長のGeometry生成値
- 固定: 針pivot、position、rotation、scale、小秒中心、四番車軸、Y座標、線幅、厚さ、材質、機構、カメラ、照明、UI、音響
- 診断: `getDialDisplayScaleDiagnostics()`
- 自動統合: `?dialDisplayScaleTest=1`
- 注記図: `?dialDisplayScaleOverlay=movement|smallSeconds|area`

`dialHandCandidate`と`dialDisplayScale`を同時指定した場合は、`dialDisplayScale`を優先する。有効な表示候補はPhase 2A hand queryを抑止し、無効な表示queryもPhase 2A hand queryを抑止してmain相当H0へ戻る。これにより、二つの候補系を合成した未定義Geometryを生成しない。

通常モデル定義の `dialRingDiameter: 32.2`、`indexCircleDiameter: 29.6`、時針・分針・小秒針長は変更していない。resolverはページ生成時にGeometry引数へ一度だけ適用され、animation loop、状態復元、カメラ処理へ入らない。

## 3. 候補と計測

ムーブメント基準径は36.6、半径18.3、小秒中心半径は5.601266とする。

| 候補 | ring／movement | index／movement | 外周余白 | plate露出面積比 | 分針／index半径 | 時針／index半径 | 時針／分針 | 小秒円―ring最小余白 | 小秒円―主中心最小余白 | 判定 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| S100 | 0.879781 | 0.808743 | 2.200 | 22.60% | 0.945946 | 0.675676 | 0.714286 | 5.998734 | 0.301266 | `REJECTED` |
| S92 | 0.809399 | 0.744044 | 3.488 | 34.49% | 0.945946 | 0.675676 | 0.714286 | 5.070734 | 0.661266 | `RETAINED_ALTERNATIVE` |
| S86 | 0.756612 | 0.695519 | 4.454 | 42.75% | 0.945946 | 0.675676 | 0.714286 | 4.374734 | 0.931266 | `SELECTED_FOR_IMPLEMENTATION` |
| S80 | 0.703825 | 0.646995 | 5.420 | 50.46% | 0.945946 | 0.675676 | 0.714286 | 3.678734 | 1.201266 | `REJECTED` |

4候補とも時針・分針はdial ring内、小秒針は小秒円内で、マーカー干渉は0件だった。小秒中心と四番車軸の距離は全条件で0、3針の角度誤差と取付中心距離も0だった。

S92は表示系とムーブメント外周の区別を増やしつつ、小秒円の主中心側余白とdial ring側余白を残す。S86は外周露出をさらに増やすため保持候補とする。S80はplate露出面積が50%を超え、表示系がムーブメントに対して小さく見えるリスクから自動分類を `REJECT` とした。

### 人間確認後の選定

| 候補 | 最終比較 | 理由 |
|---|---|---|
| S100 | `REJECTED` | scale 1.00で縮小目的を満たさない |
| S92 | `RETAINED_ALTERNATIVE` | 実装候補S86に対する比較可能な代替として履歴に残す |
| S86 | `SELECTED_FOR_IMPLEMENTATION` | 人間確認で選定。mainへは未採用で、main起点の実装専用Draft PRで反映する |
| S80 | `REJECTED` | 表示系を縮小しすぎる |

S86の選定値は、dial ring径 `27.692`、index円径 `25.456`、分針長 `12.040`、時針長 `8.600`、小秒表示円径 `7.740`、小秒針長 `3.268` である。内部機構、小秒中心、四番車軸、Y方向配置は変更しない。S86の `ADOPTED` はmainへマージされた後にだけ用いる。

この整理は比較PR内の候補値、query resolver、Geometry、自動判定語彙を変更しない。S100／S80の既存JSONと4候補証跡は監査履歴として保持し、実装専用PRが作成されるまでPR #9をDraftの比較履歴として維持する。

## 4. 固定比較

次の48条件を全数計測した。

- viewport: 1280×720、390×844、393×852、375×667
- 時刻: 10:10:30、03:00:00、06:30:00
- 候補: S100、S92、S86、S80
- 状態: paused、navy、front、構造透過100%、非分解、表裏分離なし、パネル閉、作動音OFF

48/48で有限Geometry、dial ring突出0、マーカー干渉0、小秒軸一致、3針拘束、transform・camera・機構状態不変を満たした。

全48条件の最小screen-space線幅は分針2.424330 px、時針3.342986 px、小秒針0.808061 pxだった。線幅は候補間で固定されており、時針・分針は全条件で先端を識別できた。小秒針はモバイルで1px未満となるため、赤色コントラストと先端識別性を物理iPhoneで人間確認する。エミュレート結果だけで視認性を採用判定しない。

## 5. 回帰

- Node: 66/66
- desktop総合: 86/86
- 390×844総合: DPR2固定viewportハーネス 88/88
- PR #3 UI: desktop 20/20、390×844 22/22、375×667 22/22
- PR #4 HUD: 390×844、393×852、375×667 各57/57
- v3.14音声: desktop、390×844 各23/23
- A.7: 9/9
- 位置1／位置2禁止干渉: 0/0
- Phase 1寸法監査: 11/11、schemaVersion 2
- Phase 2A: H0〜H3各12/12
- Phase 2B: S100〜S80各15/15
- 通常アクセスmain比較: pixel exact

DPR1の補助試行は既知のウォールナット採取数が995で閾値 `>1000` に届かず87/88だったが、全テーマの表裏輝度差は30%以内だった。閾値を変更せず、DPR2固定viewportハーネスで1738／6727サンプルを取得し88/88を確認した。補助試行は合格結果へ数えない。

## 6. 性能

1280×720、front、opacity-idle、10秒のクリーン単独タブ計測:

| 対象 | fps | p50 | p95 | p99 | >33 ms | >50 ms | long task |
|---|---:|---:|---:|---:|---:|---:|---:|
| 通常表示 | 59.91 | 16.70 | 17.90 | 18.40 | 0 | 0 | 0 |
| query S92 | 59.89 | 16.70 | 17.90 | 18.50 | 0 | 0 | 0 |

比較ボードの複数WebGL iframeを開いたまま実行した汚染計測は約9.19fpsだったため除外し、全証跡タブを閉じて再計測した。両クリーン計測でモデルtransformは不変だった。

## 7. 保護した範囲

内部機構の寸法・座標、歯数、モジュール、軸中心、Y層、針の1:1拘束、カメラ、照明、影、透過、材質、UI、作動音は変更していない。PR #5、Issue #2、D2c3も変更していない。Phase 2Cおよび既定化実装は開始していない。

## 8. 証跡と人間確認ゲート

比較画像、注記図、候補別12条件JSON、回帰、性能、pixel比較、closed-world manifestは [`docs/evidence/dial-display-scale-candidates-phase2b/README.md`](evidence/dial-display-scale-candidates-phase2b/README.md) にまとめた。

S92／S86のfinalist比較ボードと固定commit確認URLは [`docs/evidence/dial-display-scale-finalists-phase2b/README.md`](evidence/dial-display-scale-finalists-phase2b/README.md) に分離した。

S92／S86は自動採用しなかった。desktopと物理iPhoneの人間確認によりS86を実装対象に選定した。S86はmainへ未マージであり、`ADOPTED` ではない。以下の確認項目とfinalist証跡は選定根拠として保持する。

- 外周露出量と文字板表示系の視覚バランス
- 小秒針の識別性
- 文字板表示系と内部機構の主従関係
- 10:10、03:00、06:30での針長
- 小秒円と主中心の間隔
