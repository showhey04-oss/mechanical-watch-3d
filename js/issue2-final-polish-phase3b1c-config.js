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
  materialChanges: false,
  transparencyChanges: false,
  fogChanges: false,
  cameraChanges: false,
  dprChanges: false,
};

const candidates = {
  "issue2-phase3b1c-baseline": {
    ...common,
    id: "issue2-phase3b1c-baseline",
    label: "Phase 3C.3 completed-watch baseline",
    shadowMode: "baseline",
    attenuation: false,
    normalBiasMode: "baseline",
  },
  "issue2-phase3b1c-shadow-off": {
    ...common,
    id: "issue2-phase3b1c-shadow-off",
    label: "frontKey shadow carrier disabled reference",
    shadowMode: "off",
    attenuation: false,
    normalBiasMode: "baseline",
  },
  "issue2-shadow-attenuation": {
    ...common,
    id: "issue2-shadow-attenuation",
    label: "opacity-coupled frontKey shadow attenuation",
    shadowMode: "attenuation",
    attenuation: true,
    normalBiasMode: "baseline",
  },
  "issue2-shadow-attenuation-bias": {
    ...common,
    id: "issue2-shadow-attenuation-bias",
    label: "opacity-coupled attenuation with fixed half-texel normalBias",
    shadowMode: "attenuation",
    attenuation: true,
    normalBiasMode: "half-texel",
  },
};

export const ISSUE2_FINAL_POLISH_PHASE3B1C = deepFreeze({
  schemaVersion: 1,
  id: "ISSUE2_FINAL_POLISH_PHASE3B1C_SHADOW_ATTENUATION",
  status: "QUERY_ONLY_TECHNICAL_COMPARISON_NOT_ADOPTED",
  appVersion: "v3.15.0",
  enabledByDefault: false,
  exactExteriorQuery: {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
  },
  attenuation: {
    minimumOpacity: 0.08,
    baselineShadowOpacity: 0.80,
    curve: "smoothstep",
    baselineFrontKeyIntensity: 1.96,
    intensitySumTolerance: 1e-12,
  },
  normalBias: {
    factor: 0.5,
    bias: 0,
    mapSize: 512,
  },
  candidates,
  prohibitedTechniques: [
    "castShadow opacity toggle",
    "receiveShadow opacity toggle",
    "customDepthMaterial",
    "alphaTest",
    "alphaHash",
    "dithered shadow",
    "material change",
    "geometry change",
    "shadow camera change",
    "shadow map size change",
    "fog change",
    "PMREM change",
    "tone mapping change",
    "exposure change",
    "per-opacity shadow refresh",
  ],
});

export function resolveIssue2FinalPolishPhase3B1c(search = "") {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search).replace(/^\?/, ""));
  const exact = ISSUE2_FINAL_POLISH_PHASE3B1C.exactExteriorQuery;
  if (Object.entries(exact).some(([key, value]) => params.get(key) !== value)) {
    return null;
  }
  return ISSUE2_FINAL_POLISH_PHASE3B1C.candidates[
    params.get("rendering")
  ] || null;
}

export function issue2Phase3B1cShadowWeight(
  opacity,
  attenuation = ISSUE2_FINAL_POLISH_PHASE3B1C.attenuation,
) {
  const ratio = Math.max(
    attenuation.minimumOpacity,
    Math.min(1, Number(opacity)),
  );
  const t = Math.max(0, Math.min(
    1,
    (ratio - attenuation.minimumOpacity)
      / (attenuation.baselineShadowOpacity - attenuation.minimumOpacity),
  ));
  return t * t * (3 - 2 * t);
}

export function assertIssue2FinalPolishPhase3B1c(
  config = ISSUE2_FINAL_POLISH_PHASE3B1C,
) {
  const profiles = Object.values(config.candidates);
  const checks = {
    immutable: Object.isFrozen(config) && profiles.every(Object.isFrozen),
    queryOnly: config.enabledByDefault === false,
    fourCandidates: profiles.length === 4,
    exactCandidateIds: Object.keys(config.candidates).join(",")
      === [
        "issue2-phase3b1c-baseline",
        "issue2-phase3b1c-shadow-off",
        "issue2-shadow-attenuation",
        "issue2-shadow-attenuation-bias",
      ].join(","),
    baselineIntensity:
      config.attenuation.baselineFrontKeyIntensity === 1.96,
    curveBounds:
      issue2Phase3B1cShadowWeight(1) === 1
      && issue2Phase3B1cShadowWeight(0.80) === 1
      && issue2Phase3B1cShadowWeight(0.08) === 0,
    fixedHalfTexelBias:
      config.normalBias.factor === 0.5
      && config.normalBias.mapSize === 512
      && config.normalBias.bias === 0,
    noAdoption: profiles.every(profile => profile.defaultAdopted === false),
    protectedRendering: profiles.every(profile =>
      profile.geometryChanges === false
      && profile.materialChanges === false
      && profile.transparencyChanges === false
      && profile.fogChanges === false
      && profile.cameraChanges === false
      && profile.dprChanges === false
    ),
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}
