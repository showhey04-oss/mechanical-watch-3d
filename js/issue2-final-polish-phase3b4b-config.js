const REQUIRED_QUERY = Object.freeze({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering: "issue2-d2c3",
  continuity: "issue2-current",
});

export const ISSUE2_FINAL_POLISH_PHASE3B4B = Object.freeze({
  id: "ISSUE2-PHASE3B4B-IOS-MULTITOUCH-STABILITY",
  status: "QUERY_ONLY_NOT_ADOPTED",
  diagnosticsInput: "issue2-ios-multitouch-diagnostics",
  stabilityInput: "issue2-ios-multitouch-stability",
  framing: "issue2-mobile-full-length-fit",
  sourceArcballVersion: "three@0.160.0",
  eventLogLimit: 2048,
  stalePointerAgeMs: 30_000,
  defaultAdopted: false,
});

export function resolveIssue2FinalPolishPhase3B4b(parameters) {
  const input = parameters.get("input");
  const completeWatch = Object.entries(REQUIRED_QUERY)
    .every(([key, value]) => parameters.get(key) === value);
  const diagnostics = input === ISSUE2_FINAL_POLISH_PHASE3B4B.diagnosticsInput;
  const stability = input === ISSUE2_FINAL_POLISH_PHASE3B4B.stabilityInput;
  const framing = parameters.get("framing");
  const framingAllowed = framing === null
    || framing === ISSUE2_FINAL_POLISH_PHASE3B4B.framing;
  const enabled = completeWatch && framingAllowed && (diagnostics || stability);

  return Object.freeze({
    enabled,
    mode: enabled ? (stability ? "stability" : "diagnostics") : "disabled",
    input: enabled ? input : null,
    framing: enabled ? framing : null,
    mutatesInputLifecycle: enabled && stability,
    queryOnly: true,
    defaultAdopted: false,
    status: enabled
      ? (stability ? "STABILITY_CANDIDATE_ACTIVE" : "DIAGNOSTICS_ACTIVE")
      : "DISABLED_PROTECTED_PATH",
  });
}
