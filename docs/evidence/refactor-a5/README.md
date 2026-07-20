# Refactor A.5 browser evidence

All captures come from the real Three.js/WebGL page served locally in the
in-app browser. The model renderer was not replaced by a mock. The desktop run
passed **73/73** browser checks, including all **60/60** A.4 regressions. A
second run at a direct **390 × 844** browser viewport passed **75/75** checks.

## Lighting captures

The first ten PNGs use the production light rig. Files 01–09 use the navy
theme and its single exposure value; file 10 uses the gallery theme.

| File | Evidence |
| --- | --- |
| `01-front-dial-navy.png` | Negative-Y dial front |
| `02-back-movement-navy.png` | Positive-Y movement back |
| `03-left-side-navy.png` | Left edge with camera-follow fill |
| `04-right-side-navy.png` | Right edge with camera-follow fill |
| `05-upper-oblique-navy.png` | Upper movement oblique |
| `06-lower-oblique-navy.png` | Lower dial-side oblique |
| `07-dial-works-lighting.png` | Cannon/minute/hour and setting works |
| `08-winding-works-lighting.png` | Winding pinion/crown/ratchet path |
| `09-transparent-internals-lighting.png` | Internal parts through 16% structural opacity |
| `10-front-dial-gallery.png` | Dial front on the light gallery theme |

`17-before-after-front-comparison.jpg` pairs the A.4 front capture with the A.5
front capture. `18-front-back-sides-comparison.jpg` shows four directions at
the same navy exposure.

The WebGL framebuffer measurements were:

| Theme | Front luminance | Back luminance | Relative difference |
| --- | ---: | ---: | ---: |
| Navy | 0.13537 | 0.15834 | 14.51% |
| Obsidian | 0.12679 | 0.16278 | 22.11% |
| Walnut | 0.11822 | 0.15370 | 23.08% |
| Gallery | 0.09230 | 0.12221 | 24.48% |

The worst front/back difference is **24.48%**, below the 30% acceptance
target. The highest sampled dark-pixel ratio is 3.96%; clipping is below 0.02%.

## Rotation and input evidence

| File | Evidence |
| --- | --- |
| `11-horizontal-front-back-front-1.2turn.gif` | 21-frame browser animation, 1.20 turns in one direction, front → back → front |
| `12-vertical-pole-crossing-1.2turn.gif` | 20-frame browser animation, 1.20 turns through both vertical poles |
| `13-native-pointer-repeated-drag.gif` | Repeated same-direction native browser drags; cumulative camera-quaternion travel 1.108 turns |
| `14-mobile-390x844.png` | Direct 390 × 844 viewport |
| `15-mobile-touch-rotate-zoom-pan.gif` | One-finger pointer rotation followed by two-finger zoom/pan at 390 × 844 |
| `16-selection-after-native-rotation.png` | One internal part selected after a native Arcball drag |

The automated control-API runs completed 1.08 horizontal turns, 1.08 upward
turns, and 1.02 downward turns without a hard stop, non-finite camera value, or
model-world transform change. The vertical sample's front-normal dot traversed
from `+0.999963` to `-0.998527` and returned to the front. Native pointer drags
kept selection at “none”; the following single click selected exactly one
internal part. Native wheel/trackpad-equivalent input changed camera distance
from `60.039456` to `44.092440` without changing camera orientation.

The 390 × 844 run covers one-finger rotate, two-finger zoom and pan, multi-touch
selection suppression, post-rotation tap suppression, and continued control
after opening and closing the panel. A physical iPhone was not available to
this execution environment; that manual device check remains the only device
limitation.
