# Refactor A.4 implementation and verification summary

## Outcome

Refactor A.4 completes the position-1 winding path with real Three.js objects and
an explicit one-way winding graph. It also defines the unchanged negative-Y dial
side as the semantic watch front, makes that side the default view, and unifies
the running and setting signs so time increase is clockwise from the dial front.

The two detailed design references are:

- [REFACTOR_A4_WINDING_TOPOLOGY.md](REFACTOR_A4_WINDING_TOPOLOGY.md)
- [REFACTOR_A4_FRONT_CONVENTION.md](REFACTOR_A4_FRONT_CONVENTION.md)

## Winding transmission

The implemented path is:

```text
crown -> stem -> sliding clutch -> winding clutch -> winding pinion
      -> crown wheel -> ratchet wheel -> barrel arbor -> mainspring
```

The A.3 stem channel and every established Y band remain unchanged. A short
10-tooth X-axis winding pinion contacts the lower educational crown teeth of a
compound crown-wheel assembly. The same assembly has a vertical arbor and an
upper 40-tooth spur gear at the existing winding band. That upper gear meshes
directly with the 60-tooth ratchet wheel on the fixed barrel-arbor centre. This
avoids both an unconnected visual drive and a long transverse shaft through
unrelated parts.

The winding gears use one module, `0.082`. Their pitch radii are `0.41`, `1.64`,
and `2.46`, and the crown-wheel/ratchet-wheel centre distance is exactly `4.10`.
The short pinion/crown pitch contact is exact at
`[-3.11531731, -0.64, -4.50]`.

Forward crown motion propagates with gains `1`, `+1/4`, and `-1/6` at the
pinion, crown wheel, and ratchet/arbor respectively. The resulting stored-wind
gain is `+1/6`. Reverse crown motion rotates
the crown, stem, clutches, and short pinion but holds the crown wheel, ratchet,
and arbor at the one-way boundary. Position 2 opens the sliding/winding-clutch
boundary and drives only the setting branch.

## Barrel energy and single-writer ownership

The barrel root is fixed. Its drum assembly and arbor assembly are sibling
Object3Ds with independent angles:

```text
relative winding = barrel drum angle - barrel arbor angle
```

The going train writes only the barrel drum. `applyWindingState()` writes the
crown input path, crown and ratchet wheels, barrel arbor, and setting-input
clutch. `applyMotionWorksState()` writes the permanent dial train and the three
hand assemblies. No Object3D is shared by those runtime writers.

The winding topology represents relative energy as two inputs: read-only
`barrelDrum -> mainspring (+1)` and `barrelArbor -> mainspring (-1)`. Only the
pinion/crown connection is one-way. During reverse input, the downstream mesh,
square fit, and energy relations remain structurally active but are unreachable
from the crown source.

The removed `windingArborAngle` and `windingCrownWheelAngle` direct accumulators
are replaced by `resolveWindingState()`. Only the resolver's forward arbor
winding increment adds reserve; explicit-time or day-wrap drum jumps cannot add reserve, and reverse
freewheel adds no crown-driven unwind at the one-way boundary. The
click and click spring use the actual ratchet tooth phase instead of a free
animation phase.

## Dial-front and clockwise convention

The physical layering remains:

```text
dial side: negative Y
movement side: positive Y
```

The semantic frame is now:

```text
front normal = [0, -1, 0]
dial up      = [0,  0, 1]
dial right   = [1,  0, 0]
clockwise Object3D.rotation.y sign = +1
```

`reset`, `front`, and `dialFront` look from negative Y. `back` and
`movementBack` look from positive Y. The UI labels are now “表面・文字板”,
“裏面・ムーブメント”, “文字板側機構”, “ムーブメント側機構”, and
“巻上げ伝達”. Camera changes do not move or mirror mechanism objects.

The main train source, setting source, escape-wheel counter-rotation, dial
marker placement, and hand assembly phases follow the same convention. The
minute hand remains rigidly coupled 1:1 to the cannon tube, the hour hand to the
hour pipe, and the seconds hand to the fourth arbor. There is no hand-only sign
inversion or direct time-to-hand rotation writer.

## Diagnostics

`window.watchModelDiagnostics` exposes the A.4 runtime state through:

