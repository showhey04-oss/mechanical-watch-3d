# Issue #2 Final Polish Phase 3B.1c — Opacity-Coupled Shadow Attenuation

## 結論

正式判定は
`ISSUE2_SHADOW_ROUTE_EXHAUSTED_NO_TECHNICAL_FINALIST`
である。

Stage 0のcaster attributionは完了し、低opacity時の中央矩形境界と
斜め帯を再現する主要caster群を`dial-exterior`へ絞り込んだ。
`customDepthMaterial`と`alphaTest`は0件で、opacity 100%と16%の
shadow depth対象数も同一だった。この結果は
`OPAQUE_SHADOW_DEPTH_FOR_TRANSPARENT_STRUCTURAL_MESHES_SUSPECTED`
を最有力仮説として支持するが、Three.js内部実装の断定には用いない。

opacity連動attenuationは中央矩形境界と広い斜め帯を視認不能な水準へ
低減し、性能差分にも合格した。しかし前後面輝度バランスの
baseline比悪化が上限+0.05を超えた。固定normalBias併用候補も同じ
前後面ゲートに加え、Mobileのexplode／split-explode性能ゲートを
満たさなかった。技術finalistは0件のためStage 2、PC候補比較、
物理iPhone確認、既定採用を実施しない。

## 由来

- main比較基準：`293626f13a50224924f8e3ac229a1fc4077ad7a7`
- stacked base（PR #20判断記録後）：
  `961fb16ec8c0b55b4d940861659e22733537d813`
- 候補実装・監査基盤：
  `8a0fac5149708a906d02df103403f6e0706db9f7`
- APP_VERSION：`v3.15.0`
- 候補はすべて完成外装query限定で、通常pathへは適用しない

## Phase 3B.1bからの引継ぎ

PR #20の正式状態は
`ISSUE2_PHASE3B1B_AUDIT_ACCEPTED_TIGHT_SHADOW_ROUTE_CLOSED`
である。tight 512／1024はprojection boundaryを除去した一方、
広い斜めshadow band、前後面バランス、1024の一部性能を閉鎖できず、
未採用とした。mapSize 2048、shadow camera追加調整、per-frame fitは
行わない。

## Stage 0 caster attribution

Desktop 1280×720とMobile 390×844で、front／dial mechanism、
opacity 16%／8%、normal／split／explodeを、次の5群に分けて
実WebGL PNGで比較した。

- all
- plate＋bridge
- dial＋exterior
- train＋motion＋wind
- escapement＋balance

両viewportで589 Mesh、553 caster、553 receiverを確認した。
`dial-exterior`は241 caster／241 receiverで、構造透過対象135件のうち
106件がcaster／receiverの双方と重複する。`customDepthMaterial`と
`alphaTest`は0件、診断後のcastShadow復元はtrueである。
主要artifactは`dial-exterior`単独でも再現し、他の単独群では
同じ中央境界・斜め帯にならないため、原因診断は`CONCLUSIVE`とした。

## 候補

共通query：

`?exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3`

| 候補 | rendering | 変更 |
|---|---|---|
| baseline | `issue2-phase3b1c-baseline` | Phase 3C.3 baselineを維持 |
| Shadow-off参照 | `issue2-phase3b1c-shadow-off` | frontKey shadow carrierを0、同方向の非shadow補償を1.96 |
| attenuation | `issue2-shadow-attenuation` | smoothstepでcarrierと補償を連続配分 |
| attenuation＋bias | `issue2-shadow-attenuation-bias` | attenuationに固定normalBias 0.009765625を追加 |

追加Lightはquery限定の非shadow DirectionalLight 1灯だけで、frontKeyと
色、位置、target、方向を一致させた。RectAreaLight、PointLight、
SpotLight、camera-attached light、PMREM、fog、tone mapping、
exposure、Material、Geometryは変更していない。

## attenuation curve

構造透過率を`r`とし、次を用いる。

```text
t = clamp((r - 0.08) / (0.80 - 0.08), 0, 1)
shadowWeight = t * t * (3 - 2 * t)
carrier = 1.96 * shadowWeight
compensation = 1.96 * (1 - shadowWeight)
```

全計測点でcarrier＋compensationは1.96、誤差は1e-12以下である。
opacity変更時はLight intensityだけを更新し、shadow refresh、
Material再生成、Geometry再生成、castShadow／receiveShadow切替を
行わない。100／99のtransparent切替と55／54のdepthWrite切替は
既知未解決のまま保護した。

## normalBias

baseline shadow cameraはleft/right/top/bottomが-5/5/5/-5、
mapSizeは512×512である。

