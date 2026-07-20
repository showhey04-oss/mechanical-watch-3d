# Refactor A.6 camera smoothing design

## Camera ownership

```text
pointer / pinch -> ArcballControls -> controlCamera + controls.target
wheel           -> desiredZoomDistance
                                  |
                                  v  once per rAF
renderCamera (camera) + renderTarget
        |                 |
        |                 +-- scene rendering and framebuffer diagnostics
        +-- raycaster and cameraFill parent
```

The mechanism root is not parented to either camera and is never transformed by
navigation. `getCameraOrientation()`, `getCameraQuaternion()`, and
`getCameraTarget()` report the rendered view. `getCameraSmoothingState()` reports
both roles and the target distance.

Presets initialize both cameras and both targets from one `VIEW_UP = [0,0,1]`
basis. Resize updates both projections. The raycaster intentionally continues
to use the render camera so selection matches the pixels the user sees.

## Frame-rate-independent following

The rAF loop uses `alpha = 1 - exp(-dt / tau)` for every interpolated state:

| State | Interaction tau | Release/settle tau |
| --- | ---: | ---: |
| Quaternion | 0.035 s | 0.085 s |
| Position | 0.045 s | 0.090 s |
| Target | 0.045 s | 0.090 s |
| Zoom distance | 0.065 s | 0.065 s |

Quaternion interpolation uses normalized slerp. Position and target use lerp.
Values snap only below small convergence tolerances, preventing an endless
sub-pixel tail without introducing a visible step.

Arcball animations and gizmos remain disabled. With Three.js r160 and
`enableAnimations=false`, per-frame `controls.update()` is not needed after an
input event has updated the control camera. A.6 calls it only during setup,
preset application, resize, and diagnostic view restoration.

## Continuous wheel zoom

The previous `scaleFactor = 1.16` step is removed. The retained Arcball fallback
factor is 1.03, while wheel events are captured before Arcball's fixed-step
handler and accumulated into the shared target distance:

```text
normalized delta = pixels, lines × 16, or pages × viewport height
per-event delta   = clamp(normalized delta, -120, +120)
desired distance *= exp(delta × 0.0012)
distance range    = 18 ... 120
```

The rAF loop moves the control-camera distance toward that target with a
0.065-second tau, then the render camera follows the control camera. Native
pinch continues through Arcball into the same control-camera path, with render
smoothing preventing an immediate visual jump.

The final ten-second wheel run changed distance monotonically from 60.03946 to
43.48639. The largest frame step was 0.03803, only 0.23% of the total change;
there were no alternating increments or target overshoots.

## Interaction-quality lifecycle

Arcball `start` and captured wheel input enter interaction quality. Arcball
`end`, or 180 ms after the last wheel event, schedules normal quality after a
220 ms delay. Selection tap recognition remains suppressed by the existing
gesture distance, multi-pointer, control-moved, and cooldown rules.

During interaction:

- render DPR favors the interaction target;
- shadow map updates remain frozen;
- hair-spring Geometry is capped near 30 Hz;
- expensive selection Box3 recalculation remains invalidation-driven;
- DOM readouts remain near 10 Hz.

After release, the pending shadow refresh occurs first. DPR recovery is slow
and occurs only after a stable non-interactive interval.
