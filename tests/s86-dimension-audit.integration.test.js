const SAME = (left, right) => JSON.stringify(left) === JSON.stringify(right);

async function loadJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
  return response.json();
}

export async function runS86DimensionAuditIntegrationTest(diagnostics) {
  const checks = [];
  const check = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  const runtime = diagnostics.getDimensionDiagnostics();
  const reportRoot = "./docs/evidence/adopt-dial-display-scale-s86/reports";
  const [current, differences, saved] = await Promise.all([
    loadJson(`${reportRoot}/current-s86-dimensions.json`),
    loadJson(`${reportRoot}/s86-dimension-differences.json`),
    loadJson(`${reportRoot}/runtime-saved-integration.json`),
  ]);

  const expected = {
    dialRingDiameter: 27.692,
    indexCircleDiameter: 25.456,
    minuteHandLength: 12.04,
    hourHandLength: 8.6,
    smallSecondRingDiameter: 7.74,
    smallSecondHandLength: 3.268,
  };
  const factDecision = (id) => runtime.facts.find((fact) => fact.id === id)?.decision;
  check("s86-runtime-default-display-dimensions", SAME(Object.fromEntries(Object.keys(expected).map((key) => [key, runtime.definitions[key]])), expected), runtime.definitions);
  check("s86-runtime-ratios-and-mechanism-invariants", runtime.normalizedRatios.dialRingDiameter === 0.756612
    && runtime.dualReferenceRatios.handLengths.minute.toMovementDiameter === 0.328962
    && runtime.mechanismChecks.smallSecondFourthAxisDistance === 0
    && runtime.mechanismChecks.handCoupling.every(({ error, mountDistance }) => Math.abs(error) < 1e-7 && mountDistance < 1e-6)
    && runtime.mechanismChecks.interference.forbiddenCount === 0
    && factDecision("movement-height") === "REVIEW", runtime.mechanismChecks);
  check("s86-current-report-matches-runtime", SAME(current.definitions, Object.fromEntries(Object.keys(current.definitions).map((key) => [key, runtime.definitions[key]])))
    && current.mechanismChecks.smallSecondFourthAxisDistance === runtime.mechanismChecks.smallSecondFourthAxisDistance
    && current.mechanismChecks.forbiddenInterference === runtime.mechanismChecks.interference.forbiddenCount
    && current.mechanismChecks.handCouplingMaxError <= 1e-7
    && current.sourceCommit === saved.sourceCommit, current);
  check("s86-differences-report-is-display-only", SAME(differences.after.dimensions, expected)
    && differences.invariants.internalMechanismWorldTransformsMatchMain === true
    && differences.invariants.smallSecondCenterAndFourthArborDistance === 0
    && differences.invariants.yAxisLayoutMatchMain === true, differences);
  check("s86-runtime-saved-integration-is-complete", saved.status === "complete"
    && saved.phase1EvidenceModified === false
    && saved.unfinishedCount === 0
    && saved.runtimeSavedChecks.every(({ ok }) => ok), saved);

  return { ok: checks.every(({ ok }) => ok), checks, runtimeSummary: { definitions: runtime.definitions, mechanismChecks: runtime.mechanismChecks } };
}
