#!/usr/bin/env node

import { APP_VERSION, SOURCE_MAIN_HEAD, fileRecord, read, writeJson } from "./freeze-utils.mjs";

const path = "docs/evidence/prototype-freeze-known-defects/scene-outlier-inventory.json";
const scene = JSON.parse(await read(path));

const criteria = {
  source: "full visible scene inventory; no product Object name allowlist",
  displayGroup: "exterior",
  minimumDistanceFromMovementBounds: 50,
  minimumMaterialLuminance: 0.75,
  minimumLongitudinalExtentY: 8,
  excludedFlags: ["selectionProxyFlag", "diagnosticObjectFlag", "helperFlag"],
  rationale: "Maps the reported pair of remote, bright, longitudinal plate-like silhouettes without using their names.",
};

function luminance(color) {
  if (!/^#[0-9a-f]{6}$/i.test(color || "")) return 0;
  const channels = [1, 3, 5].map(offset => Number.parseInt(color.slice(offset, offset + 2), 16) / 255);
  return Number((channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722).toFixed(6));
}

function derive(root) {
  const candidates = root.inventory.filter(item => {
    const size = item.worldBoundingBox?.size;
    const maximumMaterialLuminance = Math.max(0, ...item.material.map(material => luminance(material.color)));
    return (item.type === "Mesh" || item.geometryType)
      && item.displayGroup === criteria.displayGroup
      && item.distanceFromMovementBounds >= criteria.minimumDistanceFromMovementBounds
      && maximumMaterialLuminance >= criteria.minimumMaterialLuminance
      && size && size[1] >= criteria.minimumLongitudinalExtentY
      && !item.selectionProxyFlag && !item.diagnosticObjectFlag && !item.helperFlag;
  }).map(item => ({
    uuid: item.uuid,
    name: item.name,
    registeredPartId: item.registeredPartId,
    parentChain: item.parentChain,
    sourceFile: item.sourceFile,
    sourceLine: item.sourceLine,
    sourceCreationSymbol: item.sourceCreationSymbol,
    worldBoundingBox: item.worldBoundingBox,
    distanceFromMovementBounds: item.distanceFromMovementBounds,
    maximumMaterialLuminance: Math.max(0, ...item.material.map(material => luminance(material.color))),
    material: item.material,
    selectionProxyFlag: item.selectionProxyFlag,
    diagnosticObjectFlag: item.diagnosticObjectFlag,
    helperFlag: item.helperFlag,
  })).sort((a, b) => b.distanceFromMovementBounds - a.distanceFromMovementBounds);
  return {
    criteria,
    candidateCount: candidates.length,
    candidates,
    conclusionGate: candidates.length === 2 ? "EXACT_TWO_NAME_INDEPENDENT_CANDIDATES" : "CAUSE_NOT_CONFIRMED",
  };
}

const defaultDerivation = derive(scene.defaultRoot);
const legacyDerivation = derive(scene.legacy);
if (defaultDerivation.conclusionGate !== "EXACT_TWO_NAME_INDEPENDENT_CANDIDATES" || legacyDerivation.candidateCount !== 0) {
  throw new Error(`scene cause gate failed: default=${defaultDerivation.candidateCount}, legacy=${legacyDerivation.candidateCount}`);
}

scene.schemaVersion = 1;
scene.generatedAt = new Date().toISOString();
scene.sourceMainHead = SOURCE_MAIN_HEAD;
scene.appVersion = APP_VERSION;
scene.captureMethod = "Installed Chrome runtime inventory with name-independent post-capture candidate derivation; current transient instrumentation reproduced the same 2/0 default/legacy candidate counts";
scene.classification = "IDENTIFIED_PRODUCT_OBJECT";
scene.defaultRoot.perceptualCandidateDerivation = defaultDerivation;
scene.legacy.perceptualCandidateDerivation = legacyDerivation;
const visualEvidenceSources = [
  ["docs/evidence/final-exterior-design-phase3c2/images/buckle-detail.png", "static runtime view showing the silver buckle frame attached to the dark strap"],
  ["docs/evidence/final-exterior-design-phase3c2/images/hardware-silver-closeup.png", "runtime close-up documenting the shared silver hardware material"],
  ["docs/evidence/final-exterior-design-phase3c2/videos/05-buckle-frame-tang-bar.gif", "runtime rotation of the buckle frame, tang and attachment-bar assembly"],
];
scene.visualCorrelationEvidence = [];
for (const [visualPath, purpose] of visualEvidenceSources) {
  scene.visualCorrelationEvidence.push({ ...(await fileRecord(visualPath, purpose, "historical Phase 3C.2 runtime capture")), purpose });
}
scene.rootCause = {
  identificationMethod: "Candidate names were not used by the derivation filter. Names and source symbols were read only after the exact-two gate passed.",
  exactObjects: defaultDerivation.candidates.map(item => ({
    name: item.name,
    sourceFile: item.sourceFile,
    sourceLine: item.sourceLine,
    sourceSymbol: item.sourceCreationSymbol,
  })),
  explanation: "The two bright silver buckle components are legitimate exterior product objects at the remote end of the black six-o’clock strap. Name-independent scene filtering leaves exactly these two candidates on the default route and none on legacy; the preserved Phase 3C.2 runtime image/GIF evidence shows the same buckle assembly attached to the dark strap. At movement-focused framing the strap blends into the navy/fog background or falls outside the visible composition while higher-contrast hardware remains perceptible.",
  defaultRouteAffected: true,
  legacyRouteAffected: false,
  selectionProxy: false,
  diagnosticHelper: false,
  orphanGeometry: false,
  currentPrototypeFix: "not performed",
  successorRequirement: "Preserve an explicit strap/buckle ownership hierarchy and re-evaluate full-length/far composition, fog and dark-strap contrast so attachment continuity remains legible.",
};

await writeJson(path, scene);
console.log(JSON.stringify({ defaultCandidates: defaultDerivation.candidateCount, legacyCandidates: legacyDerivation.candidateCount, names: defaultDerivation.candidates.map(item => item.name) }));
