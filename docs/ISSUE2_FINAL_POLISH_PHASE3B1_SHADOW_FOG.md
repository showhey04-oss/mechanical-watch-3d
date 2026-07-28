# Issue #2 Final Polish Phase 3B.1 — baseline-preserving shadow / fog

## 結論

- 状態: `ISSUE2_PHASE3B1_NO_TECHNICAL_FINALIST`
- Stage 1: 完了
- Stage 2: `SKIPPED_ZERO_TECHNICAL_GATE_CANDIDATES`
- PC人間比較候補: 0件
- 物理iPhone: 未実施
- 通常表示への採用: なし
- APP_VERSION: `v3.15.0`

Phase 3C.3完成時計のbaselineを保護し、既存DirectionalLightのshadow carrier、固定shadow camera fit、fog 160／260を単独または単純合成した6候補をquery限定で比較した。性能差分は全候補で合格したが、矩形影、前後面バランス、fog visibilityの全ゲートを同時に満たす候補はなかった。したがってStage 2の重要条件直積と物理iPhone確認へ進めず、候補を既定採用しない。

## query境界

共通完成外装queryへ、次の`rendering`だけを追加する。

```text
?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3&rendering=issue2-phase3b1-baseline
?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3&rendering=issue2-shadow-off
?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3&rendering=issue2-shadow-fit
?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3&rendering=issue2-fog-only
?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3&rendering=issue2-shadow-off-fog
?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3&rendering=issue2-shadow-fit-fog
```

queryなし、Phase 3C.1-only、Phase 3C.2-only、Phase 3C.3-only、Phase 3A baseline／D2a／D2c3の7 pathは、1280×720／390×844の14条件で比較元とPNG byte・SHA-256が一致した。

## 候補と判定

| 候補 | 差分 | 判定 |
| --- | --- | --- |
| baseline | Phase 3C.3の照明、影、fogを無変更 | `RETAINED_DIAGNOSTIC_ONLY` |
| shadow-off | `frontKey.castShadow=false`だけ | `REJECTED_FRONT_BACK_BALANCE` |
| shadow-fit | 既存512² shadow mapの固定orthographic boundsだけを拡張 | `REJECTED_SHADOW_ARTIFACT` |
| fog-only | fog near／farを160／260だけへ変更 | `REJECTED_FOG_VISIBILITY` |
| shadow-off-fog | shadow-offとfog-onlyの単純合成 | `REJECTED_FRONT_BACK_BALANCE` |
| shadow-fit-fog | shadow-fitとfog-onlyの単純合成 | `REJECTED_SHADOW_ARTIFACT` |

RectAreaLight、新規light、PMREM置換、light強度・色・位置、tone mapping、exposure、Material、alphaHash、影対象、transparent、depthWrite、DPR、camera基盤は変更していない。

## shadow camera

完成時計のnormal、full-length、split最大、explode最大、split＋explode最大を一時的に測定し、全Object3D transformを復元した。world-space unionは次のとおり。

- min: `[-25.800, -28.985, -92.671776]`
- max: `[35.375, 78.095528, 86.620918]`
- size: `[61.175, 107.080528, 179.292694]`

既存DirectionalLightのlight-space boundsへ4 model unitのmarginを加えた固定shadow cameraは次の値になった。

- left／right: `-76.612551 / 87.903065`
- bottom／top: `-90.973230 / 123.224734`
- near／far: `0.100000 / 167.078310`
- map size: `512 × 512`（変更なし）
- bias／normalBias: `0 / 0`（変更なし）
- 初期化時refresh: 1回
- per-frame更新: 0

投影境界は全5状態で時計外へ出たが、512²のまま広い範囲へ割り当てたためopacity 16%のcanonical cropで斜め勾配量がbaseline比Desktop 1.700倍、Mobile 1.958倍になり、縞状の影解像度劣化を生じた。mapSize変更は禁止条件なのでshadow-fitを不合格とした。

shadow-offは矩形影carrierを無効化し、実効projection boundary intersectionを0にした。ただし前後面バランスを維持できなかった。

