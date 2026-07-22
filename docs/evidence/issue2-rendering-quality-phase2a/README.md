# Issue #2 レンダリング品質 Phase 2A 証跡

## 判定

このフォルダは、v3.13.0既定表示、Phase 1 Candidate C、スタジオ照明Candidate D1/D2/D3を固定条件で比較する証跡である。D候補は`issue2Candidate`クエリでだけ有効になり、既定描画へ統合していない。

| 対象 | Phase 2A判定 | 理由 |
| --- | --- | --- |
| Baseline | 既定表示を維持 | 本PRの通常アクセスは変更なし |
| Candidate C | 不採用 | 物理iPhoneで明るさは概ね問題なかったが、光源色差と硬い・局所的な見え方が受入不可 |
| Candidate D1 | 不採用 | IBL単独ではdesktopの既存表裏輝度ガードを満たさず、安定した基礎照度が不足した |
| Candidate D2 | 未採用／実機確認待ち | PMREMと大型面光源の柔らかい比較候補 |
| Candidate D3 | Phase 2B推奨／未採用 | D2に弱い接触影だけを追加。物理iPhone Safari確認前には確定しない |

## 固定条件と規模

- 時刻10:10:30、停止、構造透過100%、非分解、表裏分離なし、パネル閉状態
- 4テーマ：navy、obsidian、walnut、gallery
- 5視点：front、back、side、winding、motion-works
- 4 viewport：1280×720、1440×900、390×844、393×852
- 5対象：Baseline、C、D1、D2、D3
- master capture：400枚
- 5候補比較board：80枚
- ハイライト・材質・接触部crop board：32枚

候補間の各組ではカメラ位置・Quaternion・target、device pixel ratio、描画pixel ratioが一致することを生成時に検証する。撮影元PNGは一時領域に置き、コミットするJPEG masterと比較boardには条件を自己記述するファイル名を使用する。

## 主比較

- [navy・正面・1280×720](comparisons/1280x720/navy/five-candidate-navy-front-1280x720.jpg)
- [gallery・裏面・1280×720](comparisons/1280x720/gallery/five-candidate-gallery-back-1280x720.jpg)
- [navy・巻上げ・390×844](comparisons/390x844/navy/five-candidate-navy-winding-390x844.jpg)
- [gallery・日の裏輪列・393×852](comparisons/393x852/gallery/five-candidate-gallery-motion-works-393x852.jpg)
- [ハイライトcrop・1280×720](crops/1280x720/five-candidate-highlight-gallery-side-1280x720.jpg)
- [黄銅crop・390×844](crops/390x844/five-candidate-brass-navy-winding-390x844.jpg)
- [鋼crop・1280×720](crops/1280x720/five-candidate-steel-gallery-back-1280x720.jpg)
- [ルビーcrop・390×844](crops/390x844/five-candidate-ruby-obsidian-back-390x844.jpg)
- [針―文字板接触部・1280×720](crops/1280x720/five-candidate-hand-dial-contact-navy-front-1280x720.jpg)
- [歯車―受接触部・393×852](crops/393x852/five-candidate-gear-bridge-contact-navy-back-393x852.jpg)
- [スタジオ構成図](studio-lighting-layout.svg)

## 機械可読レポート

| パス | 内容 |
| --- | --- |
| `capture-matrix.json` | 400条件、クエリ、カメラ、DPR、mask付きframebuffer値、master画像パス |
| `reports/framebuffer/summary.json` | 平均輝度、暗部率、クリップ率の400行と候補別集約 |
| `reports/lighting/all-lights.json` | 5対象の全ライト、PMREM、legacy light状態、選択用補助ライト |
| `reports/point-light/diagnostics.json` | 4 viewport×5視点のPointLight距離・減衰・画面寄与20条件 |
| `reports/performance/summary.json` | 固定30条件とD3運転中の補足6条件、各10秒の計36条件 |
| `reports/browser-report.json` | Node、desktop/mobile、UI、HUD、描画品質、A.7の全回帰 |
| `evidence-manifest.json` | 全証跡のbyte数、SHA-256、MIME、画像寸法 |

`browser-report.json`のD3 desktop／390×844には、停止idle、停止中12時間ジャンプ、りゅうず遷移、位置2で無変位の`running=true`、Live Syncに対するtransform-driven影更新回数も含む。

## 再生成と検証

```text
python3 -m pip install -r scripts/requirements-evidence.txt
python3 scripts/generate_issue2_phase2a_evidence.py
python3 scripts/generate_issue2_phase2a_evidence.py --check
```

証跡生成だけが使用するPillowは`scripts/requirements-evidence.txt`へ固定し、アプリ本体の依存には含めない。生成時はcaptureの400組、固定クエリ、カメラ・DPR一致、必須JSON件数、master／board／crop件数を検証し、生成ディレクトリを明示的に作り直す。`--check`はmanifestと実フォルダを閉世界で照合し、未掲載・残存ファイル、hash／MIME／寸法差、JSON／SVG不正を失敗にする。

## 実機確認ゲート

D1を不採用の参照としてD2/D3と同じ物理iPhone Safariで開き、4テーマ・5視点、黒潰れ、白飛び、反射帯、接触影、黄銅／鋼／ルビー、選択ハイライトを比較する。採否ゲートはD2/D3であり、Phase 2Aの自動検査passは方式の採用または画質完成を意味しない。