- texelX：0.01953125
- texelY：0.01953125
- `0.5 * max(texelX, texelY)`：0.009765625
- bias：0を維持

同一条件boardでは明確なpeter-panningを自動採用根拠にしていない。
この候補は前後面と性能で既に不合格のため、bias sweepは追加しない。

## Stage 1

4候補 × 2 viewport × 2 themeで、各52条件、計832枚の
実Three.js offscreen WebGL PNGを取得した。

- View：front／dial mechanism／side／movement back
- Normal opacity：100／99／75／56／55／54／53／16／8
- 追加state：16／8のsplit／explode

### 中央矩形境界と斜めband

attenuationとattenuation＋biasでは、opacity 16%／8%の同一拡大率で
中央矩形境界を認識不能な水準へ低減した。Shadow-off比の最大値は次の
とおりで、斜めbandゲート1.15以内である。

| 候補 | diagonal ratio最大 | periodic band ratio最大 |
|---|---:|---:|
| attenuation | 1.004695 | 1.001437 |
| attenuation＋bias | 1.004695 | 1.001437 |

### 前後面バランス

合格条件はrelative mean difference 0.30以下、かつbaseline比悪化
+0.05以下である。

| 候補 | relative mean difference最大 | baseline比悪化最大 | 判定 |
|---|---:|---:|---|
| baseline | 0.219648 | 0.000000 | 合格 |
| Shadow-off | 0.261115 | 0.081181 | 不合格 |
| attenuation | 0.219648 | 0.072299 | 不合格 |
| attenuation＋bias | 0.192421 | 0.072400 | 不合格 |

attenuationは最大relative値だけなら基準内だが、別条件でbaseline比
悪化が+0.05を超えるため`REJECTED_FRONT_BACK_BALANCE`とした。

### 性能

同一環境のbaseline差分で、average FPS悪化5%以内、p95悪化2ms以内、
reversal 0、stop-then-jump 0、wheel monotonic、transform invariant、
shadow refresh 0を判定した。

| 候補 | worst FPS変化 | worst p95悪化 | 判定 |
|---|---:|---:|---|
| Shadow-off | -0.075% | +1.0ms | 合格 |
| attenuation | -0.089% | +1.0ms | 合格 |
| attenuation＋bias | -24.153% | +15.2ms | 不合格 |

attenuation＋biasはMobileのexplode／split-explodeで悪化し、
`REJECTED_PERFORMANCE`を併記する。opacity、idle、pointer、wheelの
shadow refreshは0で、候補初期化時以外にshadow mapを更新しない。

## 回帰とprotected path

PR #20固定Headと現候補を、17 protected path × 2 viewportの
34条件で実WebGL PNG比較し、bytes／SHA-256 mismatch 0である。

- queryなし
- Phase 3C.1／3C.2／3C.3-only
- Phase 3A baseline／D2a／D2c3
- Phase 3B.1全6候補
- Phase 3B.1b全4候補

390×844総合は88/88、Desktop／Mobile UI・HUD、390×844 trusted
audio gestureを実ブラウザで確認した。Desktop総合の既存A.5前後面
30%項目はopacity 100%で失敗したが、候補は同条件でbaselineの
frontKey寄与を維持し、protected pathもbyte-identicalであるため、
候補固有回帰とは判定しない。Desktop trusted audioは1280 iframeの
操作ボタンがアプリ内ブラウザの可視幅外となり、環境制約として記録する。
Nodeは253/253、console error／warningは0、試験閾値や製品コードによる
環境回避は行っていない。

## 判定

- baseline：`RETAINED_DIAGNOSTIC_ONLY`
- Shadow-off：`HUMAN_DESIGN_HOLD_TECHNICALLY_NONFINAL`
- attenuation：`REJECTED_FRONT_BACK_BALANCE`
- attenuation＋bias：
  `REJECTED_FRONT_BACK_BALANCE`／`REJECTED_PERFORMANCE`
- Stage 2：未実施
- 技術finalist：0
- 最終状態：
  `ISSUE2_SHADOW_ROUTE_EXHAUSTED_NO_TECHNICAL_FINALIST`

Shadow-offは軽量対抗案として残すが、立体感とズームアウト時の暗さが
未解決で、人間確認前に採用しない。D2c3は
`RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`を維持し、性能、
角度別輝度差、物理iPhone未確認を明示する。Issue #2はOpen、
PR #5はOpen／Draftのまま維持する。

## 次の判断

追加のshadow camera、mapSize、bias sweep、depth Material方式は
探索しない。製品判断として残すのはShadow-offとD2c3の2案であり、
どちらも自動採用しない。人間が妥協案を選ぶ場合はPC実操作、
物理iPhone、15分温度確認と明示承認を別途必要とする。
