import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  runPhase3B4cVirtualScenario,
} from "./final-stabilization-phase3b4c-r1-simulation.mjs";

const outputDirectory = path.resolve(
  "docs/evidence/final-stabilization-phase3b4c-ios-audio-pacing/reports",
);
await mkdir(outputDirectory, { recursive: true });

const report = {
  schemaVersion: 1,
  phase: "Final Stabilization Phase 3B.4c-R1",
  classification: "FREE_RUNNING_SPECIFIC_OR_STRONGLY_CORRELATED_AUDIO_FAILURE",
  sourceCommit: "82d55516a2bd6ebd2791c872f96569a741e88b02",
  generatedBy: "tests/generate-phase3b4c-r1-reproduction.mjs",
  scenarios: {
    freeRunning: runPhase3B4cVirtualScenario({ liveSync: false }),
    liveSync: runPhase3B4cVirtualScenario({ liveSync: true }),
  },
};
report.reproduced = report.scenarios.freeRunning.lastAudibleTime < 15
  && report.scenarios.freeRunning.trailingSilenceSeconds > 40
  && report.scenarios.liveSync.trailingSilenceSeconds <= 0.001;

await writeFile(
  path.join(outputDirectory, "free-running-starvation-reproduction.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
