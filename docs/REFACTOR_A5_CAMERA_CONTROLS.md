# Refactor A.5 camera controls

## Control and coordinate convention

`OrbitControls` is replaced by the Three.js 0.160.0 `ArcballControls` addon.
The implementation uses the r160 constructor and public configuration surface:

```js
new ArcballControls(camera, renderer.domElement, scene)
```

Rotation, pan, zoom, touch gestures, and `start` / `change` / `end` events stay
on the camera. The control has no polar-angle limit. Animations and focus are
disabled to keep stopping and single-click selection predictable; the gizmo is
hidden. Minimum and maximum distance remain bounded at 18 and 120.

The application exports one basis:

```text
VIEW_UP = DIAL_UP_VECTOR = [0, 0, 1]
```

Camera presets no longer contain `up`. A preset changes position, target, and
fit distance, then derives its orientation from the shared basis. Arcball roll
may rotate the live camera-up vector as part of the camera quaternion, but a
preset never chooses a different basis. Reset/front/back target the movement
center `[0, 0.5, 0]`; detail presets retain their local part targets.

Arcball r160 moves an internal gizmo during pan without rewriting its exposed
target. The `end` integration copies that verified r160 gizmo center back into
the documented `controls.target`, keeping presets, diagnostics, raycasting, and
subsequent quaternion rotations on the same focus point.

## Selection integration

The A.2 pointer state machine now consumes Arcball's events:

- control `start` marks camera manipulation and cancels preset semantics;
- control `change` marks the pointer gesture as moved;
- control `end` records the existing 125 ms cooldown and synchronizes target;
- pointer capture, multi-pointer rejection, movement distance, and debounce
  rules are unchanged.

Native browser drag left selection at “none”. A following single click selected
one internal part. The 390 × 844 two-pointer gesture changed distance and focus
without firing selection.

## Diagnostics

The A.5 diagnostic surface adds:

- `getCameraControlType()`
- `getCameraOrientation()`
- `getCameraQuaternion()`
- `getCameraTarget()`
- `getViewUpConvention()`
- `getRotationFreedomReport()`
- `getLightingRigReport()`
- `getVisibleLightContributionReport()`
- `getFrontBackLuminanceReport()`
- `getModelWorldSignature()`
- `getViewportReport()`
- `simulateArcballDrag()`
- `simulateTouchGesture()`

`simulateArcballDrag()` uses the same camera/target quaternion trackball path
and control events for deterministic turns over 360 degrees. Its pointer mode
dispatches the pointer sequence consumed by Arcball for one-finger testing.
Separately, native in-app browser drag and wheel input prove that the production
event path responds outside the diagnostic API.

## Invariance and results

Before and after presets and free rotation, the browser compares position,
quaternion, scale, and `matrixWorld` for:

```text
root, mainPlate, dialRing, crownWheel, ratchetWheel,
centerWheel, minuteHand, hourHand, secondsHand
```

Horizontal 1.08-turn, upward 1.08-turn, and downward 1.02-turn tests all kept
the signature byte-for-byte equal, reached both front and back, and reported no
hard stop or non-finite quaternion. Every UI preset also completed left/right
rotation from its starting orientation.

The direct 390 × 844 run passed one-finger rotation, two-finger zoom/pan,
selection suppression, and panel-open/close recovery. A physical iPhone was
not attached, so real-device Safari remains a documented manual follow-up.
