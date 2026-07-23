const SAME = (left, right) => JSON.stringify(left) === JSON.stringify(right);
async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
  return response.json();
}

export async function runDimensionAuditIntegrationTest(diagnostics) {
  const checks = [];
  const check = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  const runtime = diagnostics.getDimensionDiagnostics();
  const reportRoot = "./docs/evidence/movement-dial-dimension-audit/reports";
  const [current, normalized, differences, anchors, screenSpace, regression, baseline] = await Promise.all([
    loadJson(`${reportRoot}/current-model-dimensions.json`),
    loadJson(`${reportRoot}/normalized-ratios.json`),
    loadJson(`${reportRoot}/dimension-differences.json`),
    loadJson(`${reportRoot}/reference-anchors.json`),
    loadJson(`${reportRoot}/screen-space-ratios.json`),
    loadJson(`${reportRoot}/regression-results.json`),
    loadJson(`${reportRoot}/baseline-image-comparison.json`),
  ]);

  check("dimension-runtime-schema-v2-and-dial-definitions", runtime.schemaVersion === 2
    && runtime.definitions.dialRingDiameter === 32.2
    && runtime.definitions.dialBlankDiameter === null
    && !Object.hasOwn(runtime.definitions, ["dial", "Diameter"].join("")), runtime.definitions);

  const factDecision = (id) => runtime.facts.find((fact) => fact.id === id)?.decision;
  check("dimension-runtime-review-and-unverified-facts", factDecision("movement-height") === "REVIEW"
    && factDecision("dial-ring-diameter") === "REVIEW"
    && factDecision("dial-blank-diameter") === "UNVERIFIED", runtime.facts);

  check("dimension-runtime-measurement-basis-and-phase2-plan", runtime.measurementBasis.alignmentStatus === "NOT_ALIGNED"
    && runtime.measurementBasis.decision === "REVIEW"
    && SAME(runtime.measurementBasis.phase2EnvelopePlan, [
      "baseMovementEnvelope",
      "handMountAndProtrudingArborEnvelope",
      "applicationEnvelopeIncludingDialAndHands",
    ]), runtime.measurementBasis);

  check("dimension-runtime-dual-reference-ratios", runtime.dualReferenceRatios.handLengths.minute.toMovementDiameter === 0.281421
    && runtime.dualReferenceRatios.handLengths.minute.toMovementRadius === 0.562842
    && runtime.dualReferenceRatios.centerRadii.smallSecond.toMovementDiameter === 0.15304
    && runtime.dualReferenceRatios.centerRadii.smallSecond.toMovementRadius === 0.30608
    && runtime.dualReferenceRatios.crownPosition.toMovementDiameter.radial === 0.554779
    && runtime.dualReferenceRatios.crownPosition.toMovementRadius.radial === 1.109559
    && runtime.dualReferenceRatios.trainCenters.fourth.toMovementDiameter.radial === 0.15304
    && runtime.dualReferenceRatios.trainCenters.fourth.toMovementRadius.radial === 0.30608,
  runtime.dualReferenceRatios);

  check("dimension-runtime-screen-space-review-is-non-dimensional", ["whole", "movement", "display"].every((id) => {
    const box = runtime.screenSpace[id];
    const needsReview = box.widthRatio > 1 || box.heightRatio > 1 || !box.inside;
    return !needsReview || (box.decision === "REVIEW"
      && box.reviewReason === "cameraComposition"
      && box.dimensionAdjustmentEvidence === false);
  }), runtime.screenSpace);

  check("dimension-current-json-matches-runtime", current.schemaVersion === runtime.schemaVersion
    && SAME(current.coordinateConvention, runtime.coordinateConvention)
    && SAME(current.definitions, runtime.definitions)
    && SAME(current.renderedGeometry, runtime.renderedGeometry)
    && SAME(current.worldCoordinates, runtime.worldCoordinates)
    && SAME(current.mechanismChecks, runtime.mechanismChecks)
    && SAME(current.transformInvariant, runtime.transformInvariant)
    && SAME(current.runtimeFootprint, runtime.runtimeFootprint));

  check("dimension-normalized-json-matches-runtime", normalized.schemaVersion === runtime.schemaVersion
    && SAME(normalized.scale, runtime.scale)
    && SAME(normalized.ratios, runtime.normalizedRatios)
    && SAME(normalized.measurementBasis, runtime.measurementBasis)
    && SAME(normalized.ratioBases, runtime.ratioBases)
    && SAME(normalized.dualReferenceRatios, runtime.dualReferenceRatios));

  check("dimension-differences-json-matches-runtime", differences.schemaVersion === runtime.schemaVersion
    && SAME(differences.decisions, runtime.decisionVocabulary)
    && SAME(differences.facts, runtime.facts)
    && SAME(differences.measurementBasis, runtime.measurementBasis));

  check("dimension-reference-json-matches-runtime", anchors.schemaVersion === runtime.schemaVersion
    && SAME(anchors.anchors, runtime.officialAnchors)
    && SAME(anchors.classifications, runtime.classificationVocabulary));

  const savedScreen = screenSpace.reports.find(({ viewport, view }) => viewport === "1280x720" && view === "reset");
  check("dimension-screen-space-json-matches-runtime", screenSpace.schemaVersion === runtime.schemaVersion
    && screenSpace.reports.length === 20
    && SAME(savedScreen?.report?.viewport, runtime.screenSpace.viewport)
    && SAME(savedScreen?.report?.preset, runtime.screenSpace.preset)
    && SAME(savedScreen?.report?.camera, runtime.screenSpace.camera)
    && SAME(savedScreen?.report?.whole, runtime.screenSpace.whole)
    && SAME(savedScreen?.report?.movement, runtime.screenSpace.movement)
    && SAME(savedScreen?.report?.display, runtime.screenSpace.display)
    && savedScreen?.report?.transformInvariant === true
    && savedScreen?.report?.forbiddenCount === 0);

  check("dimension-auxiliary-json-schema-v2", regression.schemaVersion === runtime.schemaVersion
    && regression.dimensionAudit.screenSpaceCases === 20
    && regression.dimensionAudit.invalidReviewMetadata === 0
    && baseline.schemaVersion === runtime.schemaVersion
    && baseline.pixelExact === true);

  return {
    ok: checks.every(({ ok }) => ok),
    checks,
    runtimeSummary: {
      schemaVersion: runtime.schemaVersion,
      definitions: runtime.definitions,
      measurementBasis: runtime.measurementBasis,
      ratioBases: runtime.ratioBases,
      dualReferenceRatios: runtime.dualReferenceRatios,
      facts: runtime.facts,
      screenSpace: runtime.screenSpace,
    },
  };
}
