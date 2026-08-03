# Final Stabilization Phase 3B.4c-R2.2 evidence

- Source base: `d6718e59a2438152a4a203fa579b66ce6e91ecd3`
- Source start: `8fa4d6e9dd70cbaf32fd26b75ec17b0cabe73484`
- Source implementation: `2010a862a7db7730154be28affee94c9419f7905`
- Branch: `feature/final-stabilization-phase3b4c-ios-audio-pacing`
- APP_VERSION: `v3.15.0`
- Capture: same-origin unsandboxed iframe harness with actual Web Audio
- Desktop app viewport: 1280×720
- Mobile app viewport: 390×844

## Result

`PHASE3B4C_R2_2_AUTOMATED_OUTPUT_LIVENESS_GATE_PASSED`.
The false-positive state where AudioContext is running but no new source/output progress is
observed is rejected. A foreground recovery cycle claims one scheduler re-anchor, verifies
clock/output/source/gain progression, and only then permits the ON UI. A single explicit
speaker-control activation recovered the automated harness without an OFF/ON cycle.

`PHASE3B4C_R2_2_PHYSICAL_IPHONE_RETEST_REQUIRED` remains in force. Codex Browser events
report `isTrusted=false`, and JavaScript cannot prove that a physical iPhone speaker emitted
sound. The physical sleep/home/app return test must confirm automatic recovery or recovery by
one speaker tap, with no second tap and no green-ON-but-silent state.

## Captures

- `captures/desktop-harness-outer.jpg`
- `captures/mobile-390x844-harness-outer.jpg`

The mobile PNG records the outer in-app Browser. The fixed 390×844 app viewport is recorded
by the same-origin iframe report in `actual-web-audio.json`.

## Reports

The reports preserve the Human R2.1 failure, recovery state machine, trusted-gesture race,
running false positive, pipeline liveness, bounded hard recovery, scheduler generation,
source inventory, UI timeline, actual Web Audio, performance, protected paths, regression,
and decision. The closed-world manifest excludes itself.
