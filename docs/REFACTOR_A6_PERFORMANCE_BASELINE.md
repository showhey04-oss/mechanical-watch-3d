# Refactor A.6 performance baseline

## User capture

The supplied pre-A.6 recording is retained as
[`evidence/refactor-a6/01-before-user-capture.mp4`](evidence/refactor-a6/01-before-user-capture.mp4).
The request supplied these measurements:

| Measurement | Value |
| --- | ---: |
| Duration | 15.903 s |
| Nominal recording rate | 60 fps |
| Recorded frames | 800 |
| Average frame rate | 50.262 fps |
| Gaps over 33.3 ms | 148 |
| Gaps over 50 ms | 3 |
| Approximate missing 60 Hz frames | 154 |

The recording load cannot be separated completely, but the matching visual
symptoms were also reported during unrecorded use.

## Instrumented A.5 baseline

Passive timing hooks were added before the optimization work. They did not
change the A.5 camera or render-loop behavior. Every scenario ran at least ten
seconds with the watch running.

| Scenario | Viewport | fps | p50 | p90 | p95 | p99 | >33.3 | >50 | Longest | rAF callbacks |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Front idle | 1280×720 | 49.76 | 16.70 | 33.30 | 33.40 | 33.40 | 72 | 1 | 66.70 | 502 |
| Pointer rotation | 1280×720 | 48.17 | 16.70 | 33.40 | 33.40 | 35.30 | 78 | 0 | 50.00 | 487 |
| Wheel zoom | 1280×720 | 47.58 | 16.70 | 33.30 | 33.40 | 35.30 | 74 | 0 | 48.80 | 482 |
| Movement back idle | 1280×720 | 46.01 | 16.70 | 33.40 | 33.70 | 34.30 | 90 | 1 | 100.00 | 464 |
| Structural opacity 16% | 1280×720 | 43.43 | 16.70 | 33.40 | 34.30 | 34.40 | 102 | 0 | 50.00 | 438 |
| Mobile pointer | 390×844 | 59.92 | 16.70 | 16.70 | 16.80 | 17.30 | 0 | 0 | 17.60 | 605 |

The pointer run received 465 pointermove events and 517 control-change events.
Its p95 quaternion step was 0.67233 rad, p99 was 1.92748 rad, the maximum was
2.87313 rad, and the diagnostic detected 12 signed direction reversals plus one
stop-then-jump transition. The mobile run reached p95 1.75790 rad and detected
10 reversals despite good frame delivery.

## A.5 per-frame cost inventory

The 10-second pointer baseline measured these main-thread callback costs:

| Stage | Calls | Average | Maximum |
| --- | ---: | ---: | ---: |
| Mechanism state calculation | 488 | 0.1061 ms | 0.3000 ms |
| `updateHairSpring()` | 488 | 0.0139 ms | 0.1000 ms |
| `updateMainSpring()` | 488 | 0.0105 ms | 0.1000 ms |
| `updateBalanceReadout()` | 488 | 0.0260 ms | 0.2000 ms |
| `updateTimeUI()` | 488 | 0.0043 ms | 0.1000 ms |
| `controls.update()` | 488 | 0.0201 ms | 0.2000 ms |
| `renderer.render()` CPU submission | 488 | 5.6162 ms | 12.1000 ms |

The baseline source recomputed selection Box3 once per rendered frame whenever
a part was selected. The timing scenario had no selected part, so that branch
recorded zero calls; the call-site audit establishes its rAF frequency.

`PerformanceObserver` long-task collection was available and reported no
50 ms tasks during the instrumented baseline. Frame gaps therefore remain the
authoritative end-to-end signal. The JS `renderer.render()` timer measures CPU
submission and does not include asynchronous GPU/compositor completion.
