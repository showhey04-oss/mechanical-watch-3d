# Refactor A.4 dial-front and clockwise convention

## Coordinate frame

Refactor A.4 changes semantic orientation, not physical layering.

| Meaning | Vector / location |
| --- | --- |
| dial-side location | negative Y |
| movement-side location | positive Y |
| watch-front normal | `[0, -1, 0]` |
| twelve-o'clock / screen up | `[0, 0, 1]` |
| three-o'clock / screen right | `[1, 0, 0]` |
| clockwise Y-rotation sign | `+1` |

The basis is unit length and orthogonal. `right × up = front normal`, so it is a
single explicit right-handed watch-front frame.

## Camera semantics

| UI / alias | Camera side | Semantic meaning |
| --- | --- | --- |
| reset, front, dialFront | negative Y | watch front / dial front |
| back, movementBack | positive Y | movement back |
| dialMechanism | negative-Y oblique | dial-side mechanism |
| movementMechanism | positive-Y oblique | movement-side mechanism |
| winding | negative-Y oblique | winding transmission close view |

The default startup and reset both select `reset`. Its fitted distance keeps the
outer dial ring and all four cardinal markers inside the viewport. Camera preset
changes only camera position, target, and up; model world position, quaternion,
scale, and matrix signatures are unchanged.

The UI uses the semantic names “表面・文字板”, “裏面・ムーブメント”,
“文字板側機構”, “ムーブメント側機構”, and “巻上げ伝達”. “Front” no longer
means positive Y.

## Clockwise kinematics

The hand geometry is authored along local `+X`. A fixed assembly phase of
`-π/2` places it at world `+Z` (twelve o'clock) for zero display input. Increasing
positive Y rotation then moves the hand from `+Z` to `+X`, which is twelve to
three when seen from the negative-Y watch front.

The direction is fixed at the source:

- the running train angle uses `CLOCKWISE_ROTATION_SIGN`;
- the same permanent motion-work graph propagates normal and setting motion;
- positive position-2 crown input advances the display clockwise;
- the fourth wheel and escape pinion retain their external-mesh counter-rotation;
- no hand receives an extra negation or a direct `watchTimeSec` write.

## Rigid source-to-hand constraints

| Driver | Hand | Constraint |
| --- | --- | --- |
| cannon tube | minute hand and boss | rigid 1:1 plus fixed assembly phase |
| hour pipe | hour hand and boss | rigid 1:1 plus fixed assembly phase |
| fourth-arbor dial extension | small-seconds hand and boss | rigid 1:1 plus fixed assembly phase |

The actual driver endpoint and hand-boss centre coincide at distance `0` for all
three pairs. Across normal running, position-2 setting, explicit time, live sync,
front/back camera changes, and cardinal-time samples, the maximum measured
angular coupling error is `1.65 × 10^-13 rad`.

## Real-screen verification

The browser integration test projects the real Three.js pivots, hand tips, and
named dial markers into screen coordinates.

| Sample | Expected and measured result |
| --- | --- |
| 12:00:00 | minute, hour, and small seconds point to screen up |
| 12:15:00 | minute hand screen angle is `+π/2` (right) |
| 03:00:00 | hour hand screen angle is `+π/2` (right) |
| seconds 00/15/30/45 | up/right/down/left |
| seconds 05 -> 10 | screen angle increases `0.314014 -> 0.772371 rad` |
| minute 05 -> 10 minutes | screen angle increases by `+0.458356 rad` |
| hour 01 -> 02 hours | screen angle increases by `+0.458356 rad` |
| front -> back at 12:15 | apparent minute angle changes `+π/2 -> -π/2` |
| front -> back Object3D angle | unchanged |
| position-2 positive input | display time increases and minute/hour screen angles advance clockwise |

`getFrontConvention()`, `getDialProjectionReport()`, and
`getHandScreenDirectionReport()` expose the same measurements for manual or
automated inspection.

## Evidence

The exact front-time series, small-seconds sequence, and front/back pair are
indexed in [evidence/refactor-a4/README.md](evidence/refactor-a4/README.md).
