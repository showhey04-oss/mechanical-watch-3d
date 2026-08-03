const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
};

export const FINAL_EXTERIOR_INTEGRATION_PHASE3C3 = deepFreeze({
  schemaVersion: 1,
  id: "E-BALANCED-PHASE3C3-INTEGRATION-REVIEW",
  status: "PHASE3C3_INTEGRATION_CANDIDATE_PENDING_HUMAN_CONFIRMATION",
  enabledByDefault: false,
  query: {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
  },
  source: {
    branch: "feature/final-exterior-balanced-phase3c3-integration-review",
    baseBranch: "feature/final-exterior-balanced-phase3c2-strap-buckle",
    approvedPhase3C1Head:
      "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914",
    approvedPhase3C2Head:
      "f245a5a9d68d5205e7609479ffefd711376e4930",
    mainCommit: "293626f13a50224924f8e3ac229a1fc4077ad7a7",
  },
  appVersion: "v3.15.0",
  selection: {
    classification: "PHASE3C3_LOCAL_NON_RENDERING_SELECTION_DELEGATE",
    delegatedPartName: "Phase 3C.1 小秒表示",
    pickPriority: 3,
    renderLayerDisabled: true,
    colorWrite: false,
    depthWrite: false,
    padRadius: 0.42,
    y: -2.105,
    smallSecondCenter: [0, -5.6],
    blankOffsets: [
      [-1.45, -0.85],
      [1.45, -0.85],
      [-1.45, 0.85],
      [1.45, 0.85],
    ],
    priorityContract: {
      above: ["Phase 3C.1 アイボリー文字板"],
      below: ["Phase 3C.1 小秒針", "Phase 3C.1 小秒目盛"],
      enforcement:
        "SAME_RANK_NEAREST_SURFACE_FOR_HANDS_AND_REAR_MECHANISM; SPATIALLY_DISJOINT_BLANK_PADS_PRESERVE_MARK_HIT_SURFACES",
    },
  },
  protectedProportions: {
    caseDiameter: 39.6,
    strapLugWidth: 19.7,
    lugToLug: 46.6,
    strap12Length: 75,
    strap6Length: 115,
    totalCaseThickness: 8.695,
    buckleWidth: 16,
  },
  uiDecision: {
    frontBackSplitAndSectionClip:
      "DEFERRED_UNTIL_POST_ISSUE2_UI_SIMPLIFICATION_REVIEW",
  },
  issue2Handoff: {
    renderingChangesInPhase3C3: false,
    d2c3Adopted: false,
  },
});

export function resolveFinalExteriorIntegrationPhase3C3(input) {
  const parameters = input instanceof URLSearchParams
    ? input
    : new URLSearchParams(input || "");
  const query = FINAL_EXTERIOR_INTEGRATION_PHASE3C3.query;
  return Object.entries(query).every(
    ([name, value]) => parameters.get(name) === value,
  )
    ? FINAL_EXTERIOR_INTEGRATION_PHASE3C3
    : null;
}

export function assertFinalExteriorIntegrationPhase3C3(
  config = FINAL_EXTERIOR_INTEGRATION_PHASE3C3,
) {
  const selection = config.selection;
  const proportions = config.protectedProportions;
  const checks = [
    {
      id: "query-only",
      ok: config.enabledByDefault === false,
    },
    {
      id: "approved-phase3c2-head",
      ok:
        config.source.approvedPhase3C2Head
        === "f245a5a9d68d5205e7609479ffefd711376e4930",
    },
    {
      id: "four-blank-pads",
      ok: selection.blankOffsets.length === 4,
    },
    {
      id: "non-rendering-proxy",
      ok:
        selection.renderLayerDisabled
        && selection.colorWrite === false
        && selection.depthWrite === false,
    },
    {
      id: "protected-proportions",
      ok:
        proportions.caseDiameter === 39.6
        && proportions.strapLugWidth === 19.7
        && proportions.lugToLug === 46.6
        && proportions.totalCaseThickness === 8.695,
    },
  ];
  return {
    ok: checks.every(check => check.ok),
    checks,
  };
}