## 前後面バランス

navy／obsidianのopacity 100%、front／movement backにおけるsilhouette平均輝度を比較した。合格条件は相対差0.30以下かつbaseline比の絶対悪化+0.05以下である。

| 候補 | Desktop 最大相対差 | Desktop 最大悪化 | Mobile 最大相対差 | Mobile 最大悪化 |
| --- | ---: | ---: | ---: | ---: |
| baseline | 0.219927 | 0 | 0.210524 | 0 |
| shadow-off | 0.261149 | +0.081097 | 0.249427 | +0.038903 |
| shadow-fit | 0.477175 | +0.298524 | 0.294192 | +0.083668 |
| fog-only | 0.219927 | 0 | 0.177791 | -0.032734 |
| shadow-off-fog | 0.261149 | +0.081097 | 0.253052 | +0.042528 |
| shadow-fit-fog | 0.477175 | +0.298524 | 0.494129 | +0.342033 |

shadow-off系はDesktopのbaseline比悪化が+0.081097となり、許容+0.05を超えた。shadow-fit系は絶対差も不合格である。

## fog

fog 160／260によりDesktopのfull-length／farは4themeすべてnon-flatになった。一方、390×844のfarはnavy／obsidian／walnut／galleryの4条件すべてflat判定のままで、mobile full-length／farゲートを満たさない。near clipped ratioはbaseline+0.01以内を維持した。したがってfog-onlyを`REJECTED_FOG_VISIBILITY`とし、組合せ候補もfogゲート不合格とした。

## 性能

同一in-app Browserで各候補をbaselineと比較した。idle、pointer、wheel、opacity 16%、split、explode、外装OFFの7条件をDesktop／390×844で各10秒測定した。

- 全候補の平均fps最大悪化: 0.2185%
- 全候補のp95最大悪化: 0.300ms
- 許容: 平均fps 5%以内、p95 2ms以内
- reversal: 0
- stop-then-jump: 0
- wheel zoom: monotonic
- transform invariant: true
- shadow refresh: shadow候補だけ初期化時1回
- 試験閾値変更: なし

全候補が性能差分ゲートを満たした。これは絶対A.6閾値の代替ではない。

## Stage 1と回帰

- Stage 1: 6候補 × 2 viewport × 88条件 = 実Three.js WebGL PNG 1056枚
- shadow: 72条件／run
- fog: 16条件／run
- console error／warning: 0
- transform invariant: 全1056条件true
- 位置1／位置2禁止干渉: 全条件0/0
- Node: 225/225
- UI: Desktop 20/20、Mobile 22/22
- HUD: Desktop 45/45、Mobile 57/57
- protected path: 14/14 pixel exact
- performance: 全6候補差分合格

browser総合ではbaselineと複合候補に時計回り表示3件の共通未達がある。DesktopのA.5前後面項目も共通未達で、Mobileでは複合候補だけ同項目が追加失敗した。これは前後面バランスの候補固有悪化として判定へ反映した。音声integrationは実pointer gestureを与えたがbaselineと複合候補の両方で同じwait timeoutとなり、Node音声試験は合格、候補固有失敗は0である。

## 透過処理と後続Geometry

`applyStructuralOpacity`、transparent条件、depthWrite条件、`PICK_OPACITY_THRESHOLD`、selection priority、global Raycaster、`structuralOpacityTargets`は変更していない。100→99%と55→54%の不連続はPhase 3B.2へ分離する。

時針・分針と中央ring状部品の干渉疑い、およびミニッツホイール軸の文字板表出は、[POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md](POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md)へ記録した`FINAL_GEOMETRY_CLEANUP_POST_ISSUE2`で扱う。Phase 3B.1ではGeometryを変更していない。

## 次工程

技術ゲート合格候補が0件のため、Stage 2、PC候補選択、物理iPhone、15分温度確認を実施しない。D2c3は`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`のまま保持する。Issue #2はOpen、PR #5はOpen／Draftを維持し、次の設計判断またはPhase 3B.2透過連続性の独立評価には新たな承認が必要である。
