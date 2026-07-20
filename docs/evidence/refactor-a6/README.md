# Refactor A.6 evidence index

## Files

| File | Evidence |
| --- | --- |
| `01-before-user-capture.mp4` | User-supplied pre-A.6 recording with stop-and-jump rotation and stepped zoom |
| `02-before-frame-time-distribution.svg` | Instrumented A.5 pointer/wheel p50-p99 and longest-frame graph |
| `03-after-frame-time-distribution.svg` | A.6 pointer/wheel p50-p99 and longest-frame graph |
| `04-percentile-comparison.svg` | Before/after p95 and p99 comparison |
| `05-after-pointer-frame.png` | Real Three.js page during the A.6 pointer event-path run |

Existing native-input and all-direction animations remain available as A.5
regression evidence:

- [`../refactor-a5/11-horizontal-front-back-front-1.2turn.gif`](../refactor-a5/11-horizontal-front-back-front-1.2turn.gif)
- [`../refactor-a5/12-vertical-pole-crossing-1.2turn.gif`](../refactor-a5/12-vertical-pole-crossing-1.2turn.gif)
- [`../refactor-a5/13-native-pointer-repeated-drag.gif`](../refactor-a5/13-native-pointer-repeated-drag.gif)
- [`../refactor-a5/15-mobile-touch-rotate-zoom-pan.gif`](../refactor-a5/15-mobile-touch-rotate-zoom-pan.gif)

## Final measured results

The unrecorded ten-second pointer run passed at 59.92 fps with p50/p95/p99 of
16.70/18.70/18.70 ms, zero 33.3 ms or 50 ms exceedances, zero long tasks, zero
direction reversals, and zero stop-then-jump detections. The wheel run passed at
59.91 fps with p95 16.80 ms; the maximum frame distance change was 0.23% of the
complete zoom.

The 390 × 844 pointer run passed at 59.91 fps with p95 18.60 ms and zero frame
threshold exceedances. The complete browser regression passed 77/77 desktop and
79/79 at 390 × 844.

## Capture constraint

After completing the measurements and browser regressions, the in-app browser
blocked further localhost screen-capture calls under its browser safety policy.
One post-change frame was already stored, but the requested new A.6 pointer,
wheel, and mobile screen-recording files could not be completed. No alternate
browser, raw CDP, or OS-level recording workaround was used. The linked A.5
animations are identified only as regression evidence, not as A.6 recordings.

A physical iPhone was not connected, so real-device Safari remains a manual
follow-up.
