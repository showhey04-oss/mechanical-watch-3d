const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
};

const source = {
  pullRequest: 5,
  head: "79feee0f81bc719de0118042b356a2b63007090c",
  module: "js/issue2-studio-lighting.js",
  documents: [
    "docs/ISSUE2_RENDERING_QUALITY_PHASE2A1.md",
    "docs/ISSUE2_RENDERING_QUALITY_PHASE2A2.md",
    "docs/ISSUE2_FINAL_POLISH_HANDOFF.md",
  ],
};

const baseEnvironment = {
  background: "#080808",
  ambientSurface: {
    roomColor: "#181818",
    floorColor: "#181818",
    floorRadiance: 0.7,
    roomRadius: 70,
    floorSize: [96, 96],
    floorPosition: [0, 0, -24],
  },
  panels: [
    { name: "issue2FinalEnvKey", role: "key-reflection", color: "#ffffff", radiance: 4.8, size: [34, 22], position: [16, -30, 20] },
    { name: "issue2FinalEnvFill", role: "fill-reflection", color: "#ffffff", radiance: 2.75, size: [32, 26], position: [-20, 28, 10] },
    { name: "issue2FinalEnvStrip", role: "rim-reflection", color: "#ffffff", radiance: 2.1, size: [8, 32], position: [-28, -3, -12] },
  ],
  flags: [
    { name: "issue2FinalEnvFrontFlag", role: "front-edge-negative-fill", color: "#000000", size: [7, 30], position: [-23, -25, 3] },
    { name: "issue2FinalEnvBackFlag", role: "back-edge-negative-fill", color: "#000000", size: [8, 28], position: [24, 22, -4] },
  ],
};

const midtoneEnvironment = {
  ...baseEnvironment,
  ambientSurface: {
    ...baseEnvironment.ambientSurface,
    roomColor: "#202020",
    floorColor: "#202020",
  },
  flags: baseEnvironment.flags.map(flag => ({ ...flag, color: "#080808" })),
};

const profiles = {
  "issue2-baseline": {
    id: "issue2-baseline",
    label: "completed-exterior baseline",
    source,
    renderChanges: false,
    environment: null,
    fog: null,
    rectLights: [],
    legacyLightsDisabled: false,
    shadowState: "CURRENT_V3_15_BASELINE",
  },
  "issue2-d2a": {
    id: "issue2-d2a",
    label: "D2a completed-exterior port",
    source,
    renderChanges: true,
    environment: baseEnvironment,
    fog: { near: 160, far: 260 },
    rectLights: [
      { name: "issue2FinalRectKey", role: "front-key", color: "#ffffff", intensity: 1, size: [30, 20], position: [15, -28, 18] },
      { name: "issue2FinalRectFill", role: "back-fill", color: "#ffffff", intensity: 0.35, size: [28, 22], position: [-18, 27, 11] },
    ],
    legacyLightsDisabled: true,
    shadowState: "NO_SHADOW_CARRIER",
  },
  "issue2-d2c3": {
    id: "issue2-d2c3",
    label: "D2c3 completed-exterior port",
    source,
    renderChanges: true,
    environment: midtoneEnvironment,
    fog: { near: 160, far: 260 },
    rectLights: [
      { name: "issue2FinalRectKey", role: "front-key", color: "#ffffff", intensity: 0.85, size: [30, 20], position: [15, -28, 18] },
      { name: "issue2FinalRectFill", role: "back-fill", color: "#ffffff", intensity: 0.455, size: [32.2, 25.3], position: [-18, 27, 11] },
      { name: "issue2FinalRectLowerBounce", role: "lower-front-bounce", color: "#ffffff", intensity: 0.085, size: [38, 24], position: [0, -22, -26] },
    ],
    legacyLightsDisabled: true,
    shadowState: "NO_SHADOW_CARRIER",
  },
};

export const ISSUE2_FINAL_POLISH_PHASE3A = deepFreeze({
  schemaVersion: 1,
  id: "ISSUE2_FINAL_POLISH_PHASE3A",
  status: "ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED",
  appVersion: "v3.15.0",
  enabledByDefault: false,
  exactExteriorQuery: {
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
  },
  source,
  pmrem: {
    generator: "THREE.PMREMGenerator.fromScene",
    sigma: 0.04,
    near: 0.1,
    far: 100,
  },
  candidates: profiles,
  prohibitedTechniques: [
    "large-area alphaHash",
    "opacity-threshold castShadow toggle",
    "opacity-threshold receiveShadow toggle",
    "candidate default adoption",
  ],
});

export function resolveIssue2FinalPolishPhase3A(search = "") {
  const params = search instanceof URLSearchParams
    ? search
    : new URLSearchParams(String(search).replace(/^\?/, ""));
  const exact = ISSUE2_FINAL_POLISH_PHASE3A.exactExteriorQuery;
  if (Object.entries(exact).some(([key, value]) => params.get(key) !== value)) {
    return null;
  }
  return ISSUE2_FINAL_POLISH_PHASE3A.candidates[params.get("rendering")] || null;
}

export function assertIssue2FinalPolishPhase3A(
  config = ISSUE2_FINAL_POLISH_PHASE3A,
) {
  const d2a = config.candidates["issue2-d2a"];
  const d2c3 = config.candidates["issue2-d2c3"];
  const checks = {
    immutable: Object.isFrozen(config) && Object.isFrozen(d2c3.rectLights),
    queryOnly: config.enabledByDefault === false,
    sourcePinned:
      config.source.pullRequest === 5
      && config.source.head === "79feee0f81bc719de0118042b356a2b63007090c",
    d2aExact:
      d2a.fog.near === 160
      && d2a.fog.far === 260
      && d2a.rectLights[0].intensity === 1
      && d2a.rectLights[1].intensity === 0.35,
    d2c3Exact:
      d2c3.environment.ambientSurface.roomColor === "#202020"
      && d2c3.rectLights[0].intensity === 0.85
      && d2c3.rectLights[1].intensity === 0.455
      && d2c3.rectLights[2].intensity === 0.085,
    noShadowCarrier:
      d2a.shadowState === "NO_SHADOW_CARRIER"
      && d2c3.shadowState === "NO_SHADOW_CARRIER",
    notAdopted:
      config.status === "ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED",
  };
  return { ok: Object.values(checks).every(Boolean), checks };
}
