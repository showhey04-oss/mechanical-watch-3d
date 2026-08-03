const params = new URLSearchParams(location.search);
const frame = document.getElementById("suiteApp");
const output = document.getElementById("issue2Phase3B1cSuiteResult");
const log = document.getElementById("issue2Phase3B1cSuiteLog");
const width = Math.max(320, Number(params.get("width")) || 1280);
const height = Math.max(480, Number(params.get("height")) || 720);
const suite = params.get("suite") || "browser";
const candidate =
  params.get("candidate") || "issue2-shadow-attenuation";
const upload = params.get("upload") === "1";
const externalAudioGesture = params.get("externalAudioGesture") === "1";
const suiteMap = {
  browser: ["browserTest", "browserTestResult"],
  ui: ["uiTest", "uiTestResult"],
  hud: ["hudTest", "hudTestResult"],
  audio: ["audioTest", "audioTestResult"],
};
const selectedSuite = suiteMap[suite];
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;
if (externalAudioGesture && width > 900) {
  frame.style.transform = "scale(0.45)";
  frame.style.transformOrigin = "top left";
}

const wait = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

async function uploadJson(path, value) {
  if (!upload) return null;
  const response = await fetch("/__phase3b1c_upload", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Evidence-Path": encodeURIComponent(path),
    },
    body: `${JSON.stringify(value, null, 2)}\n`,
  });
  if (!response.ok) {
    throw new Error(`upload failed (${response.status}): ${path}`);
  }
  return response.json();
}

async function publish(result, resultStatus) {
  const json = JSON.stringify(result);
  output.value = json;
  output.textContent = json;
  output.dataset.status = resultStatus;
  log.textContent = JSON.stringify({
    suite,
    candidate,
    status: resultStatus,
    total: result.total ?? result.items?.length ?? result.checks?.length ?? null,
    failed:
      result.items?.filter(item => !item.ok).map(item => item.id) ??
      result.checks?.filter(item => !item.ok).map(item => item.id) ??
      [],
    error: result.error ?? null,
  }, null, 2);
  document.body.dataset.suiteStatus = resultStatus;
  if (resultStatus === "passed" || resultStatus === "failed") {
    const viewport = `${width}x${height}`;
    const path =
      "docs/evidence/issue2-final-polish-phase3b1c-shadow-attenuation/reports/" +
      `suite-${suite}-${candidate}-${viewport}.json`;
    const saved = await uploadJson(path, result);
    if (saved) document.body.dataset.uploaded = "true";
  }
}

if (!selectedSuite) {
  await publish({ ok: false, error: `unknown suite: ${suite}` }, "failed");
} else {
  document.body.dataset.suiteStatus = "running";
  const [queryName, outputId] = selectedSuite;
  const query = new URLSearchParams({
    exterior: "balanced",
    watchHead: "phase3c1",
    strapStyle: "phase3c2",
    integration: "phase3c3",
    rendering: candidate,
    theme: "navy",
    camera: "front",
    time: "10:10:30",
    paused: "1",
    opacity: "1",
    panel: suite === "ui" || suite === "hud" ? "open" : "collapsed",
    [queryName]: "1",
    cache: params.get("cache") || String(Date.now()),
  });
  frame.src = `../index.html?${query}`;

  (async () => {
    const deadline = performance.now() + 240_000;
    let audioTriggered = false;
    while (performance.now() < deadline) {
      const diagnostics = frame.contentWindow?.watchModelDiagnostics;
      if (
        suite === "audio" &&
        diagnostics &&
        !audioTriggered &&
        !externalAudioGesture
      ) {
        await diagnostics.waitForFrames(8);
        frame.contentDocument.getElementById("audioToggle")?.click();
        audioTriggered = true;
      }
      if (suite === "audio" && externalAudioGesture && diagnostics) {
        audioTriggered =
          frame.contentDocument
            .getElementById("audioToggle")
            ?.getAttribute("aria-pressed") === "true";
      }
      const childOutput = frame.contentDocument?.getElementById(outputId);
      if (childOutput?.dataset.status) {
        const result = JSON.parse(childOutput.textContent || "{}");
        result.harness = {
          parentUrl: location.href,
          iframeUrl: frame.contentWindow.location.href,
          parentOrigin: location.origin,
          iframeOrigin: frame.contentWindow.location.origin,
          iframeReadyState: frame.contentDocument.readyState,
          viewport: diagnostics?.getViewportReport() ?? null,
          appVersion:
            frame.contentDocument.title.match(/v\d+\.\d+\.\d+/)?.[0] ?? null,
          suite,
          candidate,
          audioGestureApplied: audioTriggered,
          actualBrowserRun: true,
          source:
            "same-origin unsandboxed iframe using existing application suite",
        };
        await publish(result, childOutput.dataset.status);
        return;
      }
      await wait(50);
    }
    await publish({
      ok: false,
      error: `${suite} suite timed out`,
      iframeUrl: frame.contentWindow?.location?.href ?? null,
      iframeReadyState: frame.contentDocument?.readyState ?? null,
    }, "failed");
  })().catch(async error => {
    await publish({
      ok: false,
      error: error.stack || error.message || String(error),
    }, "failed");
  });
}
