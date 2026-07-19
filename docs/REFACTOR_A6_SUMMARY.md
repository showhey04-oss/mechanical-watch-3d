# Refactor A.6 implementation and verification summary

## Outcome

Refactor A.6 changes camera input, render pacing, UI refresh frequency, and
performance diagnostics only. The A.4 mechanism, its world coordinates and
kinematic graphs, the hand couplings and signs, the A.5 light layout, selection
rules, opacity rules, and interference rules are unchanged.

ArcballControls now owns a dedicated `controlCamera`. The scene, raycaster, and
camera-follow fill use a separate render camera that follows position,
quaternion, target, and zoom distance once per `requestAnimationFrame` with
frame-rate-independent exponential smoothing. Wheel input accumulates a target
distance instead of applying a fixed camera scale step.

Detailed references:

- [REFACTOR_A6_PERFORMANCE_BASELINE.md](REFACTOR_A6_PERFORMANCE_BASELINE.md)
- [REFACTOR_A6_CAMERA_SMOOTHING.md](REFACTOR_A6_CAMERA_SMOOTHING.md)
- [REFACTOR_A6_FRAME_PACING.md](REFACTOR_A6_FRAME_PACING.md)
- [evidence/refactor-a6/README.md](evidence/refactor-a6/README.md)

## Render-loop reductions

- Main-spring BufferGeometry is updated only for a meaningful reserve change,
  with a 10 Hz ceiling; the final winding test produced about 5 updates/s.
- DOM clock, reserve, state, amplitude, and rate outputs are updated at about
  10 Hz and unchanged values are not written again.
- Selection Box3 is recomputed only on selection or an assembly-position
  invalidation. Its light-intensity pulse remains per-frame.
- Arcball `controls.update()` is no longer called from the animation loop. It is
  retained only for initialization, presets, resize, and diagnostic restoration.
- The hair spring remains full-rate when simply viewing the running watch, and
  is capped near 30 Hz while interacting with the camera.
- Explode, endshake, and front/back split transforms are rewritten only when
  their control value changes.

## Adaptive quality

Desktop render DPR starts at 1.25 with a 1.5 cap. The 390 × 844 path starts at
1.0 with a 1.25 cap. The lower bound is 1.0. A rolling two-second p95 window can
reduce DPR in 0.1 steps when interaction p95 exceeds 25 ms; recovery occurs in
0.05 steps after two stable non-interactive seconds, with at least one second
between changes.

Shadow auto-update is disabled. The shadow map refreshes after initialization
or a structural display change, remains fixed during camera input, and refreshes
after the 220 ms interaction-quality release delay. The A.5 key/fill light
composition is unchanged.

## Final verification

| Suite or measurement | Result |
| --- | ---: |
| Node static/configuration tests | 25/25 |
| Desktop real-browser integration | 77/77 |
| A.5 checks retained in that run | 73/73 |
| A.4 checks retained in that run | 60/60 |
| Direct 390 × 844 browser integration | 79/79 |
| 10 s pointer rotation average / p95 / p99 | 59.92 fps / 18.70 ms / 18.70 ms |
| 10 s wheel zoom average / p95 / p99 | 59.91 fps / 16.80 ms / 18.10 ms |
| 10 s mobile rotation average / p95 / p99 | 59.91 fps / 18.60 ms / 18.70 ms |
| Pointer and wheel frames over 33.3 / 50 ms | 0 / 0 |
| Pointer direction reversals / stop-then-jump | 0 / 0 |
| Wheel max frame step as share of total zoom | 0.23% |
| Position-1 / position-2 forbidden interference | 0 / 0 |

All measured pointer, wheel, front, back, opacity, and mobile scenarios reported
zero long tasks and zero frames over 33.3 ms. The complete root world transform
remained byte-for-byte unchanged during camera scenarios.

## Remaining constraints

The environment provided direct pointer and wheel DOM event-path testing and a
direct 390 × 844 viewport, but no physical iPhone. Real-device iPhone Safari is
not claimed.

The in-app browser accepted all performance and regression runs, then blocked
additional localhost screen-capture calls under its browser safety policy. The
original user capture, final charts, and one post-change pointer frame are
committed. A new post-change screen-recording file could not be completed in
this run; existing A.5 native-input animations remain linked as regression
evidence rather than being relabeled as A.6 output.
