# Known defects and accepted limitations

Mechanical Watch 3D v3.15.0で本体完成後に凍結した、後継版で再監査する既知事項です。観察だけの項目を実Geometry交差と断定せず、現行prototypeでは修正しません。機械可読版は[known-defects.json](HANDOFF_SPEC/known-defects.json)です。

| ID | 状態 | 現象 | Geometry交差 | 現行判断 |
|---|---|---|---|---|
| `center-hand-ring-geometry-interference` | `DEFERRED_CENTER_HAND_RING_GEOMETRY_INTERFERENCE` | The hour or minute hand appears to intersect a central ring-like component in some views. | not measured | No Geometry change after v3.15.0 body completion. |
| `minute-wheel-arbor-dial-protrusion` | `DEFERRED_MINUTE_WHEEL_ARBOR_DIAL_PROTRUSION` | The minute-wheel arbor appears exposed on the dial side. | not measured | Preserve wheel center, diameter, tooth count, mesh and motion-work layout. |
| `regulator-scale-balance-bridge-interference` | `REGULATOR_SCALE_BALANCE_BRIDGE_INTERFERENCE_HUMAN_OBSERVED` | The regulator scale and balance bridge appear to interfere. | not measured | Record only; do not mix Geometry changes into the frozen rendering/audio line. |
| `remote-gray-plate-like-objects` | `IDENTIFIED_PRODUCT_OBJECT` | Two small gray plate-like objects appear separated from the movement in some full-length or zoomed views. | false | Product fix not performed; feature development is frozen. |

## 浮遊して見える灰色板状Object 2枚

判定は`IDENTIFIED_PRODUCT_OBJECT`です。名前を事前指定せず、実Three.js scene全件から外装所有、movement包絡から50以上、材質輝度0.75以上、Y方向長8以上、proxy／diagnostic／helper除外という観察形態の条件で抽出しました。該当がちょうど2件となり、実行時名は`Phase 3C.2 尾錠枠`（[final-strap-buckle-phase3c2.js](../js/final-strap-buckle-phase3c2.js#L856)の`buckleFrame`）と`Phase 3C.2 つく棒`（同[L905](../js/final-strap-buckle-phase3c2.js#L905)の`buckleTang`）です。

6時側の黒革ストラップ終端にある正規の銀色尾錠部品ですが、movement中心のframingやfull-length/far表示では暗色ストラップが深紺背景・fogへ馴染む一方、明るい金属部品だけが知覚され、離れた2枚に見えます。外装OFFでは2部品とも非表示、legacy routeには存在しません。現行prototypeでは修正せず、後継版でstrap／buckleの所有階層と遠景contrast・fog・compositionを再設計します。

## 未測定のGeometry疑義

時分針中央部、ミニッツホイール軸、緩急目盛／テンプ受の3件はHuman観察を保持していますが、triangle intersectionまたは最小clearanceを測定していません。詳細な保護対象と後続計測条件は[POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md](POST_ISSUE2_GEOMETRY_CLEANUP_NOTES.md)を参照してください。

## 証跡

Installed Chrome上のdefault／legacy inventoryとcamera、opacity、exterior、split、explode、section clip、selection、display／function group matrixは[evidence README](evidence/prototype-freeze-known-defects/README.md)に記録します。
