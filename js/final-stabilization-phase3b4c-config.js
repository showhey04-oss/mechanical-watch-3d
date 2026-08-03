export const FINAL_STABILIZATION_PHASE3B4C = Object.freeze({
  id: "final-stabilization-phase3b4c-ios-audio-pacing",
  status: "QUERY_ONLY_NOT_ADOPTED",
  queryKey: "audioTiming",
  diagnostics: "phase3b4c-diagnostics",
  stability: "phase3b4c-stability",
  protectedContext: Object.freeze({
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
    rendering: "issue2-d2c3",
    continuity: "issue2-current",
    framing: "issue2-mobile-full-length-fit",
    input: "issue2-ios-multitouch-stability",
  }),
});

export function resolveFinalStabilizationPhase3B4c(parameters) {
  const values = parameters instanceof URLSearchParams
    ? parameters
    : new URLSearchParams(parameters ?? "");
  const requested = values.get(FINAL_STABILIZATION_PHASE3B4C.queryKey);
  const contextMatches = Object.entries(FINAL_STABILIZATION_PHASE3B4C.protectedContext)
    .every(([key, value]) => values.get(key) === value);
  const mode = requested === FINAL_STABILIZATION_PHASE3B4C.diagnostics
    ? "diagnostics"
    : requested === FINAL_STABILIZATION_PHASE3B4C.stability
      ? "stability"
      : "disabled";
  const enabled = contextMatches && mode !== "disabled";
  return Object.freeze({
    id: FINAL_STABILIZATION_PHASE3B4C.id,
    enabled,
    requested,
    mode: enabled ? mode : "disabled",
    queryOnly: true,
    defaultAdopted: false,
    contextMatches,
    status: enabled
      ? mode === "stability"
        ? "IOS_AUDIO_PACING_STABILITY_CANDIDATE"
        : "IOS_AUDIO_PACING_DIAGNOSTICS"
      : requested
        ? "DISABLED_PROTECTED_CONTEXT_MISMATCH"
        : "DISABLED_PROTECTED_PATH",
  });
}
