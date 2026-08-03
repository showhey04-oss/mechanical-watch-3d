const params = new URLSearchParams(location.search);
const frame = document.getElementById("visualApp");
const output = document.getElementById("phase3c3VisualResult");
const width = Math.max(320, Number(params.get("width")) || 1280);
const height = Math.max(480, Number(params.get("height")) || 720);
const state = params.get("state") || "normal";
frame.style.width = `${width}px`;
frame.style.height = `${height}px`;
frame.src = `../index.html?${new URLSearchParams({
  exterior: "balanced",
  watchHead: "phase3c1",
  strapStyle: "phase3c2",
  integration: "phase3c3",
  theme: "navy",
  camera: params.get("camera") || "front",
  time: "10:10:30",
  paused: "1",
  opacity: "1",
  panel: "collapsed",
  cache: params.get("cache") || String(Date.now()),
})}`;

const wait = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForDiagnostics(timeoutMs = 30_000) {
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

frame.addEventListener("load", async () => {
  try {
    const diagnostics = await waitForDiagnostics();
    await diagnostics.waitForFrames(90);
    if (state === "exterior-off") {
      const control =
        frame.contentDocument.querySelector('[data-group="exterior"]');
      if (control?.checked) control.click();
    } else if (state === "crown-position-2") {
      diagnostics.setCrownPosition("set");
    } else if (state === "opacity-16-internal") {
      diagnostics.setStructuralOpacity(0.16);
      diagnostics.pickProjectedPart("設定車2");
    }
    await diagnostics.waitForFrames(8);
    const result = {
      ok: true,
      state,
      viewport: {
        width: frame.contentWindow.innerWidth,
        height: frame.contentWindow.innerHeight,
      },
      documentUrl: frame.contentWindow.location.href,
      ui: diagnostics.getUiRegressionState(),
    };
    output.value = JSON.stringify(result);
    output.textContent = JSON.stringify(result);
    output.dataset.status = "passed";
    document.body.dataset.visualStatus = "passed";
  } catch (error) {
    output.value = JSON.stringify({
      ok: false,
      error: error.stack || error.message || String(error),
    });
    output.textContent = output.value;
    output.dataset.status = "failed";
    document.body.dataset.visualStatus = "failed";
  }
});
