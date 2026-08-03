# Final Stabilization Phase 3B.4c-R2.3 evidence

- Known-good lifecycle: `90e14647190156d040fbd4aee1e74bf38c3442b3`
- Source base: `d6718e59a2438152a4a203fa579b66ce6e91ecd3`
- Source start: `48ec7b73c207bf5a784663f70199ec8f4f1465d8`
- Source implementation: `ebf69a258ad93bb3d4f326c07aea9ee4cca2d515`
- Branch: `feature/final-stabilization-phase3b4c-ios-audio-pacing`
- APP_VERSION: `v3.15.0`

## Result

R2.2 passed its automated liveness gate but failed physical-iPhone output recovery. R2.3
removes the R2.2 foreground recovery state machine and restores visibility-owned resume,
suspend, gain, source, and Context lifetime behavior. The only product deltas from the
v3.14 known-good lifecycle are current-scheduler re-anchoring, one bounded speaker fallback
after automatic failure, and a query-only compact trace.

Chromium and WebKit passed 100 hidden/visible cycles at 1280×720 and 390×844. Page,
blur, and focus events remained diagnostic-only. Context generation remained one, buffers
were not reloaded, and duplicate/backlog counts remained zero. Three-repetition A/B
performance medians passed the unchanged differential limits.

The full browser suite retains five common D2c3/A.6 environment failures on both the R2.2
start Head and R2.3, plus three common desktop keyboard/layout failures in the in-app
Browser. R2.3-specific failures are zero. Mobile UI 22/22, HUD 57/57, and audio 23/23 pass.

Physical iPhone retest remains frozen. This package does not include a Human test URL or
instructions, does not claim physical audibility, and does not authorize Ready, merge,
default adoption, Issue #2 closure, or Phase 3B.4d.

The closed-world manifest excludes itself.
