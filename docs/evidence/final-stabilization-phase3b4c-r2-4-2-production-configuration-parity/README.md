# Final Stabilization Phase 3B.4c-R2.4.2 evidence

This evidence package separates the unchanged application defaults from the short timeout profile used for fault-heavy diagnostics.

- `PRODUCTION_TIMEOUT_PROFILE`: 450 / 80 / 1,200 / 250 / 5,500 ms. The production matrices do not call `setAudioPlatformRecoveryTimeoutsForTest()`.
- `TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE`: 450 / 80 / 300 / 50 / 1,500 ms. This is diagnostic-only and is not production acceptance evidence.
- Installed Chrome and Playwright WebKit each ran both 1280×720 and 390×844. Each runtime/profile matrix contains 18 conditions and 400 cycles. Across both profiles and runtimes the package contains 72 conditions and 1,600 cycles.
- Every condition records `productionTimeoutProfile`, `tightDiagnosticTimeoutProfile`, and `profileActuallyUsedForEachTest`.
- All transactions ended recovered or in an explicit failure state; unresolved Promise, incomplete 6-asset buffer/raw inventory, duplicate, backlog, catch-up, console error/warning/runtime error, and unhandled rejection counts are zero.

R2.4.1’s 300 / 50 / 1,500 ms browser results are retained as historical evidence but are classified here as `TIGHT_DIAGNOSTIC_TIMEOUT_PROFILE`, not as proof of unchanged production defaults. The R2.4.1 fresh-Context transaction implementation is unchanged.

Native Safari automation remains blocked by the environment. Playwright WebKit is not treated as a Native Safari substitute, and physical iPhone/Human retest remains frozen. No Human URL or test instructions are included.
