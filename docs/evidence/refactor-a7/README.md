# Refactor A.7 evidence index

## Recorded artifacts

| Artifact | Purpose |
| --- | --- |
| `coordinate-report.json` | Exact desktop and 390 × 844 diagnostic results, including holds, cycles, frame-rate finals, interference, and A.6 performance regression |
| `keyless-endpoints.svg` | Diagnostic visualization of the measured position-1 and position-2 local X endpoints |

The desktop run executed the real Three.js browser integration suite and passed
86/86 checks. Its position-2 hold observed 600 real animation frames over
9.999 seconds; all three final coordinates matched the absolute expected values,
and each coordinate had a zero-width range over the final 300 frames.

The direct 390 × 844 run passed all 9/9 A.7 checks and 87/88 checks overall.
The only failure was the unchanged A.5 luminance reliability guard: the Walnut
front sample contained 977 foreground samples while the test requires more than
1000. The actual lighting criterion still passed, with every theme inside 30%
and a worst front/back difference of 12.43%. The expectation was not weakened.

These browser values were captured before the final diagnostic-only audit
changes. Those later edits made the geometry getter read-only, restored the
caller's principal state after the cycle test, and removed a default empty
object allocation; the absolute placement writer and browser test thresholds
were unchanged. Localhost browser access was subsequently blocked, so the
post-audit source was checked with Node 33/33, inline-module syntax validation,
JSON/SVG validation, and `git diff --check`, not claimed as a second browser run.

The accelerated hold confirms finite selection-light coordinates and intensity.
It did not independently measure selected-part `Box3` center tracking, which is
retained as an explicit evidence limitation.

## Capture constraint

The in-app browser security policy blocked the final mobile-harness inspection
and any further localhost screenshot or video capture. The run did not switch to
another browser, raw browser protocol, or an indirect capture method. Therefore,
this directory contains measured coordinate evidence and an explicitly labeled
diagnostic SVG, but no newly claimed A.7 WebGL screenshot or video. Existing A.6
and A.5 captures remain regression references only and are not relabeled as A.7
evidence.
