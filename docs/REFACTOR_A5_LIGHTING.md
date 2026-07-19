# Refactor A.5 two-sided lighting

## Rig

The movement stays in the A.4 world frame. Lighting is arranged around the
fixed model and one low-intensity fill follows the camera:

| Light | Type | Intensity | Position / parent | Purpose |
| --- | --- | ---: | --- | --- |
| `baseHemisphere` | Hemisphere | 0.95 | scene | Low/mid base illumination |
| `frontKey` | Directional | 1.96 | `[18, -34, 24]` | Negative-Y dial front |
| `backKey` | Directional | 1.70 | `[-16, 35, 21]` | Positive-Y movement back |
| `sideRim` | Directional | 0.58 | `[-30, -2, -19]` | Edge separation |
| `cameraFill` | Point | 0.38 | camera child | Prevent crushed blacks during free rotation |

The front and back directional lights share the fixed aim `[0, 0.5, 0]` but
are intentionally not exact mirrors. The key ratio is 1.153. Camera fill is
19.4% of the stronger key, so it remains subordinate and does not flatten the
metal shading.

The existing theme system still changes only background, fog, and exposure.
No theme swaps lights or changes a mechanism material.

## Framebuffer measurement

`getFrontBackLuminanceReport({ themes: "all" })` renders the front and back at
the same theme exposure and reads the active WebGL framebuffer. It samples a
central ellipse, removes pixels within RGB distance 10 of the clear color, and
reports sRGB luma, dark-pixel ratio, clipped-pixel ratio, and sample count.

| Theme | Front | Back | Difference | Front dark | Back dark |
| --- | ---: | ---: | ---: | ---: | ---: |
| Navy | 0.13537 | 0.15834 | 14.51% | 3.59% | 0.03% |
| Obsidian | 0.12679 | 0.16278 | 22.11% | 1.67% | 0.02% |
| Walnut | 0.11822 | 0.15370 | 23.08% | 2.95% | 0.06% |
| Gallery | 0.09230 | 0.12221 | 24.48% | 3.96% | 0.18% |

All four themes remain below the requested 30% front/back difference. The
largest clipped ratio in the same samples is below 0.02%, leaving metal value
and roughness differences visible.

## Evidence

The ten requested lighting directions and comparison sheets are indexed in
[evidence/refactor-a5/README.md](evidence/refactor-a5/README.md). The A.4 front
capture is retained as the before image rather than being overwritten.
