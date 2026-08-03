import {
  FINAL_STABILIZATION_PHASE3B4C,
} from "./final-stabilization-phase3b4c-config.js";

export const FINAL_STABILIZATION_PHASE3B4C_R2 = Object.freeze({
  id: "final-stabilization-phase3b4c-r2-foreground-timebase",
  status: "QUERY_ONLY_NOT_ADOPTED",
  queryKey: "mechanismTiming",
  stability: "phase3b4c-r2-foreground-stability",
  requiredAudioTiming: FINAL_STABILIZATION_PHASE3B4C.stability,
  maximumRenderIntegrationDeltaSeconds: 0.05,
  elapsedToleranceSeconds: 1e-6,
  protectedContext: FINAL_STABILIZATION_PHASE3B4C.protectedContext,
});

const finite = (value) =>
  Number.isFinite(Number(value)) ? Number(value) : null;

export function resolveFinalStabilizationPhase3B4cR2(parameters) {
  const values = parameters instanceof URLSearchParams
    ? parameters
    : new URLSearchParams(parameters ?? "");
  const requested = values.get(FINAL_STABILIZATION_PHASE3B4C_R2.queryKey);
  const contextMatches = Object.entries(
    FINAL_STABILIZATION_PHASE3B4C_R2.protectedContext,
  ).every(([key, value]) => values.get(key) === value);
  const audioTimingMatches =
    values.get(FINAL_STABILIZATION_PHASE3B4C.queryKey)
    === FINAL_STABILIZATION_PHASE3B4C_R2.requiredAudioTiming;
  const valueMatches =
    requested === FINAL_STABILIZATION_PHASE3B4C_R2.stability;
  const enabled = contextMatches && audioTimingMatches && valueMatches;
  return Object.freeze({
    id: FINAL_STABILIZATION_PHASE3B4C_R2.id,
    enabled,
    requested,
    mode: enabled ? "foreground-stability" : "disabled",
    queryOnly: true,
    defaultAdopted: false,
    contextMatches,
    audioTimingMatches,
    valueMatches,
    status: enabled
      ? "FOREGROUND_MECHANISM_TIMEBASE_STABILITY_CANDIDATE"
      : requested
        ? "DISABLED_PROTECTED_CONTEXT_MISMATCH"
        : "DISABLED_PROTECTED_PATH",
  });
}

export class ForegroundMechanismTimebase {
  constructor({
    profile,
    now = () => performance.now(),
  } = {}) {
    this.profile = profile ?? {
      enabled: false,
      mode: "disabled",
      status: "DISABLED_PROTECTED_PATH",
    };
    this.enabled = this.profile.enabled === true;
    this.now = now;
    this.lastMonotonicTimeMs = null;
    this.foregroundSequenceActive = true;
    this.visibleForegroundWallElapsedSeconds = 0;
    this.authoritativeMechanismElapsedSeconds = 0;
    this.appliedMechanismElapsedSeconds = 0;
    this.watchTimeProgressionSeconds = 0;
    this.trainTimeProgressionSeconds = 0;
    this.powerReserveConsumptionHours = 0;
    this.renderIntegrationElapsedSeconds = 0;
    this.excludedLifecycleElapsedSeconds = 0;
    this.maximumRawForegroundDeltaSeconds = 0;
    this.longForegroundFrameCount = 0;
    this.frameCount = 0;
    this.reanchorCount = 0;
    this.lifecycle = [];
    this.samples = [];
  }

  appendSample(sample) {
    this.samples.push(sample);
    if (this.samples.length > 2400) {
      this.samples.splice(0, this.samples.length - 2400);
    }
  }

  reanchor(reason, monotonicTimeMs = this.now()) {
    const time = finite(monotonicTimeMs);
    this.lastMonotonicTimeMs = time;
    this.reanchorCount += 1;
    this.lifecycle.push({
      reason,
      monotonicTimeMs: time,
      foregroundSequenceActive: this.foregroundSequenceActive,
    });
    return true;
  }

  setForegroundSequenceActive(active, reason, monotonicTimeMs = this.now()) {
    this.foregroundSequenceActive = active === true;
    this.reanchor(reason, monotonicTimeMs);
    return this.foregroundSequenceActive;
  }

  step({
    monotonicTimeMs,
    rawFrameDeltaMs,
    visible = true,
    runtimeScale = 1,
  } = {}) {
    const nowMs = finite(monotonicTimeMs) ?? this.now();
    const rawSeconds = Math.max(
      0,
      (finite(rawFrameDeltaMs) ?? 0) / 1000,
    );
    const renderIntegrationDeltaSeconds = Math.min(
      FINAL_STABILIZATION_PHASE3B4C_R2.maximumRenderIntegrationDeltaSeconds,
      rawSeconds,
    );
    const priorTime = this.lastMonotonicTimeMs;
    const monotonicSeconds = priorTime === null
      ? rawSeconds
      : Math.max(0, (nowMs - priorTime) / 1000);
    this.lastMonotonicTimeMs = nowMs;
    this.frameCount += 1;
    this.renderIntegrationElapsedSeconds += renderIntegrationDeltaSeconds;

    const foregroundEligible =
      visible === true && this.foregroundSequenceActive;
    const visibleForegroundDeltaSeconds = foregroundEligible
      ? monotonicSeconds
      : 0;
    const authoritativeMechanismDeltaSeconds = this.enabled
      ? visibleForegroundDeltaSeconds * Math.max(0, finite(runtimeScale) ?? 1)
      : renderIntegrationDeltaSeconds * Math.max(0, finite(runtimeScale) ?? 1);

    if (foregroundEligible) {
      this.visibleForegroundWallElapsedSeconds +=
        visibleForegroundDeltaSeconds;
      this.maximumRawForegroundDeltaSeconds = Math.max(
        this.maximumRawForegroundDeltaSeconds,
        visibleForegroundDeltaSeconds,
      );
      if (
        visibleForegroundDeltaSeconds
        > FINAL_STABILIZATION_PHASE3B4C_R2.maximumRenderIntegrationDeltaSeconds
          + 1e-12
      ) {
        this.longForegroundFrameCount += 1;
      }
      if (this.enabled) {
        this.authoritativeMechanismElapsedSeconds +=
          authoritativeMechanismDeltaSeconds;
      }
    } else {
      this.excludedLifecycleElapsedSeconds += monotonicSeconds;
    }

    const sample = {
      monotonicTimeMs: nowMs,
      rawFrameDeltaSeconds: rawSeconds,
      monotonicDeltaSeconds: monotonicSeconds,
      renderIntegrationDeltaSeconds,
      visibleForegroundDeltaSeconds,
      authoritativeMechanismDeltaSeconds,
      foregroundEligible,
      visible: visible === true,
      foregroundSequenceActive: this.foregroundSequenceActive,
      runtimeScale: Math.max(0, finite(runtimeScale) ?? 1),
    };
    this.appendSample(sample);
    return sample;
  }

