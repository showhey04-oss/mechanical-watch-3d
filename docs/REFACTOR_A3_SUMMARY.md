# Refactor A.3 implementation and verification summary

## Outcome

Refactor A.3 replaces the A.2 split normal/setting drivers with one bidirectional
motion-work graph. The cannon pinion, minute wheel, hour wheel, and permanent
setting train now use module-derived pitch geometry. In position 1 the setting
transfer remains driven from the display train while the setting-input clutch is
detached. In position 2 the crown drives the same permanent graph in reverse and
the cannon friction fit slips without backdriving the centre/fourth train.

The full connection diagram and ratio tables are in
[REFACTOR_A3_TOPOLOGY.md](REFACTOR_A3_TOPOLOGY.md).

## Gear geometry

The authoritative input is the mesh module and tooth count:

```text
pitch radius = module × tooth count / 2
pitch diameter = module × tooth count
centre distance = input pitch radius + output pitch radius
```

Two module families are used.

- `0.08125`: cannon 12, minute wheel 36, setting wheel 2/1 32, setting transfer 18
- `0.078`: minute pinion 10, hour wheel 40

This gives the required direct 12/36 and 10/40 meshes at the same 1.95 centre
distance. The five motion-work meshes also carry pressure-angle/tooth-profile,
phase, centre-distance, and axial-band metadata. Static and real-Object3D phase
tests cover forward and reverse increments rather than checking the initial pose
only.

## Unified kinematics

`resolveMotionWorksState()` evaluates the active permanent and conditional
connections from the current source. `applyMotionWorksState()` writes the result
to the real Three.js objects. The previous `applyDisplayKinematics()` and
`applyKinematicState()` paths were removed.

Permanent connections:

```text
centre --friction/slip--> cannon <-> minute <-> hour
                                  <-> setting 2 <-> setting 1 <-> transfer
fourth arbor ---------------------------------------------> seconds hand
cannon tube ----------------------------------------------> minute hand
hour pipe ------------------------------------------------> hour hand
```

Conditional connections:

```text
position 1: crown -> stem -> sliding clutch -> winding clutch
position 2: crown -> stem -> sliding clutch -> setting input -> setting transfer
```

The disconnection is therefore exactly the setting-input/setting-transfer clutch
boundary. Position 1 does not freeze the permanent setting wheels.

## State transitions and source isolation

- Entering position 2 captures a clutch engagement offset, so the current
  setting-transfer, motion-work, and hand angles do not jump.
- Returning to position 1 captures a cannon friction/slip offset. The newly set
  hand position continues from the running train without snapping back.
- The setting source cannot traverse the non-backdrivable centre/cannon friction
  link. The centre, fourth arbor, and seconds hand stay stopped in position 2.
- Positive crown input advances the hands clockwise by using a `-1` cross-axis
  setting-clutch ratio and a negative running centre angle.
- Explicit time input updates the same resolver state, including the fourth arbor
  and all three hands. Live time sync captures a wall-clock offset at ON and
  removes it through a bounded 1.5-second smooth transition, so both ON and OFF
  preserve the current angles instead of jumping to a second driver.

## Physical hand coupling

The floating train-side display was moved to the dial side. The A.3 geometry now
contains:

- a cannon tube ending at the minute-hand boss;
- an outer hour pipe ending at the hour-hand boss;
- a fourth-arbor extension ending at the seconds-hand boss.

At the assembled pose the actual geometry endpoint of each tube/arbor and the
corresponding hand-boss centre have world-space distance `0`. The hand Object3D
angle is always its source angle plus one fixed assembly offset;
`watchTimeSec` no longer assigns hand rotations. The absolute assembly phases
also place all three hands at twelve o'clock for a zero train-time input.

## Diagnostics

`window.watchModelDiagnostics` now exposes:

- `getMotionWorksTopology()`
- `getMotionSource()`
- `getPermanentMeshAngles()`
- `getClutchConnectionState()`
- `getHandCouplingReport()`
- `getGearModuleReport()`
- `getStateTransitionContinuityReport()`
- expanded `getPartRotations()` data for tubes, pipes, arbors, permanent setting
  wheels, clutch objects, and hands

## Verification

### Static Node tests

Command:

```text
node --test tests/*.test.mjs
```

Result: **17/17 passed**.

The tests cover module-derived radii/diameters, all centre distances and axial
bands, the shared compound centre distance, dynamic forward/reverse phase
residuals, complete connection metadata, position-1 backdrive, the setting slip
boundary, reciprocal ratios, transition reference capture, rigid hand coupling,
single-writer source inspection, interference configuration, selection helpers,
and camera stability.

### Real browser / Three.js integration

The local page was served over HTTP and loaded in the real in-app browser with
`?browserTest=1`. Result: **39/39 passed**.

Measured results:

| Measurement | Result |
| --- | ---: |
| Position 1 forbidden 3D intersections | 0 |
| Position 2 forbidden 3D intersections | 0 |
| Maximum rendered centre-distance error | 4.44 × 10^-16 |
| Maximum rendered module mismatch | 0 |
| Maximum hand/source angular coupling error | 1.65 × 10^-13 rad |
| Maximum source/hand mount distance | 0 |
| Wind → set permanent-angle jump | 1.42 × 10^-14 rad |
| Set → wind permanent-angle jump | 0 rad |
| Live-sync ON / OFF angle jump | 0 / 0 rad |
| Live-sync current-time error after transition | 0.006 s |
| Transparent-structure selected part | setting wheel 2 |

The browser test additionally verifies:

- position 1 rotates cannon/minute/hour, all three permanent setting wheels,
  fourth arbor, and all three hands;
- display backdrive does not rotate crown, stem, sliding clutch, setting input, or
  winding clutch;
- winding rotates only the winding input branch while the permanent setting train
  retains the display ratios;
- position 2 works in both directions, stops centre/fourth/seconds, and does not
  backdrive the main train;
- all five actual Object3D mesh phase residuals remain within tolerance in normal
  and setting motion;
- explicit time input and live sync retain exact hand/source coupling;
- explicit time input places minute, hour, and seconds hands at their absolute
  dial angles, including the hour-hand assembly phase;
- explicit time input while position 2 is active updates the held seconds and
  returns to position 1 without moving the centre/main train at the transition;
- live sync reaches current time after its bounded transition while preserving
  zero-jump ON/OFF state changes;
- the fourth wheel and escape pinion counter-rotate after the running-angle sign
  change;
- the real cannon-tube, hour-pipe, and fourth-arbor endpoints contact their hand
  bosses in the Object3D envelope report;
- Raycaster selection through a transparent structure still selects setting
  wheel 2, and diagnostic geometry remains unpickable.

## Browser evidence

Fourteen JPEG screenshots captured from the verified WebGL build are indexed in
[evidence/refactor-a3/README.md](evidence/refactor-a3/README.md).

## Remaining limitations

- The tooth profile, pressure angle representation, face dogs, and crown clutch
  remain educational approximations rather than manufacturing geometry.
- The centre/cannon friction fit is represented by a kinematic slip offset; torque,
  elastic preload, wear, and stick-slip are not physically simulated.
- The setting lever, yoke, jumper, and their spring-force constraints remain
  intentionally omitted under the A.2 minimal-part policy. Crown position still
  controls the sliding-clutch translation directly.
- Interference checks use conservative Object3D-following envelopes, not CAD
  solid contact analysis.
- The detailed winding transmission beyond the compact winding clutch remains an
  educational separation of the existing crown and ratchet wheels.
