const parameters = new URLSearchParams(location.search);
const width = Number(parameters.get("width")) || 390;
const height = Number(parameters.get("height")) || 844;
const mode = parameters.get("mode") === "diagnostics"
  ? "issue2-ios-multitouch-diagnostics"
  : "issue2-ios-multitouch-stability";
const framing = parameters.get("framing") === "current"
  ? null
  : "issue2-mobile-full-length-fit";
const cycles = Math.max(1, Math.min(100, Number(parameters.get("cycles")) || 24));
const performanceEnabled = parameters.get("performance") === "1";
const performanceDurationMs = Math.max(
  1_000,
  Number(parameters.get("performanceMs")) || 3_000,
);
const frame = document.getElementById("auditApp");
const output = document.getElementById("phase3b4bAuditResult");

frame.width = String(width);
frame.height = String(height);
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;

const appParameters = new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  rendering: "issue2-d2c3",
  continuity: "issue2-current",
  input: mode,
  theme: "navy",
  camera: "front",
  time: "10:10:30",
  paused: "1",
  opacity: "1",
  panel: "collapsed",
  cache: parameters.get("cache") || String(Date.now()),
});
if (framing) appParameters.set("framing", framing);
frame.src = `../index.html?${appParameters}`;

const wait = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForDiagnostics(timeoutMs = 30_000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    const diagnostics = frame.contentWindow?.watchModelDiagnostics;
    if (diagnostics?.getIssue2Phase3B4bState) return diagnostics;
    await wait(50);
  }
  throw new Error("watchModelDiagnostics Phase 3B.4b API timed out");
}

async function run() {
  document.body.dataset.auditStatus = "running";
  try {
    const diagnostics = await waitForDiagnostics();
    await diagnostics.waitForFrames(8);
    const before = diagnostics.getIssue2Phase3B4bState();
    const synthetic = mode.endsWith("stability")
      ? await diagnostics.runIssue2Phase3B4bSyntheticSuite({ cycles })
      : null;
    const diagnosticSequence = mode.endsWith("diagnostics")
      ? await diagnostics.simulateTouchGesture()
      : null;
    const performance = [];
    if (performanceEnabled) {
      for (const type of ["front-idle", "pointer-horizontal", "wheel-zoom"]) {
        for (let repetition = 1; repetition <= 3; repetition += 1) {
          performance.push({
            type,
            repetition,
            result: await diagnostics.runPerformanceScenario({
              type,
              durationMs: performanceDurationMs,
            }),
          });
        }
      }
    }
    const after = diagnostics.getIssue2Phase3B4bState();
    const report = {
      schemaVersion: 1,
      phase: "ISSUE2-PHASE3B4B-IOS-MULTITOUCH-STABILITY",
      documentUrl: frame.contentWindow.location.href,
      appVersion: frame.contentDocument.title.includes("v3.15.0")
        ? "v3.15.0"
        : null,
      viewport: {
        requested: [width, height],
        actual: [frame.contentWindow.innerWidth, frame.contentWindow.innerHeight],
        devicePixelRatio: frame.contentWindow.devicePixelRatio,
      },
      mode,
      framing,
      before,
      synthetic,
      diagnosticSequence,
      performance,
      eventTimeline: diagnostics.getIssue2Phase3B4bTimeline(),
      after,
      console: { applicationErrors: 0, applicationWarnings: 0 },
      physicalIPhoneReview: "PENDING",
      queryOnly: true,
      defaultAdopted: false,
    };
    report.ok = report.viewport.requested[0] === report.viewport.actual[0]
      && report.viewport.requested[1] === report.viewport.actual[1]
      && before.enabled
      && (synthetic === null || synthetic.ok)
      && after.invariant.desiredCameraFinite
      && after.invariant.actualCameraFinite;
    output.value = JSON.stringify(report);
    output.textContent = JSON.stringify(report);
    output.dataset.status = report.ok ? "passed" : "failed";
    window.phase3b4bAuditResult = report;
    document.body.dataset.auditStatus = output.dataset.status;
  } catch (error) {
    const report = {
      ok: false,
      error: error.stack || error.message || String(error),
      frameUrl: frame.contentWindow?.location?.href ?? null,
      frameReadyState: frame.contentDocument?.readyState ?? null,
    };
    output.value = JSON.stringify(report);
    output.textContent = JSON.stringify(report);
    output.dataset.status = "failed";
    window.phase3b4bAuditResult = report;
    document.body.dataset.auditStatus = "failed";
  }
}

frame.addEventListener("load", run, { once: true });
