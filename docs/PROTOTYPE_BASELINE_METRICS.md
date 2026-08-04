# Prototype baseline metrics

Mechanical Watch 3D v3.15.0の完成prototypeをInstalled Chromeで測定した後継再構築用baselineです。製品treeは`origin/main`（`eb4595e040786e0e2115165d36a9cc39e08b2038`）とexactで、計測は一時HTTP instrumentationから実行しました。通常の`index.html`、`js/**`、音源、package設定は変更していません。

判定は`ENVIRONMENT_QUALIFIED_BASELINE`です。endpoint securityを含む通常の背景プロセスを停止していないため、absolute clean-process PASSは主張しません。

## Runtime model

- Object3D: 729
- Mesh: 589
- Geometry objects: 591
- vertices: 407428
- Mesh triangles: 360628
- shadow caster / receiver: 553 / 553
- unique visible materials: 190
- material-referenced textures: 2
- renderer programs: 17

既知値407,428 vertices、589 Mesh、553 shadow castersはいずれも実測と一致しました。rendered triangleとdraw callはshadow passおよび状態により変動するため、下表を正本にします。

## Viewport/state results

| viewport | state | profile | Mesh | vertices | Mesh triangles | draw calls | rendered triangles | avg fps | p50 ms | p95 ms | p99 ms | >33 ms | >50 ms |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 1280x720 | default-initial | front-idle | 589 | 407428 | 360628 | 3650 | 710244 | 34.16 | 33.2 | 34.3 | 50.1 | 18 | 2 |
| 1280x720 | default-initial | pointer-rotate | 589 | 407428 | 360628 | 3650 | 710244 | 33.352 | 33.3 | 34.3 | 34.4 | 35 | 0 |
| 1280x720 | default-initial | wheel-zoom | 589 | 407428 | 360628 | 3650 | 710244 | 21.485 | 33.3 | 100.2 | 184 | 31 | 14 |
| 1280x720 | explode | front-idle | 589 | 407428 | 360628 | 3634 | 709308 | 31.876 | 33.3 | 34.4 | 50 | 23 | 1 |
| 1280x720 | exterior-off | front-idle | 427 | 263968 | 130000 | 824 | 247204 | 52.017 | 16.7 | 33.3 | 34.3 | 6 | 1 |
| 1280x720 | legacy-initial | front-idle | 440 | 250219 | 127809 | 858 | 244870 | 53.165 | 16.7 | 33.4 | 33.4 | 7 | 0 |
| 1280x720 | opacity-26 | front-idle | 589 | 407428 | 360628 | 2274 | 438832 | 29.845 | 33.3 | 50.9 | 66.6 | 27 | 4 |
| 1280x720 | selected | front-idle | 589 | 407428 | 360628 | 3650 | 710244 | 27.445 | 33.3 | 50.1 | 51 | 24 | 4 |
| 1280x720 | split | front-idle | 589 | 407428 | 360628 | 3650 | 710244 | 19.925 | 34.2 | 99.3 | 100.1 | 21 | 12 |
| 390x844 | default-initial | front-idle | 589 | 407428 | 360628 | 3582 | 706932 | 14.194 | 50.1 | 100.7 | 150 | 20 | 14 |
| 390x844 | default-initial | pointer-rotate | 589 | 407428 | 360628 | 3582 | 706932 | 23.182 | 33.5 | 83.1 | 100.1 | 40 | 13 |
| 390x844 | default-initial | wheel-zoom | 589 | 407428 | 360628 | 3582 | 706932 | 39.387 | 17.7 | 34.3 | 50 | 27 | 1 |
| 390x844 | explode | front-idle | 589 | 407428 | 360628 | 3558 | 705364 | 26.006 | 33.3 | 66.6 | 67.6 | 22 | 11 |
| 390x844 | exterior-off | front-idle | 427 | 263968 | 130000 | 756 | 245892 | 59.063 | 16.7 | 17.6 | 17.7 | 1 | 0 |
| 390x844 | legacy-initial | front-idle | 440 | 250219 | 127809 | 790 | 243558 | 12.563 | 66.7 | 133.3 | 133.3 | 20 | 14 |
| 390x844 | opacity-26 | front-idle | 589 | 407428 | 360628 | 2206 | 436520 | 30.819 | 33.2 | 50.2 | 50.7 | 24 | 5 |
| 390x844 | selected | front-idle | 589 | 407428 | 360628 | 3582 | 706932 | 28.822 | 33.3 | 51 | 51 | 22 | 12 |
| 390x844 | split | front-idle | 589 | 407428 | 360628 | 3584 | 707092 | 35.721 | 32.5 | 34.3 | 49.9 | 18 | 0 |

Startup欄、group別内訳、renderer/control/mechanism/DOM cost、long task、motion／zoom不変条件、browser／OS／DPRは[performance-baseline.json](HANDOFF_SPEC/performance-baseline.json)と[raw evidence](evidence/prototype-freeze-performance/raw/)へ保存しています。

## Physical iPhone thermal evidence

既存Human証跡はiPhone 16／iOS 26.5.2の15分操作で`SLIGHT_WARMTH`、機能劣化は`NOT_REPORTED`です。定量温度は`NOT_MEASURED`、時間別frame degradationは`DO_NOT_INFER`とし、新しい物理iPhone試験を主張しません。
