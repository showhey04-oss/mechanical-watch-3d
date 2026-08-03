const params = new URLSearchParams(location.search);
const rendering = params.get("rendering") === "shadow-off"
  ? "shadow-off"
  : "d2c3";
const framing = params.get("framing") === "current" ? "current" : "fit";
const frame = document.getElementById("batchFrame");
const status = document.getElementById("status");
const output = document.getElementById("phase3b4aBatchResult");
const themes = ["navy", "obsidian", "walnut", "gallery"];
const viewports = [[1280, 720], [390, 844]];
const delay = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

async function runOne(width, height, theme, index) {
  frame.width = String(width);
  frame.height = String(height);
  const query = new URLSearchParams({
    width: String(width),
    height: String(height),
    rendering,
    framing,
    theme,
    mode: "capture",
    upload: "1",
    cache: `batch-${rendering}-${framing}-${width}-${theme}-${Date.now()}`,
  });
  const loaded = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error(`child load timed out: ${width}x${height} ${theme}`)),
      60000,
    );
    frame.addEventListener("load", () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
  frame.src = `./issue2-final-polish-phase3b4a-harness.html?${query}`;
  await loaded;
  const startedAt = performance.now();
  while (performance.now() - startedAt < 120000) {
    const childStatus = frame.contentDocument?.body?.dataset?.auditStatus;
    if (childStatus === "passed") {
      document.body.dataset.batchCompleted = String(index + 1);
      return {
        width,
        height,
        theme,
        status: childStatus,
        resultLength:
          frame.contentDocument
            .getElementById("phase3b4aAuditResult")?.value.length || 0,
      };
    }
    if (childStatus === "failed") {
      throw new Error(
        frame.contentDocument
          .getElementById("phase3b4aAuditResult")?.value
        || "child capture failed",
      );
    }
    await delay(100);
  }
  throw new Error(`capture timed out: ${width}x${height} ${theme}`);
}

async function run() {
  document.body.dataset.batchStatus = "running";
  const rows = [];
  let index = 0;
  for (const [width, height] of viewports) {
    for (const theme of themes) {
      status.textContent =
        `${rendering} ${framing} ${width}x${height} ${theme}`;
      rows.push(await runOne(width, height, theme, index));
      index += 1;
    }
  }
  const result = { ok: true, rendering, framing, rows };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "passed";
  window.phase3b4aBatchResult = result;
  document.body.dataset.batchStatus = "passed";
  status.textContent = "Complete";
}

run().catch(error => {
  const result = {
    ok: false,
    rendering,
    framing,
    error: error.stack || error.message || String(error),
  };
  output.value = JSON.stringify(result);
  output.textContent = JSON.stringify(result);
  output.dataset.status = "failed";
  window.phase3b4aBatchResult = result;
  document.body.dataset.batchStatus = "failed";
  status.textContent = "Failed";
});
