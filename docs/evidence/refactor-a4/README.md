# Refactor A.4 browser evidence

These JPEG files were captured from the real in-app browser/WebGL build served at
`http://127.0.0.1:8000/`. The page was not replaced by a mock renderer. Numerical
Object3D rotation, contact, interference, projection, coupling, and selection
checks are recorded in [REFACTOR_A4_SUMMARY.md](../../REFACTOR_A4_SUMMARY.md).

The final automated runs passed **20/20 static tests** and **60/60 real-browser
checks**. Representative browser measurements were:

- forward pinion/crown/ratchet/arbor increments:
  `+1.73264 / +0.43316 / -0.288773 / -0.288773 rad`;
- maximum winding-ratio error: `2.78 × 10^-17` (dimensionless);
- pitch-contact, centre-distance, axial-band, and ratchet/arbor errors: `0`;
- position-1 and position-2 forbidden intersections: `0 / 0`;
- reverse ratchet/arbor and reserve change: `0 / 0 rad`, `0 h`;
- maximum hand/source angular error: `1.65 × 10^-13 rad`, mount distance `0`;
- maximum rigid going/display-train speed difference with and without winding:
  `1.96 × 10^-13 rad/s` (escape impulse average difference `6.26 × 10^-4 rad/s`);
- front clockwise screen delta for seconds, minute, and hour hands:
  `+0.458356 / +0.458356 / +0.458356 rad`;
- all seven sampled winding-path targets, including the mainspring endpoint,
  resolved to the requested real part in winding-display mode.

| File | Evidence |
| --- | --- |
| `01-default-dial-front.jpg` | Unmodified startup opens on the negative-Y dial front |
| `02-movement-back.jpg` | Explicit positive-Y movement-back view |
| `03-winding-pinion-crown-orthogonal.jpg` | Selected short X-axis pinion contacting the lower crown teeth at 90 degrees |
| `04-crown-ratchet-mesh.jpg` | Close view of the upper crown gear meshing with the ratchet wheel |
| `05-position1-forward-before.jpg` | Position-1 forward-winding initial state |
| `06-position1-forward-after.jpg` | Position-1 `+68%` input after relative wind and reserve increase |
| `07-position1-reverse-freewheel.jpg` | Position-1 `-68%` input with the one-way downstream path held |
| `08-position2-winding-disconnected.jpg` | Position-2 clutch translation and winding-boundary disconnection |
| `09-time-120000.jpg` | Dial front at 12:00:00; all hands point to twelve |
| `10-time-121500.jpg` | Dial front at 12:15:00; minute hand points to three |
| `11-time-030000.jpg` | Dial front at 03:00:00; hour hand points to three |
| `12a-small-seconds-00.jpg` | Small seconds at 00 seconds / twelve |
| `12b-small-seconds-15.jpg` | Small seconds at 15 seconds / three |
| `13a-clockwise-00s.jpg` | Continuous front sequence, 00 seconds |
| `13b-clockwise-05s.jpg` | Continuous front sequence, 05 seconds |
| `13c-clockwise-10s.jpg` | Continuous front sequence, 10 seconds |
| `13d-clockwise-15s.jpg` | Continuous front sequence, 15 seconds |
| `14a-front-direction.jpg` | 12:15 Object3D pose from the dial front |
| `14b-back-direction.jpg` | Same 12:15 Object3D pose from the movement back; apparent direction is mirrored |

The paired winding screenshots use identical startup conditions. The automated
browser run supplies the stateful before/after proof: reserve increased from
`25.99686 h` to `27.12307 h` in the primary forward sample. After the additional
second tooth-phase sample it remained exactly `27.37795 h` throughout reverse
freewheel. An explicit 23:59:59 -> 00:00:01 change also kept that exact reserve,
proving that a wrapped barrel-drum angle is not counted as winding. The
front/back integration check likewise compares identical world
position, quaternion, scale, and matrix signatures rather than relying only on
the screenshots.

This directory contains real-browser captures for the winding transmission and
dial-front convention. The final capture index and measured checks are recorded
after the automated browser run.
