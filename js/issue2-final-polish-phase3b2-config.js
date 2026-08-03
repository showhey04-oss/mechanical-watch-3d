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
  transformChanges: false,
  lightChanges: false,
  shadowChanges: false,
  fogChanges: false,
  cameraChanges: false,
  dprChanges: false,
  selectionChanges: false,
  uiChanges: false,
  audioChanges: false,
};

const candidates = {
  "issue2-current": {
    ...common,
    id: "issue2-current",
    label: "Current threshold-switched transparency reference",
    policy: "current",
    technicalCandidate: false,
  },
  "issue2-stable-depth-off": {
    ...common,
    id: "issue2-stable-depth-off",
    label: "Always transparent with depthWrite disabled",
    policy: "stable-depth-off",
    technicalCandidate: true,
  },
  "issue2-stable-depth-base": {
    ...common,
    id: "issue2-stable-depth-base",
    label: "Always transparent with base depthWrite",
    policy: "stable-depth-base",
    technicalCandidate: true,
  },
  "issue2-group-stable-depth": {
    ...common,
    id: "issue2-group-stable-depth",
    label: "Always transparent with group-stable depthWrite",
    policy: "group-stable-depth",
    technicalCandidate: true,
  },
};

export const ISSUE2_FINAL_POLISH_PHASE3B2 = deepFreeze({
  schemaVersion: 1,
  id: "ISSUE2_FINAL_POLISH_PHASE3B2_TRANSPARENCY_CONTINUITY",
  status: "QUERY_ONLY_TECHNICAL_COMPARISON_NOT_ADOPTED",
  appVersion: "v3.15.0",
  enabledByDefault: false,
  exactExteriorQuery: {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
  },
  allowedRenderingBaselines: [
    "issue2-phase3b1c-shadow-off",
    "issue2-d2c3",
  ],
  ratios: [1, 0.99, 0.98, 0.75, 0.56, 0.55, 0.54, 0.53, 0.52, 0.50, 0.25, 0.16, 0.08],
  adjacentPairs: [
    [1, 0.99],
    [0.99, 0.98],
    [0.56, 0.55],
    [0.55, 0.54],
    [0.54, 0.53],
    [0.53, 0.52],
    [0.25, 0.16],
    [0.16, 0.08],
  ],
  currentThresholds: {
    transparentBelow: 1,
    depthWriteBelow: 0.55,
  },
  groupDepthWriteOff: ["dial", "exterior", "plate", "bridge"],
  continuityGates: {
    opacity100To99SpikeRatioMax: 2,
    opacity55To54SpikeRatioMax: 2,
    averageFpsWorseningPercentMax: 5,
    p95WorseningMsMax: 2,
  },
  candidates,
  prohibitedTechniques: [
    "alphaHash",
    "ordered dithering",
    "screen-door transparency",
    "custom shader transparency",
    "weighted blended OIT",
    "depth peeling",
    "customDepthMaterial",
    "alphaTest",
    "stochastic depth",
    "duplicate geometry pass",
    "opacity threshold transparent toggle",
    "opacity threshold depthWrite toggle",
    "opacity threshold castShadow toggle",
    "opacity threshold receiveShadow toggle",
    "camera-dependent renderOrder",
    "per-frame material recreation",
  ],
});

export function resolveIssue2FinalPolishPhase3B2(search = "") {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search).replace(/^\?/, ""));
  const exact = ISSUE2_FINAL_POLISH_PHASE3B2.exactExteriorQuery;
  if (Object.entries(exact).some(([key, value]) => params.get(key) !== value)) {
    return null;
  }
  if (
    !ISSUE2_FINAL_POLISH_PHASE3B2.allowedRenderingBaselines.includes(
      params.get("rendering"),
    )
  ) {
    return null;
  }
  return ISSUE2_FINAL_POLISH_PHASE3B2.candidates[
    params.get("continuity")
  ] || null;
}

export function resolveIssue2Phase3B2DepthWrite({
  policy,
  ratio,
  baseDepthWrite,
  group,
}) {
  if (policy === "current") {
    return Number(ratio) >= 0.55 ? Boolean(baseDepthWrite) : false;
  }
  if (policy === "stable-depth-off") return false;
  if (policy === "stable-depth-base") return Boolean(baseDepthWrite);
  if (policy === "group-stable-depth") {
    return ISSUE2_FINAL_POLISH_PHASE3B2.groupDepthWriteOff.includes(group)
      ? false
      : Boolean(baseDepthWrite);
  }
  throw new Error(`Unknown Phase 3B.2 transparency policy: ${policy}`);
}

export function resolveIssue2Phase3B2Transparent({
  policy,
  ratio,
  baseTransparent,
}) {
  return policy === "current"
    ? Boolean(baseTransparent) || Number(ratio) < 1
    : true;
}

export function assertIssue2FinalPolishPhase3B2(
  config = ISSUE2_FINAL_POLISH_PHASE3B2,
) {
  const profiles = Object.values(config.candidates);
  const checks = {
    immutable: Object.isFrozen(config) && profiles.every(Object.isFrozen),
    queryOnly: config.enabledByDefault === false,
    fourCandidates: profiles.length === 4,
    exactCandidateIds: Object.keys(config.candidates).join(",")
      === [
        "issue2-current",
        "issue2-stable-depth-off",
        "issue2-stable-depth-base",
        "issue2-group-stable-depth",
      ].join(","),
    dualBaseline:
      config.allowedRenderingBaselines.join(",")
      === "issue2-phase3b1c-shadow-off,issue2-d2c3",
    noAdoption: profiles.every(profile => profile.defaultAdopted === false),
    protectedScope: profiles.every(profile =>
      profile.geometryChanges === false
      && profile.transformChanges === false
      && profile.lightChanges === false
      && profile.shadowChanges === false
      && profile.fogChanges === false
      && profile.cameraChanges === false
      && profile.dprChanges === false
      && profile.selectionChanges === false
      && profile.uiChanges === false
      && profile.audioChanges === false
    ),
    thresholds:
      config.currentThresholds.transparentBelow === 1
      && config.currentThresholds.depthWriteBelow === 0.55,
    groupPolicy:
      config.groupDepthWriteOff.join(",") === "dial,exterior,plate,bridge",
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}
