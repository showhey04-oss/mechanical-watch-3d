# Refactor A.7 absolute keyless-position design

## Ownership boundary

The crown, stem, and sliding clutch have one runtime position owner:
`applyKeylessPositionGeometry()`.

Object construction still assigns the initial coordinates once. Immediately
after construction, A.7 snapshots the immutable local bases and explode vectors:

```text
keylessBase
├── crownWind
├── stemWind
├── slidingClutchWind
├── slidingClutchSet
└── explodeVectors
    ├── crown
    ├── stem
    └── slidingClutch
```

The generic explode pass skips these three objects. Parent `groups.wind` and
`groups.dial` transforms still own side separation, so the saved bases remain
independent of camera movement, side separation, selection, shadows, and group
world transforms.

## Absolute equations

For transition `t = clamp(crownTransition, 0, 1)` and explode amount `e`:

```text
crown       = crownWind + [pullOut × t, 0, 0] + crownExplode × e
stem        = stemWind  + [pullOut × t, 0, 0] + stemExplode  × e
sliding     = lerp(slidingWind, slidingSet, t) + slidingExplode × e
```

At `t === 0` and `t === 1`, the sliding clutch selects the stored endpoint
directly instead of calculating it through floating-point interpolation. This
makes every settled endpoint exact and prevents round-off accumulation across
repeated cycles.

The animation loop performs no positional `+=` or `-=` update for these
objects. The writer uses scalar values and `Vector3.set()` without allocating
temporary vectors or result arrays in the rAF path.

## Transition safety

`advanceKeylessTransition()` retains the existing response rate:

```text
next = current + (target - current) × min(1, dt × 9)
```

It then clamps to `[0, 1]` and snaps within `1e-5` of the target. A non-finite
transition or `dt` resolves to `0`. The runtime also switches the functional
state and UI back to position 1 when it encounters a non-finite transition, so
the displayed position cannot disagree with the active clutch graph.

## Runtime call paths

The same writer is called by:

- every animation frame;
- `setCrownPosition()`, including its same-state early return;
- `setSyncUI()` after a forced transition reset;
- initial position setup and URL-driven crown setup through
  `setCrownPosition()`;
- real-rAF hold tests, deterministic cycle tests, and frame-rate diagnostics.

When a coordinate actually changes, selection bounds become dirty and one
shadow refresh is requested. Settled frames do not recalculate `Box3` or force
shadow work, which retains the A.6 performance boundary.

## Diagnostic semantics

`getKeylessPositionGeometry()` is read-only: it samples the real `Object3D`
local positions before comparing them with independently resolved expected
positions. It therefore reports externally introduced drift instead of
self-repairing it before measurement. The report also includes per-axis error,
UUID, scale, and quaternion.

`holdCrownPosition(position, frames)` waits for real animation frames. It keeps
only a fixed 300-sample typed-array ring for X-coordinate spans, so the requested
600-frame hold does not grow a per-frame report array.

`runCrownPositionCycleTest(count)` applies deterministic `dt` steps to the real
objects without waiting hundreds of seconds. It checks exact endpoints, scale,
quaternion, mechanism angles, topology fingerprints, 30/60/120 fps finals, and
a 3,600-frame stable hold. Its steady long-hold loop calls only the allocation-
free writer. The diagnostic snapshots the caller's crown state, transition,
running and live-sync flags, mechanism resolver states, connection offsets,
Object3D rotations, time state, and related UI values, then restores them in a
`finally` block.

## Measured endpoints

| Part | Position 1 X | Position 2 X | 600-frame tail span | 100-cycle endpoint span |
| --- | ---: | ---: | ---: | ---: |
| Crown | 19.8 | 21.150000000000002 | 0 | 0 |
| Stem | 0 | 1.35 | 0 | 0 |
| Sliding clutch | -2.6953173099927072 | 4.28 | 0 | 0 |

All values are local coordinates at explode amount zero. Position 1 and
position 2 both retained zero forbidden interference in the real browser run.
