const SAME = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function runDialDisplayScaleIntegrationTest(diagnostics) {
  const checks = [];
  const check = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  const report = diagnostics.getDialDisplayScaleDiagnostics();
  const expected = {
    s100: [1, 32.2, 29.6, 14, 10, 9, 3.8],
    s92: [0.92, 29.624, 27.232, 12.88, 9.2, 8.28, 3.496],
    s86: [0.86, 27.692, 25.456, 12.04, 8.6, 7.74, 3.268],
    s80: [0.8, 25.76, 23.68, 11.2, 8, 7.2, 3.04],
    baseline: [null, 32.2, 29.6, 10.3, 7.2, 9, 3.8],
  }[report.candidate.id];

  check("phase2b-schema-query-and-non-adoption", report.schemaVersion === 1
    && report.candidate.adopted === false && report.humanConfirmationRequired, report.query);
  check("phase2b-resolved-dimensions", SAME([
    report.candidate.scale, report.geometryDimensions.dialRingDiameter,
    report.geometryDimensions.indexCircleDiameter, report.geometryDimensions.minuteHandLength,
    report.geometryDimensions.hourHandLength, report.geometryDimensions.smallSecondRingDiameter,
    report.geometryDimensions.smallSecondHandLength,
  ], expected), report.geometryDimensions);
  check("phase2b-h2-ratios-preserved-without-adoption", report.phase2aBasis.candidate === "h2"
    && report.phase2aBasis.absoluteValuesAdopted === false
    && (report.candidate.active
      ? report.phase2aBasis.reachRatiosPreserved
        && report.metrics.minuteToIndexRadius === 0.945946
        && report.metrics.hourToIndexRadius === 0.675676
        && report.metrics.hourToMinuteLength === 0.714286
      : report.phase2aBasis.active === false
        && report.metrics.minuteToIndexRadius === 0.695946
        && report.metrics.hourToIndexRadius === 0.486486), report.metrics);
  check("phase2b-finite-geometry", report.checks.finiteGeometry
    && Object.values(report.geometry).every(({ finite, vertexCount }) => finite && vertexCount > 0), report.geometry);
  check("phase2b-no-dial-ring-protrusion", report.checks.dialRingProtrusionCount === 0
    && report.metrics.minuteTipInsideDialRing && report.metrics.hourTipInsideDialRing, report.checks);
  check("phase2b-no-marker-interference", report.checks.markerInterferenceCount === 0, report.checks);
  check("phase2b-small-second-clearances-finite", [
    report.metrics.smallSecondOuterToMainCenterDistance,
    report.metrics.smallSecondToDialRingMinimumClearance,
    report.metrics.smallSecondToMainCenterMinimumClearance,
  ].every(Number.isFinite), report.metrics);
  check("phase2b-three-hand-coupling", report.checks.threeHandCoupling.length === 3
    && report.checks.threeHandCoupling.every(({ error, mountDistance }) =>
      Math.abs(error) < 1e-7 && mountDistance < 1e-6), report.checks.threeHandCoupling);
  check("phase2b-small-second-axis-coincident", report.checks.smallSecondAxisCoincident
    && report.checks.smallSecondAxisDistance < 1e-6, report.checks.smallSecondAxisDistance);
  check("phase2b-screen-tip-coordinates", Object.values(report.hands).every(({ tip }) =>
    [...tip.screen, ...tip.world].every(Number.isFinite)), report.hands);
  check("phase2b-mobile-line-width-measured", Object.values(report.checks.mobileLegibility).every(({ lineWidthPx, tipDiscernible }) =>
    Number.isFinite(lineWidthPx) && lineWidthPx > 0 && typeof tipDiscernible === "boolean"), report.checks.mobileLegibility);
  check("phase2b-protected-transforms", report.invariants.protectedTransformsUnchanged
    && report.invariants.pivotsUnchanged && report.invariants.scalesUnchanged, report.invariants);
  check("phase2b-camera-and-mechanism-state", report.invariants.cameraUnchanged
    && report.invariants.mechanismStateUnchanged, report.invariants);
  check("phase2b-query-only-no-runtime-switch", report.runtimeFootprint.queryOnly
    && report.runtimeFootprint.defaultModelDefinitionsChanged === false
    && report.runtimeFootprint.runtimeSwitchingSupported === false
    && report.runtimeFootprint.animationLoopCalls === 0
    && report.runtimeFootprint.backlogEvents === 0
    && report.runtimeFootprint.cameraPresetChanges === 0, report.runtimeFootprint);
  check("phase2b-decision-vocabulary-excludes-adopted", (!report.candidate.active
    || ["REJECT", "RETAIN_FOR_REVIEW", "PROVISIONAL_RECOMMENDATION"].includes(report.candidate.decision))
    && report.candidate.decision !== "ADOPTED", report.candidate);

  return { ok: checks.every(({ ok }) => ok), checks, report };
}
