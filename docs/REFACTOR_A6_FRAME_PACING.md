# Refactor A.6 frame-pacing results

## Final ten-second scenarios

| Scenario | Viewport | fps | p50 | p90 | p95 | p99 | >33.3 | >50 | Longest | rAF callbacks |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Front idle, watch running | 664×814 | 59.90 | 16.70 | 18.60 | 18.60 | 18.70 | 0 | 0 | 18.80 | 603 |
| Movement back, watch running | 664×814 | 59.91 | 16.70 | 18.60 | 18.60 | 18.70 | 0 | 0 | 18.70 | 603 |
| Structural opacity 16% | 664×814 | 59.91 | 16.70 | 18.60 | 18.60 | 18.70 | 0 | 0 | 18.70 | 603 |
| Pointer rotation, watch running | 664×814 | 59.92 | 16.70 | 18.60 | 18.70 | 18.70 | 0 | 0 | 18.80 | 643 |
| Wheel zoom, watch running | 664×814 | 59.91 | 16.70 | 16.70 | 16.80 | 18.10 | 0 | 0 | 18.60 | 628 |
| Mobile pointer, watch running | 390×844 | 59.91 | 16.70 | 18.60 | 18.60 | 18.70 | 0 | 0 | 18.70 | 644 |

All scenarios recorded zero `longtask` entries. Desktop render DPR was 1.25;
the direct 390 × 844 render DPR was 1.0. Both retain their higher non-interactive
quality caps.

## Pointer smoothness

| Measurement | A.5 baseline | A.6 final |
| --- | ---: | ---: |
| p50 quaternion step | 0.08622 rad | 0.04374 rad |
| p95 quaternion step | 0.67233 rad | 0.04989 rad |
| p99 quaternion step | 1.92748 rad | 0.05296 rad |
| Maximum quaternion step | 2.87313 rad | 0.05646 rad |
| p95 angular velocity | 31.07782 rad/s | 3.07982 rad/s |
| p95 adjacent velocity difference | 72.07897 | 1.24180 |
| Direction reversals | 12 | 0 |
| Stop-then-jump detections | 1 | 0 |

The final test processed 533 pointermove events and 593 Arcball change events.
The mechanism-root world signature remained unchanged and every camera value
remained finite.

## Zoom smoothness

| Measurement | Result |
| --- | ---: |
| Start / end distance | 60.03946 / 43.48639 |
| Total change | -16.55307 |
| Largest one-frame distance change | 0.03803 |
| Largest step / total change | 0.23% |
| p50 / p95 frame distance change | 0.02710 / 0.03254 |
| Alternating-sign increments | 0 |
| Monotonic | yes |

The 8% one-frame acceptance limit was cleared by a wide margin.

## Update-rate and CPU breakdown

The final ten-second pointer run recorded:

| Stage | Calls or real updates | Average callback cost | Maximum |
| --- | ---: | ---: | ---: |
| Mechanism state calculation | 644 calls | 0.0668 ms | 0.3000 ms |
| Hair-spring wrapper / real Geometry | 644 / 282 | 0.0054 ms | 0.1000 ms |
| Main-spring wrapper / real Geometry | 644 / 54 | 0.0017 ms | 0.1000 ms |
| Balance/state DOM batch | 102 | 0.0127 ms | 0.1000 ms |
| Time DOM batch | 102 | 0.0039 ms | 0.1000 ms |
| Selection Box3 refresh | 0 | 0 ms | 0 ms |
| Camera smoothing | 644 | 0.0118 ms | 0.1000 ms |
| Renderer CPU submission | 644 | 5.0989 ms | 14.6000 ms |
| Shadow refresh | 1 | below timer resolution | below timer resolution |

The selected-part browser regression leaves a part selected before the A.6
performance runs; Box3 still recorded zero refreshes because neither the
selection nor its assembly position was invalidated.

## Acceptance result

Desktop pointer and wheel tests meet p50 ≤18 ms, p95 ≤25 ms, p99 ≤40 ms,
average ≥55 fps, fewer than 5% frames over 33.3 ms, and no more than one frame
over 50 ms. Mobile meets p95 ≤33.3 ms, average ≥45 fps, and fewer than 2% frames
over 50 ms. Actual results had zero 33.3/50 ms exceedances in all final runs.
