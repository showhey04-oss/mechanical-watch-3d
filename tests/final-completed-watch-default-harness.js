const parameters = new URLSearchParams(location.search);
const frame = document.getElementById("defaultAdoptionApp");
const statusOutput = document.getElementById("defaultAdoptionStatus");
const summaryOutput = document.getElementById("defaultAdoptionSummary");
const resultOutput = document.getElementById("defaultAdoptionResult");
const width = Math.max(320, Number(parameters.get("width")) || 1280);
const height = Math.max(480, Number(parameters.get("height")) || 720);
const explicitProfile = [
  "exterior=balanced",
  "watchHead=phase3c1",
  "strapStyle=phase3c2",
  "integration=phase3c3",
  "rendering=issue2-d2c3",
  "continuity=issue2-current",
  "framing=issue2-mobile-full-length-fit",
  "input=issue2-ios-multitouch-stability",
  "audioTiming=phase3b4c-stability",
  "mechanismTiming=phase3b4c-r2-foreground-stability",
  "audioLifecycle=r2-3-l4",
  "audioPlatform=p3",
].join("&");
const routeQueries = {
  default: "",
  explicit: explicitProfile,
  legacy: "defaultProfile=legacy",
  nonprofile:
    "theme=navy&camera=front&time=10%3A10%3A30&paused=1&opacity=1&panel=collapsed",
  exterior: "exterior=balanced",
  watchHead: "exterior=balanced&watchHead=phase3c1",
  strap:
    "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2",
  integration:
    "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2&integration=phase3c3",
  issue2Baseline: `${explicitProfile.replace("rendering=issue2-d2c3", "rendering=issue2-baseline")}`,
  issue2D2a: `${explicitProfile.replace("rendering=issue2-d2c3", "rendering=issue2-d2a")}`,
  shadowOff: [
    "exterior=balanced",
    "watchHead=phase3c1",
    "strapStyle=phase3c2",
    "integration=phase3c3",
    "rendering=issue2-phase3b1c-shadow-off",
  ].join("&"),
  stableDepth: [
    "exterior=balanced",
    "watchHead=phase3c1",
    "strapStyle=phase3c2",
    "integration=phase3c3",
    "rendering=issue2-baseline",
    "continuity=issue2-stable-depth",
  ].join("&"),
};
const route = parameters.get("route") || "default";
const appQuery = parameters.has("appQuery")
  ? parameters.get("appQuery")
  : routeQueries[route];

if (appQuery === undefined) throw new Error(`unknown route: ${route}`);
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;

const wait = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForDiagnostics(timeoutMs = 45_000) {
  const started = performance.now();
  while (performance.now() - started < timeoutMs) {
    if (
      frame.contentDocument?.readyState === "complete"
      && frame.contentWindow?.watchModelDiagnostics
    ) {
      return frame.contentWindow.watchModelDiagnostics;
    }
    await wait(50);
  }
  throw new Error("watchModelDiagnostics did not become available");
}

const sha256 = async blob => {
  const bytes = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map(value => value.toString(16).padStart(2, "0"))
    .join("");
};

function writeResult(result, status) {
  const json = JSON.stringify(result);
  resultOutput.value = json;
  resultOutput.textContent = json;
  resultOutput.dataset.status = status;
  const summary = {
    ok: result.ok,
    route: result.route,
    viewport: result.viewport,
    profile: result.profile,
    canvas: result.canvas,
    checks: result.checks,
    error: result.error || null,
  };
  summaryOutput.value = JSON.stringify(summary);
  summaryOutput.textContent = JSON.stringify(summary);
  summaryOutput.dataset.status = status;
  statusOutput.value = status;
  statusOutput.textContent = status;
  document.body.dataset.auditReady = "true";
  document.body.dataset.auditStatus = status;
  window.finalCompletedWatchDefaultHarnessResult = result;
}

frame.addEventListener("load", async () => {
  try {
    const diagnostics = await waitForDiagnostics();
    diagnostics.setRunning(false);
    diagnostics.setWatchTime(10 * 3600 + 10 * 60 + 30);
    diagnostics.setBackgroundTheme("navy");
    diagnostics.setStructuralOpacity(1);
    diagnostics.clearSelectionInfo();
    diagnostics.applyCameraPreset("reset");
    await diagnostics.waitForFrames(12);

    const profile = diagnostics.getDefaultProfileReport();
    const runtime = diagnostics.getDefaultProfileRuntimeParityReport();
    const capture = await diagnostics.captureAuditViewportPng({
      width,
      height,
      cameraPreset: "current",
    });
    const canvas = {
      width,
      height,
      bytes: capture.blob.size,
      sha256: await sha256(capture.blob),
      source: capture.metadata.source,
      stateInvariant: capture.metadata.stateInvariant,
    };
    const expectedDefaultApplied = ["default", "nonprofile"].includes(route);
    const expectedProfile = expectedDefaultApplied
      ? "completed-watch"
      : route === "legacy"
        ? "legacy"
        : "explicit-profile";
    const checks = {
      sameOrigin:
        frame.contentWindow.location.origin === location.origin,
      viewport:
        frame.contentWindow.innerWidth === width
        && frame.contentWindow.innerHeight === height,
      appVersion:
        profile.appVersion === "v3.15.0"
        && frame.contentDocument.querySelector("[data-app-version]")
          ?.textContent === "v3.15.0",
      profileClass: profile.defaultProfile === expectedProfile,
      defaultApplied:
        profile.defaultApplied === expectedDefaultApplied,
      queryUnchanged:
        profile.locationSearchUnchanged === true
        && profile.urlMutationAttempted === false,
      soundInitialOff:
        runtime.audio.ui.toggle.pressed === false
        && runtime.audio.diagnostics.status === "off",
      captureStateInvariant: canvas.stateInvariant.all === true,
      completedProfile:
        !expectedDefaultApplied
        || Object.values(profile.effectiveIntegratedProfile)
          .every(value => typeof value === "string"),
      explicitNoInjection:
        route !== "explicit"
        || (
          profile.defaultApplied === false
          && profile.explicitProfileKeys.length === 12
        ),
      legacyNoCompletedWatch:
        route !== "legacy"
        || (
          runtime.profiles.exterior.enabled === false
          && runtime.profiles.rendering.enabled === false
          && runtime.profiles.audioTiming.enabled === false
          && runtime.profiles.mechanismTiming.enabled === false
        ),
    };
    const result = {
      ok: Object.values(checks).every(Boolean),
      route,
      appQuery,
      documentUrl: frame.contentWindow.location.href,
      viewport: {
        width: frame.contentWindow.innerWidth,
        height: frame.contentWindow.innerHeight,
        devicePixelRatio: frame.contentWindow.devicePixelRatio,
      },
      profile,
      runtime,
      canvas,
      checks,
    };
    writeResult(result, result.ok ? "passed" : "failed");
  } catch (error) {
    writeResult(
      { ok: false, route, appQuery, error: error.stack || error.message || String(error) },
      "failed",
    );
  }
});

const appUrl = new URL("../index.html", location.href);
if (appQuery) appUrl.search = appQuery;
frame.src = appUrl.href;