- `getWindingTopology()`
- `getWindingPartRotations()`
- `getWindingTransmissionReport()`
- `getRatchetState()`
- `getBarrelEnergyState()`
- `getFrontConvention()`
- `getDialProjectionReport()`
- `getHandScreenDirectionReport()`
- expanded `getPartRotations()` data for the winding pinion, compound crown
  wheel, ratchet wheel, barrel arbor, and barrel drum

The page query parameters used for reproducible evidence can also set `camera`,
`mode`, `crown`, `turn`, `time`, `paused`, `opacity`, `theme`, `panel`, and a
named selected part.

## Verification

### Static Node tests

Command:

```text
node --test tests/*.test.mjs
```

Result: **20/20 passed**.

The static suite validates the complete configuration, winding graph metadata,
module-derived pitch geometry, X/Y contact, centre distance, axial band and tooth
phase, finite winding-connection metadata, forward/freewheel/set state behavior,
single writers, the unchanged Y-layer snapshot, every front/back camera alias,
rigid hand couplings, dial interference rules, and the A.3 motion-work regression
set.

### Real browser / Three.js integration

The page was served over HTTP and loaded in the in-app browser with
`?browserTest=1`. Result: **60/60 passed**.

Representative measured results:

| Measurement | Result |
| --- | ---: |
| Winding pinion / crown / ratchet / arbor forward deltas | `+1.73264 / +0.43316 / -0.288773 / -0.288773 rad` |
| Maximum forward winding-ratio error | `2.78 × 10^-17` (dimensionless) |
| Pinion/crown pitch-contact error | `0` |
| Pinion/crown tooth-gap phase / dynamic phase error | `0 / 0 rad` |
| Crown/ratchet centre-distance error | `0` |
| Crown/ratchet axial-band error | `0` |
| Crown/ratchet dynamic phase residual | `-2.84 × 10^-14 rad` |
| Ratchet/arbor rigid-fit angular error | `0` |
| Intended winding contact envelopes | `8 / 8 intersect` |
| Position-1 / position-2 forbidden intersections | `0 / 0` |
| Reverse ratchet / arbor delta | `0 / 0 rad` |
| Reverse power-reserve change | `0 h` |
| 23:59:59 -> 00:00:01 explicit-time reserve change | `0 h` |
| Wind-to-set maximum permanent-angle jump | `0 rad` |
| Maximum rigid going/display-train speed difference with / without winding | `1.96 × 10^-13 rad/s` |
| Escapement impulse-modulated average-speed difference | `6.26 × 10^-4 rad/s` (`< 0.15` tolerance) |
| Maximum hand/source angular coupling error | `1.65 × 10^-13 rad` |
| Maximum source/hand mount distance | `0` |
| Front clockwise screen delta, seconds / minute / hour | `+0.458356 / +0.458356 / +0.458356 rad` |
| Front/back minute-hand screen angle at 12:15 | `+π/2 / -π/2` |

The browser suite also verifies exact 12/3/6/9 marker projection, 12:00,
12:15, 3:00, and small-seconds cardinal positions, continuous clockwise motion,
right-input clockwise setting of both minute and hour hands, unchanged world
position/quaternion/scale/matrices across the front/back camera switch,
normal-train isolation from winding, barrel-drum, full going-train, setting-train,
and three-hand speed during
winding, all eight winding contacts, click coupling derived independently from
two real ratchet Object3D tooth phases, transparent internal-part selection, and
wind-mode raycast selection through the mainspring endpoint.

## Browser evidence

Nineteen WebGL screenshots and their index are in
[evidence/refactor-a4/README.md](evidence/refactor-a4/README.md).

## Remaining limitations

- Gear teeth, lower crown teeth, face dogs, square fit, and click spring are
  educational approximations rather than manufacturing involute/bevel geometry.
- The compound crown-wheel layout is a mechanically explanatory teaching model;
  tooth strength, bearing loads, lubrication, and tolerances are not solved.
- The ratchet/freewheel and reserve model is kinematic. It does not simulate
  elastic torque, backlash, click impact, spring hysteresis, or overwind slip.
- Interference checks use conservative Object3D-following envelopes rather than
  CAD solid contact analysis.
- The A.2 minimal-parts policy remains: omitted setting levers, yoke, jumper, and
  their force constraints are not reintroduced.
