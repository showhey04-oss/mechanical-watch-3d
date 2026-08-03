# Final Stabilization Phase 3B.4c-R2.1 evidence

- Source base: `36cccd8f135e257f20da84d1d60957ae22472e72`
- Source implementation: `42516a8b5c98507b11a1ae40679f99cf8abb0e0a`
- Branch: `feature/final-stabilization-phase3b4c-ios-audio-pacing`
- APP_VERSION: `v3.15.0`
- Capture: same-origin unsandboxed iframe harness with actual Web Audio
- Desktop: 1280×720
- Mobile: 390×844

## Result

Deterministic and actual-browser technical gates passed for timeline discontinuity recovery,
verified AudioContext state recovery, source inventory, UI state, R1.1 phase coupling, and R2
foreground timebase preservation. The physical iPhone R2.1 recovery retest remains pending.
Codex Browser automation exposes `isTrusted=false`; therefore this evidence does not replace
the required physical-iPhone single trusted gesture check.

## Captures

- `captures/desktop-1280x720.png`
- `captures/mobile-390x844.png`

## Reports

The `reports/` directory contains the Human R2 result, time discontinuity timelines,
old/new beat identity, scheduler no-op reasons, AudioContext transitions, automatic and
trusted recovery, UI state, source inventory, lifecycle ordering, R2/R1.1 regressions,
actual Web Audio, performance, protected paths, regression status, and decision summary.
The closed-world manifest excludes itself and records every other evidence artifact.
