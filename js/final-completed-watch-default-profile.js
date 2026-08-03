const deepFreeze = value => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
};

export const FINAL_COMPLETED_WATCH_PROFILE_KEYS = Object.freeze([
  "exterior",
  "watchHead",
  "strapStyle",
  "integration",
  "rendering",
  "continuity",
  "framing",
  "input",
  "audioTiming",
  "mechanismTiming",
  "audioLifecycle",
  "audioPlatform",
]);

const effectiveProfile = {
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering: "issue2-d2c3",
  continuity: "issue2-current",
  framing: "issue2-mobile-full-length-fit",
  input: "issue2-ios-multitouch-stability",
  audioTiming: "phase3b4c-stability",
  mechanismTiming: "phase3b4c-r2-foreground-stability",
  audioLifecycle: "r2-3-l4",
  audioPlatform: "p3",
};

export const FINAL_COMPLETED_WATCH_DEFAULT_PROFILE = deepFreeze({
  schemaVersion: 1,
  id: "FINAL-COMPLETED-WATCH-DEFAULT-ADOPTION",
  status: "DEFAULT_ADOPTION_TECHNICAL_CANDIDATE",
  enabledByDefault: true,
  appVersion: "v3.15.0",
  sourceMain: "0aa04a582ee7238b4ef3da81bf9f0eb4ccf2acff",
  humanSelection: "HUMAN_SELECT_D2C3_WITH_EXPLICIT_PERFORMANCE_TRADEOFF",
  physicalIPhoneAcceptance:
    "PHASE3B4C_R2_4_2_PHYSICAL_IPHONE_ACCEPTANCE_PASSED",
  performance:
    "PHASE3B4_STACK_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION",
  query: {
    key: "defaultProfile",
    completedWatchValue: "completed-watch",
    legacyValue: "legacy",
  },
  profileKeys: FINAL_COMPLETED_WATCH_PROFILE_KEYS,
  effectiveProfile,
});

const toParameters = search => {
  if (search instanceof URLSearchParams) return new URLSearchParams(search);
  if (search && typeof search === "object" && "search" in search) {
    return new URLSearchParams(String(search.search ?? "").replace(/^\?/, ""));
  }
  return new URLSearchParams(String(search ?? "").replace(/^\?/, ""));
};

export function resolveFinalCompletedWatchDefaultProfile(search = "") {
  const rawParameters = toParameters(search);
  const effectiveParameters = new URLSearchParams(rawParameters);
  const explicitProfileKeys = FINAL_COMPLETED_WATCH_PROFILE_KEYS.filter(key =>
    rawParameters.has(key));
  const requestedDefaultProfile = rawParameters.get(
    FINAL_COMPLETED_WATCH_DEFAULT_PROFILE.query.key,
  );
  const legacyOverride =
    requestedDefaultProfile
    === FINAL_COMPLETED_WATCH_DEFAULT_PROFILE.query.legacyValue;
  const explicitDefault =
    requestedDefaultProfile
    === FINAL_COMPLETED_WATCH_DEFAULT_PROFILE.query.completedWatchValue;
  const invalidValue = requestedDefaultProfile !== null
    && !legacyOverride
    && !explicitDefault
      ? requestedDefaultProfile
      : null;

  let profileSource;
  let defaultProfile;
  let defaultApplied = false;

  if (explicitProfileKeys.length > 0) {
    profileSource = "explicit-profile-query";
    defaultProfile = "explicit-profile";
  } else if (legacyOverride) {
    profileSource = "legacy-override";
    defaultProfile = "legacy";
  } else {
    profileSource = invalidValue !== null
      ? "invalid-value-fallback"
      : explicitDefault
        ? "explicit-default"
        : "implicit-default";
    defaultProfile = "completed-watch";
    defaultApplied = true;
    for (const [key, value] of Object.entries(
      FINAL_COMPLETED_WATCH_DEFAULT_PROFILE.effectiveProfile,
    )) {
      effectiveParameters.set(key, value);
    }
  }

  return Object.freeze({
    profile: FINAL_COMPLETED_WATCH_DEFAULT_PROFILE,
    rawParameters,
    effectiveParameters,
    profileSource,
    defaultProfile,
    defaultApplied,
    explicitProfileKeys: Object.freeze([...explicitProfileKeys]),
    legacyOverride,
    invalidValue,
    invalidDiagnostic: invalidValue === null
      ? null
      : "INVALID_DEFAULT_PROFILE_VALUE",
    requestedDefaultProfile,
  });
}

export function assertFinalCompletedWatchDefaultProfile(
  profile = FINAL_COMPLETED_WATCH_DEFAULT_PROFILE,
) {
  const checks = {
    immutable:
      Object.isFrozen(profile)
      && Object.isFrozen(profile.effectiveProfile)
      && Object.isFrozen(profile.profileKeys),
    id: profile.id === "FINAL-COMPLETED-WATCH-DEFAULT-ADOPTION",
    status: profile.status === "DEFAULT_ADOPTION_TECHNICAL_CANDIDATE",
    enabledByDefault: profile.enabledByDefault === true,
    appVersion: profile.appVersion === "v3.15.0",
    sourceMain:
      profile.sourceMain === "0aa04a582ee7238b4ef3da81bf9f0eb4ccf2acff",
    humanSelection:
      profile.humanSelection
      === "HUMAN_SELECT_D2C3_WITH_EXPLICIT_PERFORMANCE_TRADEOFF",
    physicalIPhoneAcceptance:
      profile.physicalIPhoneAcceptance
      === "PHASE3B4C_R2_4_2_PHYSICAL_IPHONE_ACCEPTANCE_PASSED",
    performance:
      profile.performance
      === "PHASE3B4_STACK_PERFORMANCE_ACCEPTED_WITH_ENVIRONMENT_LIMITATION",
    completeProfile:
      profile.profileKeys.length === 12
      && profile.profileKeys.every(key =>
        typeof profile.effectiveProfile[key] === "string"),
  };
  return Object.freeze({ ok: Object.values(checks).every(Boolean), checks });
}
