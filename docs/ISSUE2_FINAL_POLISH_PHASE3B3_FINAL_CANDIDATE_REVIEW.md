# Issue #2 Final Polish Phase 3B.3 — Final Retained-Candidate Human Review

## 結論

Phase 3B.3は、新しい描画方式を実装せず、現行透過方式を共有する次の2候補を最終人間比較用に整理する工程である。

- Shadow-off: `RETAINED_FINAL_HUMAN_REVIEW_CANDIDATE_NOT_ADOPTED`
- D2c3: `RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED`

現在の状態は次とする。

`AWAITING_HUMAN_PC_AND_PHYSICAL_IPHONE_FINAL_CANDIDATE_DECISION`

候補選定、既定採用、Ready化、マージ、Issue #2のクローズは行っていない。

## Phase 3B.2の製品判断

Phase 3B.2の技術状態は変更しない。

- `TRANSPARENCY_CONTINUITY_LIGHTWEIGHT_ROUTE_EXHAUSTED_OIT_DECISION_REQUIRED`
- `ISSUE2_PHASE3B2_AUDIT_ACCEPTED`
- `ACCEPT_CURRENT_TRANSPARENCY_DISCONTINUITIES_AS_KNOWN_REALTIME_RENDERING_LIMITATION`
- `OIT_DEFERRED_POST_COMPLETION_EXPERIMENT`

100%／99%の`transparent`切替と55%／54%の`depthWrite`切替は、既知のリアルタイム描画制約として受容する。OITは本体完成条件から外し、完成後の独立実験へ延期する。

## 比較query

共通:

```text
exterior=balanced
watchHead=phase3c1
strapStyle=phase3c2
integration=phase3c3
continuity=issue2-current
```

Shadow-off:

```text
rendering=issue2-phase3b1c-shadow-off
```

D2c3:

```text
rendering=issue2-d2c3
```

両候補ともquery限定であり、通常pathへは採用しない。

## continuity省略時の同値性

`continuity=issue2-current`明示時と省略時を、候補2種、1280×720／390×844、navy、通常状態12条件で比較した。

- Desktop 24条件は固定状態PNG byte／SHA-256一致
- Mobileはページ再読込間のGPU 8-bit量子化差を計測し、Shadow-offは最大12 pixel・2階調、D2c3は最大6 pixel・3階調
- world transform一致
- `issue2-current`のMaterial replacement 0
- `issue2-current`のMaterial UUID change 0
- `applyStructuralOpacity`の現行式と`issue2-current` resolverのsource-contract一致

Mobileの差は16 pixel以下・8-bit channel差3以下で、Material、transform、source contractに差がないため、sub-visible quantized pixel equivalentとする。PNG byte exactでなかったことも証跡へ残し、byte exactとは記載しない。

selected、split、explode、exterior OFFはアニメーション状態遷移の時刻差を含むため、同値性判定から除外する。ただし最終人間比較の256枚にはすべて含める。

## 比較行列

実WebGL PNGは次の256枚である。

- 2候補
- 2 viewport: 1280×720、390×844
- 4 theme: navy、obsidian、walnut、gallery
- 16 scenario

16 scenario:

1. front opacity 100／99／55／54／16
2. dial mechanism opacity 16
3. movement back opacity 100／16
4. side opacity 100
5. full-length opacity 100
6. near opacity 100
7. far opacity 100
8. front opacity 16 selected／split／explode／exterior OFF

比較ボードはfront／back／side、100／99、55／54、opacity 16、distance、4 theme、Desktop／Mobileを分離して作る。

## 操作証跡

候補2種×viewport 2種について、実Three.js canvasから次の9系列を各8 frameで取得する。

- 360度回転
- zoom-in後の回転
- zoom-out後の回転
- wheel zoom
- opacity 100→16→100
- exterior ON／OFF
- split／explode／restore
- 選択／空白解除
- full-length移行

合計288 frameから36 GIFを生成する。動画用frameは製品Sceneを加工せず、実ブラウザcanvasをコピーする。

## 性能

候補2種×viewport 2種×11 scenario×3反復の132測定を行う。

対象:

- idle
- normal pointer
- zoom-in pointer
- full-length pointer
- wheel
- opacity 16
- opacity continuous
- selected
- split
- explode
- exterior OFF

差分基準は従来どおり、平均fps悪化5%以内、p95悪化2ms以内、reversal 0、stop-then-jump 0、wheel monotonic、transform invariantである。試験閾値は変更しない。

全132 runでmotion gateは合格した。D2c3はShadow-off比22比較中9比較で性能差分基準を満たさず、特にDesktop idle／exterior OFFで悪化が大きい。これは既知の性能tradeoffとして人間判断票へ引き継ぎ、候補採用を自動決定しない。

## Mobile full-length

390×844のcamera state、strap world bounds、camera occupancyは候補間で一致したため、幾何学的な構図制約を`CANDIDATE_INDEPENDENT_MOBILE_FRAMING_LIMIT_CONFIRMED`とする。一方、Shadow-offのfull-length／farは単色化し、D2c3では時計が残るため、遠距離の描画可視性は候補差として分離して記録する。Phase 3B.3では製品カメラやGeometryを変更しない。

## protected path

Phase 3B.2人間判断commit `b303b8d6192309e21e6dea95595c8e808c258ffe`を基準に、`index.html`と`js/*.js`をbyte exactで照合する。Phase 3B.3はテストハーネス、証跡生成、文書、証跡だけを追加し、次を変更しない。

- Light、shadow、fog、Material、透過処理
- Geometry、camera、DPR
- UI、audio
- 100／99と55／54の現行挙動
- APP_VERSION、試験閾値

## 人間確認

PCでは同一ブラウザ、同一viewport、同一theme、同一時刻、同一操作順でShadow-offとD2c3を比較する。

物理iPhoneでは候補ごとに15分連続操作し、候補間でcooldownを挟む。確認対象は視認性、前後面バランス、金属階調、opacity 16内部視認、選択、外装ON／OFF、split／explode、回転、zoom、wheel相当、音、発熱、Safari reloadである。

回答は[PC確認票](./HUMAN_PC_REVIEW_ISSUE2_PHASE3B3.md)、[物理iPhone確認票](./HUMAN_PHYSICAL_IPHONE_REVIEW_ISSUE2_PHASE3B3.md)、[最終判断票](./HUMAN_DECISION_TEMPLATE_ISSUE2_PHASE3B3.md)へ記録する。自動試験だけで候補を採用しない。

## 保留

- 時針・分針と中央リング状部品の干渉
- ミニッツホイール軸の文字板表出

これらは`FINAL_GEOMETRY_CLEANUP_POST_ISSUE2`へ分離し、Phase 3B.3でGeometryを変更しない。
