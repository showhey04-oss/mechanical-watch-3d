# Phase 3A 最終外装インターフェース監査 証跡

## 由来

- source main：`fafd3ae3b9e7224f47320b53c7e635b3bb3b8f58`
- audit logic：`ba62c5497d424152aecd3ea4f8c576d339d12851`（`Add Phase 3A exterior interface audit model`）
- branch：`audit/final-exterior-interface-phase3a`
- app：v3.15.0
- capture mode：same-origin unsandboxed iframe harness — actual Three.js scene rendered to offscreen `WebGLRenderTarget`
- 通常Scene外装Geometry：追加なし
- 推奨候補の既定採用：なし

## 保護アンカー

- movement：36.6
- S86：27.692 / 25.456 / 12.040 / 8.600 / 7.740 / 3.268
- base movement Y：-2.410～4.235 / 6.645
- hand fitting Y：-2.470～0.720 / 3.190
- application Y：-2.510～4.235 / 6.745
- front：negative Y
- back：positive Y
- ETA 4.50 mm：`REFERENCE_DATUM_UNRESOLVED / UNVERIFIED`

## レポート

- `reports/protected-anchors.json`：変更禁止アンカーとPhase 2C照合
- `reports/exterior-interface-map.json`：正面、Y、りゅうず・巻真、装着部の接続条件
- `reports/clearance-budget.json`：半径方向・前後・全厚予算
- `reports/exterior-candidate-matrix.json`：全候補値、式、入力、分類、根拠、リスク、実装依存
- `reports/candidate-comparison.json`：10観点の比較
- `reports/decision-summary.json`：推奨状態と次工程
- `reports/regression-results.json`：Node・ブラウザ・不変条件・画像真正性

## 画像

| ファイル | 寸法 | 生成元 |
|---|---:|---|
| `images/desktop-front-baseline.png` | 1280×720 | 実Three.js scene、front、offscreen WebGLRenderTarget |
| `images/desktop-side-baseline.png` | 1280×720 | 実Three.js scene、side、offscreen WebGLRenderTarget |
| `images/mobile-390-front-baseline.png` | 390×844 | 実Three.js scene、front、offscreen WebGLRenderTarget |
| `images/front-aperture-constraints.png` | 1280×720 | 実desktop front + 実測開口overlay |
| `images/side-clearance-stack.png` | 1280×720 | 実desktop side + Y予算overlay |
| `images/crown-stem-interface.png` | 1280×720 | 実desktop front + A.7軸・移動範囲overlay |
| `images/exterior-candidate-front-comparison.png` | 1280×720 | 実desktop front + 3候補外形overlay |
| `images/exterior-candidate-side-comparison.png` | 1280×720 | 実desktop side + 3候補前後面overlay |

baseline PNGはブラウザ内の24KBチャンクを個別回収して再構成し、ブラウザSHA-256と保存後SHA-256を一致させた。overlay画像はbaselineを入力として生成し、通常Sceneへ線や候補Object3Dを加えていない。

## 候補

| 候補 | case外径 | cavity | aperture | front/rear clearance | 全厚 | 状態 |
|---|---:|---:|---:|---:|---:|---|
| E-COMPACT | 39.000 | 37.300 | 28.200 | 0.350 / 0.350 | 8.945 | `CANDIDATE_NOT_ADOPTED` |
| E-BALANCED | 39.600 | 37.800 | 29.000 | 0.550 / 0.650 | 9.845 | `RECOMMENDED_NOT_ADOPTED` |
| E-EDUCATIONAL | 40.200 | 38.400 | 30.200 | 0.850 / 1.000 | 10.895 | `CANDIDATE_NOT_ADOPTED` |

## 判定

- Phase 3A：監査・候補比較のみ
- 保護アンカー変更：0
- 通常表示外装Geometry：0
- E-BALANCED：`RECOMMENDED_NOT_ADOPTED`
- Phase 3B：人間承認とPRマージ後に開始
- PR #5 / Issue #2 / D2c3：未変更・未採用
