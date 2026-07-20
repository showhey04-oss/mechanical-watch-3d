# Refactor A.7 implementation and verification summary

## Outcome

Refactor A.7 removes the frame-accumulating position updates from the crown,
stem, and sliding clutch. All three real Three.js `Object3D` instances now use a
single absolute placement function derived from immutable position-1 bases,
the clamped/snap-normalized `crownTransition`, and the current explode offset.

The winding graph, setting graph, clutch active states, ratios, hand coupling,
and internal mechanism coordinates are unchanged.

## Implementation

- Added [`../js/keyless-position.js`](../js/keyless-position.js) with pure,
  deterministic transition and endpoint resolvers.
- Captured the three position-1 local coordinates, the sliding-clutch
  position-2 coordinate, and explode vectors once after object creation.
- Added the allocation-free `applyKeylessPositionGeometry()` runtime writer.
- Removed the three `position.x += ...` animation updates.
- Excluded the three keyless objects from the generic explode writer; their
  explode vectors are composed inside the dedicated writer instead.
- Clamp transition values to `[0, 1]`, snap values within `1e-5`, and recover a
  non-finite transition to the safe winding position.
- Reused the same placement function from animation, crown switching,
  live-sync reset, initialization, and diagnostic paths.
- Kept the geometry getter read-only so it detects drift before any repair, and
  made the deterministic cycle diagnostic restore the caller's principal
  mechanism, time, live-sync, rotation, and UI state in a `finally` block.
- Invalidate selection bounds and request a shadow refresh only when an actual
  keyless position changes, preserving A.6 idle-frame behavior.

## Diagnostic API

`window.watchModelDiagnostics` now exposes:

- `getKeylessPositionGeometry()`
- `getCrownTransition()`
- `getKeylessBasePositions()`
- `getKeylessDriftReport()`
- `runCrownPositionCycleTest(count)`
- `holdCrownPosition(position, frames)`

The reports include actual and expected local coordinates, per-axis errors,
scale and quaternion snapshots, frame counts, endpoint spans, graph/topology
invariants, interference counts, frame-rate finals, and accelerated long-hold
results.

## Verification

| Verification | Result |
| --- | ---: |
| Node configuration and A.7 tests | 33/33 passed |
| Desktop real-browser integration | 86/86 passed |
| A.7 checks inside desktop suite | 9/9 passed |
| Position-2 real-rAF hold | 600 frames / 9.999 s |
| Final 300-frame crown/stem/clutch X spans | 0 / 0 / 0 |
| Position-2 maximum expected-coordinate drift | 0 |
| Position-1 return error | 0 |
| Position 1 → 2 → 1 cycles | 100 |
| 100-cycle cumulative error / endpoint span | 0 / 0 |
| Scale / quaternion / mechanism angle / topology invariant | pass / pass / pass / pass |
| 30 / 60 / 120 fps final coordinates | byte-identical |
| Accelerated position-2 long hold | 3,600 frames, drift 0 |
| Long-hold isolated JS heap delta | 0 bytes |
| Position-1 / position-2 forbidden interference | 0 / 0 |
| Direct 390 × 844 A.7 checks | 9/9 passed |
| Direct 390 × 844 full regression | 87/88 passed |

The single mobile failure is the unchanged A.5 foreground-sample reliability
guard for the Walnut front view: 977 samples were observed against a strict
`> 1000` requirement. The lighting result itself passed for every theme, with a
worst front/back difference of 12.43%, and no existing threshold was relaxed.

The browser measurements above were recorded before the final diagnostic-only
audit changes (read-only drift getter, caller-state restoration, and removal of
the optional-argument allocation). The absolute runtime placement writer and
browser acceptance thresholds did not change afterward. Because localhost
browser access was then blocked, the post-audit source was verified with the
33/33 Node suite, inline-module syntax check, JSON/SVG validation, and
`git diff --check`, but was not relabeled as a new browser run.

### A.6 camera performance regression

| Scenario | Average fps | p50 | p95 | p99 | >33 ms | >50 ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Desktop pointer rotation | 59.57 | 16.70 ms | 16.80 ms | 17.80 ms | 0 | 0 |
| Desktop wheel zoom | 59.58 | 16.70 ms | 16.80 ms | 18.10 ms | 0 | 0 |
| 390 × 844 pointer rotation | 59.62 | 16.70 ms | 16.80 ms | 17.20 ms | 0 | 0 |
| 390 × 844 wheel zoom | — | — | 16.80 ms | 16.90 ms | 0 | 0 |

Pointer rotation reported zero direction reversals, zero stop-then-jump events,
and zero long tasks. Wheel zoom remained monotonic; its maximum frame step was
1.063% of total desktop zoom and 0.999% at 390 × 844.

## Evidence and remaining constraint

Exact measurements and the endpoint visualization are indexed in
[`evidence/refactor-a7/README.md`](evidence/refactor-a7/README.md).

The in-app browser security policy blocked the last mobile-harness inspection
and any subsequent localhost screenshot/video capture. No alternate browser or
capture workaround was used. Consequently, new A.7 WebGL screenshots and video
are not claimed; existing A.5/A.6 media remain regression references only.
The 3,600-frame report verifies that the selection-light coordinates and
intensity stay finite; selected-part `Box3` center tracking during that hold was
not separately captured and remains an explicit evidence limitation.