  recordApplication({
    mechanismElapsedSeconds = 0,
    watchTimeProgressionSeconds = mechanismElapsedSeconds,
    trainTimeProgressionSeconds = mechanismElapsedSeconds,
    powerReserveConsumptionHours = 0,
  } = {}) {
    if (!this.enabled) return false;
    this.appliedMechanismElapsedSeconds += Math.max(
      0,
      finite(mechanismElapsedSeconds) ?? 0,
    );
    this.watchTimeProgressionSeconds +=
      finite(watchTimeProgressionSeconds) ?? 0;
    this.trainTimeProgressionSeconds +=
      finite(trainTimeProgressionSeconds) ?? 0;
    this.powerReserveConsumptionHours += Math.max(
      0,
      finite(powerReserveConsumptionHours) ?? 0,
    );
    return true;
  }

  reset(reason = "diagnostic-reset", monotonicTimeMs = this.now()) {
    this.visibleForegroundWallElapsedSeconds = 0;
    this.authoritativeMechanismElapsedSeconds = 0;
    this.appliedMechanismElapsedSeconds = 0;
    this.watchTimeProgressionSeconds = 0;
    this.trainTimeProgressionSeconds = 0;
    this.powerReserveConsumptionHours = 0;
    this.renderIntegrationElapsedSeconds = 0;
    this.excludedLifecycleElapsedSeconds = 0;
    this.maximumRawForegroundDeltaSeconds = 0;
    this.longForegroundFrameCount = 0;
    this.frameCount = 0;
    this.samples.length = 0;
    this.lifecycle.length = 0;
    this.reanchorCount = 0;
    this.foregroundSequenceActive = true;
    this.reanchor(reason, monotonicTimeMs);
    return this.getReport();
  }

  getReport() {
    const scale = this.samples.at(-1)?.runtimeScale ?? 1;
    const expectedAuthoritativeElapsed =
      this.visibleForegroundWallElapsedSeconds * scale;
    const cumulativeElapsedDivergenceSeconds = this.enabled
      ? this.authoritativeMechanismElapsedSeconds
        - expectedAuthoritativeElapsed
      : null;
    return {
      schemaVersion: 1,
      phase: "Final Stabilization Phase 3B.4c-R2",
      status: this.profile.status,
      enabled: this.enabled,
      queryOnly: true,
      defaultAdopted: false,
      clockContract: {
        authoritative:
          "visible foreground monotonic raw elapsed multiplied by runtime scale",
        renderIntegration: "min(raw frame elapsed, 50ms)",
        suspendedIntervalsRestored: false,
        globalDtReplacement: false,
      },
      visibleForegroundWallElapsedSeconds:
        this.visibleForegroundWallElapsedSeconds,
      authoritativeMechanismElapsedSeconds:
        this.authoritativeMechanismElapsedSeconds,
      appliedMechanismElapsedSeconds:
        this.appliedMechanismElapsedSeconds,
      watchTimeProgressionSeconds: this.watchTimeProgressionSeconds,
      trainTimeProgressionSeconds: this.trainTimeProgressionSeconds,
      powerReserveConsumptionHours: this.powerReserveConsumptionHours,
      renderIntegrationElapsedSeconds:
        this.renderIntegrationElapsedSeconds,
      excludedLifecycleElapsedSeconds:
        this.excludedLifecycleElapsedSeconds,
      cumulativeElapsedDivergenceSeconds,
      elapsedToleranceSeconds:
        FINAL_STABILIZATION_PHASE3B4C_R2.elapsedToleranceSeconds,
      elapsedContractPassed: !this.enabled
        || Math.abs(cumulativeElapsedDivergenceSeconds)
          <= FINAL_STABILIZATION_PHASE3B4C_R2.elapsedToleranceSeconds,
      maximumRawForegroundDeltaSeconds:
        this.maximumRawForegroundDeltaSeconds,
      longForegroundFrameCount: this.longForegroundFrameCount,
      frameCount: this.frameCount,
      reanchorCount: this.reanchorCount,
      lifecycle: this.lifecycle.map((entry) => ({ ...entry })),
      samples: this.samples.map((entry) => ({ ...entry })),
    };
  }
}

export function createForegroundMechanismTimebase(options) {
  return new ForegroundMechanismTimebase(options);
}
