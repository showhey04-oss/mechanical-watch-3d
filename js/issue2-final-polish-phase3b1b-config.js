const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
};

const common = {
  queryOnly: true,
  defaultAdopted: false,
  geometryChanges: false,
  lightingChanges: false,
  materialChanges: false,
  transparencyChanges: false,
  fogChanges: false,
  cameraChanges: false,
  dprChanges: false,
};

const candidates = {
  "issue2-phase3b1b-baseline": {
    ...common,
    id: "issue2-phase3b1b-baseline",
    label: "Phase 3C.3 completed-watch baseline",
    shadowMode: "baseline",
    shadowMapSize: null,
  },
  "issue2-phase3b1b-shadow-off": {
    ...common,
    id: "issue2-phase3b1b-shadow-off",
    label: "frontKey shadow carrier disabled",
    shadowMode: "off",
    shadowMapSize: null,
  },
  "issue2-phase3b1b-state-tight-512": {
    ...common,
    id: "issue2-phase3b1b-state-tight-512",
    label: "discrete-state tight frontKey shadow camera at 512",
    shadowMode: "state-tight",
    shadowMapSize: 512,
  },
  "issue2-phase3b1b-state-tight-1024": {
    ...common,
    id: "issue2-phase3b1b-state-tight-1024",
    label: "discrete-state tight frontKey shadow camera at 1024",
    shadowMode: "state-tight",
    shadowMapSize: 1024,
  },
};

export const ISSUE2_FINAL_POLISH_PHASE3B1B = deepFreeze({
  schemaVersion: 1,
  id: "ISSUE2_FINAL_POLISH_PHASE3B1B_DISCRETE_SHADOW",
  status: "QUERY_ONLY_TECHNICAL_COMPARISON_NOT_ADOPTED",
  appVersion: "v3.15.0",
  enabledByDefault: false,
  exactExteriorQuery: {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
  },
  candidates,
  discreteStates: ["normal", "split", "explode", "split-explode"],
  fit: {
    xyMarginTexels: 12,
    depthMarginMinimum: 0.25,
    depthMarginRatio: 0.01,
    mapSizes: [512, 1024],
    refreshPolicy: "initialization-and-discrete-state-transition-only",
    cameraFitPolicy: "direct-geometry-box-corners-to-light-space",
    casterReceiverPolicy: "separate-visible-finite-shadow-targets",
  },
  protectedTransparencySymbols: [
    "applyStructuralOpacity",
    "PICK_OPACITY_THRESHOLD",
    "structuralOpacityTargets",
  ],
  prohibitedTechniques: [
    "RectAreaLight",
    "new PointLight",
    "new SpotLight",
    "PMREM replacement",
    "light intensity change",
    "light color change",
    "light position change",
    "tone mapping change",
    "exposure change",
    "material change",
    "fog change",
    "alphaHash",
    "opacity-threshold shadow toggle",
    "transparent or depthWrite change",
    "per-frame shadow camera fit",
    "camera or zoom driven shadow refresh",
  ],
});

export function resolveIssue2FinalPolishPhase3B1b(search = "") {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search).replace(/^\?/, ""));
  const exact = ISSUE2_FINAL_POLISH_PHASE3B1B.exactExteriorQuery;
  if (Object.entries(exact).some(([key, value]) => params.get(key) !== value)) {
    return null;
  }
  return ISSUE2_FINAL_POLISH_PHASE3B1B.candidates[params.get("rendering")] || null;
}

export function assertIssue2FinalPolishPhase3B1b(
  config = ISSUE2_FINAL_POLISH_PHASE3B1B,
) {
  const profiles = Object.values(config.candidates);
  const checks = {
    immutable: Object.isFrozen(config) && profiles.every(Object.isFrozen),
    queryOnly: config.enabledByDefault === false,
    fourCandidates: profiles.length === 4,
    exactStates:
      config.discreteStates.join(",")
      === "normal,split,explode,split-explode",
    isolatedModes:
      config.candidates["issue2-phase3b1b-baseline"].shadowMode === "baseline"
      && config.candidates["issue2-phase3b1b-shadow-off"].shadowMode === "off"
      && config.candidates["issue2-phase3b1b-state-tight-512"].shadowMode
        === "state-tight"
      && config.candidates["issue2-phase3b1b-state-tight-1024"].shadowMode
        === "state-tight",
    mapSizes:
      config.candidates["issue2-phase3b1b-state-tight-512"].shadowMapSize === 512
      && config.candidates["issue2-phase3b1b-state-tight-1024"].shadowMapSize
        === 1024,
    twelveTexelMargin: config.fit.xyMarginTexels === 12,
    noAdoption: profiles.every(profile => profile.defaultAdopted === false),
    protectedRendering: profiles.every(profile =>
      profile.geometryChanges === false
      && profile.lightingChanges === false
      && profile.materialChanges === false
      && profile.transparencyChanges === false
      && profile.fogChanges === false
      && profile.cameraChanges === false
      && profile.dprChanges === false
    ),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}
