const SAME = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function runDialHandCandidateIntegrationTest(diagnostics) {
  const checks = [];
  const check = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  const report = diagnostics.getDialHandCandidateDiagnostics();
  const expected = {
    h0: [10.3, 7.2],
    h1: [13.3, 9.2],
    h2: [14.0, 10.0],
    h3: [14.4, 10.6],
  }[report.candidate.id];

  check("phase2a-schema-and-query-resolver", report.schemaVersion === 1
    && ["h0", "h1", "h2", "h3"].includes(report.candidate.id)
    && report.candidate.adopted === false, report.query);
  check("phase2a-geometry-lengths-match-resolved-candidate", SAME([
    report.candidate.minuteHandLength,
    report.candidate.hourHandLength,
  ], expected) && SAME(report.geometryLengths, {
    minute: expected[0],
    hour: expected[1],
    smallSecond: 3.8,
  }), report.geometryLengths);
  check("phase2a-fixed-dial-and-small-seconds-values", report.fixedDimensions.indexCircleRadius === 14.8
    && report.fixedDimensions.dialRingRadius === 16.1
    && report.fixedDimensions.smallSecondHandLength === 3.8, report.fixedDimensions);
  check("phase2a-finite-geometry", Object.values(report.geometry).every(({ finite, vertexCount }) => finite && vertexCount > 0), report.geometry);
  check("phase2a-hand-tips-remain-inside-dial-ring", report.ratios.minuteTipInsideDialRing
    && report.ratios.hourTipInsideDialRing
    && ["minute", "hour"].every((id) => report.hands[id].tipInsideDialRing), report.hands);
  check("phase2a-screen-tip-coordinates-are-finite", ["minute", "hour"].every((id) => [
    ...report.hands[id].pivot.screen,
    ...report.hands[id].tip.screen,
  ].every(Number.isFinite)), report.hands);
  check("phase2a-screen-visibility-and-line-width-are-measured", ["minute", "hour"].every((id) =>
    Number.isFinite(report.hands[id].lineWidthPx)
    && report.hands[id].lineWidthPx > 0
    && Number.isFinite(report.hands[id].tipToIndexPx)
    && typeof report.hands[id].discernible === "boolean"), report.hands);
  check("phase2a-three-hand-one-to-one-coupling", report.coupling.length === 3
    && report.coupling.every(({ error, mountDistance }) => Math.abs(error) < 1e-7 && mountDistance < 1e-6), report.coupling);
  check("phase2a-pivots-and-transforms-are-invariant", report.invariants.transformsUnchanged
    && report.invariants.pivotsUnchanged
    && report.invariants.scalesUnchanged, report.invariants);
  check("phase2a-diagnostic-does-not-change-camera-or-state", report.invariants.cameraUnchanged
    && report.invariants.stateUnchanged, report.invariants);
  check("phase2a-no-runtime-switching-or-backlog", report.runtimeFootprint.queryOnly
    && report.runtimeFootprint.runtimeSwitchingSupported === false
    && report.runtimeFootprint.animationLoopCalls === 0
    && report.runtimeFootprint.backlogEvents === 0, report.runtimeFootprint);
  check("phase2a-decision-remains-non-adopted", [
    "REJECT",
    "RETAIN_FOR_REVIEW",
    "PROVISIONAL_RECOMMENDATION",
  ].includes(report.candidate.decision) && report.candidate.decision !== "ADOPTED"
    && report.humanConfirmationRequired === true, report.candidate);

  return {
    ok: checks.every(({ ok }) => ok),
    checks,
    report,
  };
}
