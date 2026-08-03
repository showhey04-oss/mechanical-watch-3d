const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
};

const common = {
  queryOnly: true,
  defaultAdopted: false,
  lightingChanges: false,
  materialChanges: false,
  transparencyChanges: false,
  cameraChanges: false,
  dprChanges: false,
  shadowMapChanges: false,
};

const candidates = {
  "issue2-phase3b1-baseline": {
    ...common,
    id: "issue2-phase3b1-baseline",
    label: "Phase 3C.3 completed-watch baseline",
    shadowMode: "baseline",
    fog: null,
  },
  "issue2-shadow-off": {
    ...common,
    id: "issue2-shadow-off",
    label: "frontKey shadow carrier disabled",
    shadowMode: "off",
    fog: null,
  },
  "issue2-shadow-fit": {
    ...common,
    id: "issue2-shadow-fit",
    label: "frontKey fixed completed-watch shadow fit",
    shadowMode: "fit",
    fog: null,
  },
  "issue2-fog-only": {
    ...common,
    id: "issue2-fog-only",
    label: "baseline lighting with isolated fog range",
    shadowMode: "baseline",
    fog: { near: 160, far: 260 },
  },
  "issue2-shadow-off-fog": {
    ...common,
    id: "issue2-shadow-off-fog",
    label: "frontKey shadow carrier disabled with isolated fog range",
    shadowMode: "off",
    fog: { near: 160, far: 260 },
  },
  "issue2-shadow-fit-fog": {
    ...common,
    id: "issue2-shadow-fit-fog",
    label: "fixed completed-watch shadow fit with isolated fog range",
    shadowMode: "fit",
    fog: { near: 160, far: 260 },
  },
};

export const ISSUE2_FINAL_POLISH_PHASE3B1 = deepFreeze({
  schemaVersion: 1,
  id: "ISSUE2_FINAL_POLISH_PHASE3B1_SHADOW_FOG",
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
  fogDiagnostic: {
    near: 160,
    far: 260,
  },
  shadowFit: {
    marginWorldUnits: 4,
    states: [
      "normal",
      "full-length",
      "split",
      "explode",
      "split-explode",
    ],
    updatePolicy: "fixed-at-candidate-initialization",
    mapSizePolicy: "preserve-baseline",
    biasPolicy: "preserve-baseline",
    normalBiasPolicy: "preserve-baseline",
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
    "alphaHash",
    "opacity-threshold shadow toggle",
    "transparent or depthWrite change",
    "per-frame shadow camera fit",
  ],
});

export function resolveIssue2FinalPolishPhase3B1(search = "") {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search).replace(/^\?/, ""));
  const exact = ISSUE2_FINAL_POLISH_PHASE3B1.exactExteriorQuery;
  if (Object.entries(exact).some(([key, value]) => params.get(key) !== value)) {
    return null;
  }
  return ISSUE2_FINAL_POLISH_PHASE3B1.candidates[params.get("rendering")] || null;
}

export function assertIssue2FinalPolishPhase3B1(
  config = ISSUE2_FINAL_POLISH_PHASE3B1,
) {
  const profiles = Object.values(config.candidates);
  const exactFog = profiles
    .filter(profile => profile.fog)
    .every(profile =>
      profile.fog.near === 160 && profile.fog.far === 260
    );
  const checks = {
    immutable: Object.isFrozen(config) && profiles.every(Object.isFrozen),
    queryOnly: config.enabledByDefault === false,
    sixCandidates: profiles.length === 6,
    baselineUnchanged:
      config.candidates["issue2-phase3b1-baseline"].shadowMode === "baseline"
      && config.candidates["issue2-phase3b1-baseline"].fog === null,
    isolatedShadowModes:
      config.candidates["issue2-shadow-off"].shadowMode === "off"
      && config.candidates["issue2-shadow-fit"].shadowMode === "fit",
    isolatedFog: exactFog,
    fixedFit:
      config.shadowFit.updatePolicy === "fixed-at-candidate-initialization",
    noAdoption: profiles.every(profile => profile.defaultAdopted === false),
    protectedRendering:
      profiles.every(profile =>
        profile.lightingChanges === false
        && profile.materialChanges === false
        && profile.transparencyChanges === false
        && profile.cameraChanges === false
        && profile.dprChanges === false
        && profile.shadowMapChanges === false
      ),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}
