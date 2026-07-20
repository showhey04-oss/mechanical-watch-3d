# Refactor A.5 implementation and verification summary

## Outcome

Refactor A.5 changes only presentation and navigation. It supplies balanced
negative-Y/positive-Y lighting, a low camera-follow fill, and unrestricted
Arcball camera navigation while leaving A.4 mechanism geometry, signs,
kinematic graphs, interference envelopes, and world coordinates unchanged.

Detailed references:

- [REFACTOR_A5_LIGHTING.md](REFACTOR_A5_LIGHTING.md)
- [REFACTOR_A5_CAMERA_CONTROLS.md](REFACTOR_A5_CAMERA_CONTROLS.md)
- [evidence/refactor-a5/README.md](evidence/refactor-a5/README.md)

## Implementation boundaries

The camera is the only user-rotated object. `root` and the mechanism groups are
not placed under a turntable and receive no navigation rotation. Presets have
one `VIEW_UP = [0, 0, 1]` convention and no private `up` fields. Reset restores
the dial front and the central `[0, 0.5, 0]` focus.

Lighting consists of a restrained hemisphere base, independent front/back
keys, a side rim, and a point fill parented to the camera. The fill/key ratio is
0.194. All background themes continue to alter only background, fog, and
exposure.

## Verification

Final automated results:

| Suite | Result |
| --- | ---: |
| Node static/configuration tests | 22/22 |
| Desktop real-browser integration | 73/73 |
| A.4 checks inside desktop run | 60/60 |
| Direct 390 × 844 browser integration | 75/75 |
| Position-1 / position-2 forbidden interference | 0 / 0 |
| Background themes within 30% front/back luminance | 4/4 |
| UI presets accepting free rotation | 10/10 |

The horizontal test completed 1.08 turns, upward 1.08 turns, and downward 1.02
turns. All reached valid orientations with the complete model-world signature
unchanged. The recorded browser animations extend to 1.20 turns. Repeated
native pointer drags accumulated 1.108 turns of quaternion travel; native
wheel/trackpad-equivalent input reduced camera distance from 60.039456 to
44.092440 without selecting a part.

All A.4 winding, freewheel, position-2 isolation, energy, hand coupling,
clockwise screen-direction, transparency, selection, and background checks
remain in the integration suite with their expectations unchanged.

## Remaining constraint

The execution environment provided desktop browser input and a direct
390 × 844 viewport, but no attached physical iPhone. Real-device iPhone Safari
testing is therefore not claimed. The automated touch path and responsive
viewport pass are committed as reproducible coverage for that follow-up.
