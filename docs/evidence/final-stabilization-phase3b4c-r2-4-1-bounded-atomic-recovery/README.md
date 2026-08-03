# Final Stabilization Phase 3B.4c-R2.4.1 evidence

- Base: `d6718e59a2438152a4a203fa579b66ce6e91ecd3`
- Start: `b3393972f3f25f2c4aef75eb2274eabddc17b575`
- Implementation: `0ba6348e9b8bf6ec333ae0f4979a4e8a86d4239c`
- Branch: `feature/final-stabilization-phase3b4c-ios-audio-pacing`
- APP_VERSION: `v3.15.0`

## Result

The P3 fresh-Context fallback is now one bounded transaction. Per-asset decode, transaction-wide completion, candidate cleanup, and old-Context cleanup all have explicit bounds. The candidate must decode six assets and prove `RUNNING_AND_ADVANCING` before one atomic graph commit. Scheduler re-anchor, legacy reset, gain, and UI recovery follow that commit only.

Installed Chrome and Playwright WebKit actual Web Audio each passed the 1280×720 and 390×844 matrices: 100 visibility cycles plus 30 cycles each for fresh success, decode timeout, close timeout, and stale completion. A real trusted click was used for each fresh recovery. Console error/warning/runtime error/unhandled rejection counts were zero.

Node is 433/433, including 17 core R2.4.1 contract tests and 5 evidence tests. The prior R2.4 browser and pointer/wheel evidence is retained explicitly as inherited evidence because this change does not modify rendering, geometry, camera, or the render loop; it is not described as a new absolute A.6 run. Thresholds and APP_VERSION are unchanged.

Independent review ended at critical 0, major 0, minor 0. Native Safari automation remains blocked, Playwright WebKit is not treated as a substitute, and physical iPhone retest remains frozen. No Human URL or instructions are included. This Draft evidence does not authorize Ready, merge, default adoption, Issue #2 closure, or Phase 3B.4d.

The manifest is closed-world and excludes itself.
