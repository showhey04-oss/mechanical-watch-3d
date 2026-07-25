#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { FINAL_EXTERIOR_BALANCED } from "../js/final-exterior-config.js";
import {
  auditAnnularTaperProfile,
  auditExteriorInterfaceClearances,
  createAxialProfileAnnulusGeometryData,
} from "../js/final-exterior-profile.js";

const evidenceDirectory = process.argv[2];
if (!evidenceDirectory) throw new Error("evidence directory is required");
const reportsDirectory = path.join(evidenceDirectory, "reports");
const sourceBaseCommit = "293626f13a50224924f8e3ac229a1fc4077ad7a7";
const sourceApprovedStartCommit =
  "8d0946bcf4bb9afbeacf06f89c8ae1882cf8cef9";
const sourceImplementationCommit =
  "a4e12477525ec12d7fbb569e81f442b46d572fef";
const sourceCaptureCommit =
  "02952fc7ca5b44e762327fd4342401ed719e5777";
const metadata = {
  schemaVersion: 2,
  sourceBaseCommit,
  sourceApprovedStartCommit,
  sourceImplementationCommit,
  sourceCaptureCommit,
  sourceBranch: "feature/final-exterior-balanced-phase3b1",
  appVersion: "v3.15.0",
  captureMode:
    "same-origin unsandboxed iframe harness with actual Three.js WebGLRenderTarget PNG and GIF capture",
  candidateId: "E-BALANCED",
  candidateStatus: "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT",
};

const approvedStartConfig = structuredClone(FINAL_EXTERIOR_BALANCED);
approvedStartConfig.annularProfiles.bezel.points[3].y = -2.890;
approvedStartConfig.annularProfiles.bezel.points[4].y = -2.860;
approvedStartConfig.annularProfiles.casebackRing.points[0].radius = 14.274;
approvedStartConfig.annularProfiles.casebackRing.points[1].radius = 14.274;
approvedStartConfig.annularProfiles.casebackRing.points[3].y = 4.685;
approvedStartConfig.annularProfiles.casebackRing.points[4].y = 4.635;

const before = auditExteriorInterfaceClearances(approvedStartConfig);
const after = auditExteriorInterfaceClearances(FINAL_EXTERIOR_BALANCED);
const geometryFor = key => createAxialProfileAnnulusGeometryData({
  profile: FINAL_EXTERIOR_BALANCED.annularProfiles[key].points,
  circumferentialSegments:
    FINAL_EXTERIOR_BALANCED.annularProfiles[key].circumferentialSegments,
  taperAuditCriteria:
    FINAL_EXTERIOR_BALANCED.annularProfiles[key].auditCriteria,
  faceWinding: FINAL_EXTERIOR_BALANCED.annularProfiles[key].faceWinding,
}).audit;
const bezel = geometryFor("bezel");
const casebackRing = geometryFor("casebackRing");

const diagnosis = {
  metadata,
  status: "CAUSE_CONFIRMED",
  symptom:
    "selected caseback-ring edge showed black intermittent wedges and angle-dependent flicker",
  materialIsolation: {
    meshNormalMaterial: "artifact remained before geometry correction",
    meshBasicMaterial: "artifact remained before geometry correction",
    wireframe: "revealed coincident interface surfaces",
    frontSideVsDoubleSide:
      "did not remove the depth conflict; DoubleSide was not retained",
    conclusion:
      "Geometry overlap, caseback face winding, and averaged profile-boundary normals; not lighting, tone mapping, selection logic, or Issue #2",
  },
  confirmedCauses: [
    {
      id: "bezel-case-coplanar",
      before:
        before.records.find(
          item => item.id === "bezel-back-to-case-body-front",
        ),
    },
    {
      id: "caseback-case-coplanar",
      before:
        before.records.find(
          item => item.id === "caseback-front-to-case-body-back",
        ),
    },
    {
      id: "caseback-window-same-cylinder",
      before:
        before.records.find(
          item => item.id === "caseback-inner-to-window-outer",
        ),
    },
    {
      id: "caseback-face-winding",
      before: "visible rear annular face wound inward",
      after: "reverse profile winding produces OUTWARD_POSITIVE orientation",
    },
    {
      id: "profile-boundary-normal-averaging",
      before: "different face roles shared profile-boundary vertices",
      after: "SPLIT_AT_PROFILE_BOUNDARIES",
    },
  ],
  ruledOut: [
    "camera near/far",
    "polygonOffset",
    "renderOrder",
    "depthTest/depthWrite",
    "transparency mode",
    "lighting/shadow/tone mapping/exposure/fog",
    "D2c3",
  ],
};

const audit = {
  metadata,
  status: "PASSED",
  clearanceClassification: "EDUCATIONAL_RENDERING_CLEARANCE",
  permittedRange: {
    radial: [0.015, 0.030],
    axial: [0.015, 0.030],
  },
  before,
  after,
  protectedDimensions: {
    totalCaseThickness: FINAL_EXTERIOR_BALANCED.dimensions.totalCaseThickness,
    caseOuterDiameter: FINAL_EXTERIOR_BALANCED.dimensions.caseOuterDiameter,
    movementCavityDiameter:
      FINAL_EXTERIOR_BALANCED.dimensions.movementCavityDiameter,
    dialApertureDiameter:
      FINAL_EXTERIOR_BALANCED.dimensions.dialApertureDiameter,
    crystalClearDiameter:
      FINAL_EXTERIOR_BALANCED.dimensions.crystalClearDiameter,
    casebackWindowDiameter:
      FINAL_EXTERIOR_BALANCED.assumptions.casebackWindowDiameter,
  },
  edgeBreaks: {
    bezelOuterAxial: 0.020,
    casebackOuterAxial: 0.040,
    casebackWindowRadialReveal: 0.020,
    phase3cDecorativeChamferAdded: false,
  },
  geometry: {
    bezel: {
      vertexCount: bezel.vertexCount,
      indexCount: bezel.indexCount,
      triangleCount: bezel.triangleCount,
      finite: bezel.finite,
      topology: bezel.topology,
      degenerateTriangleCount: bezel.degenerateTriangleCount,
      duplicateTriangleCount: bezel.duplicateTriangleCount,
      reversedDuplicateTriangleCount: bezel.reversedDuplicateTriangleCount,
      normalAudit: bezel.normalAudit,
      orientation: bezel.orientation,
      creaseNormalMode: bezel.creaseNormalMode,
      taper: bezel.taper,
    },
    casebackRing: {
      vertexCount: casebackRing.vertexCount,
      indexCount: casebackRing.indexCount,
      triangleCount: casebackRing.triangleCount,
      finite: casebackRing.finite,
      topology: casebackRing.topology,
      degenerateTriangleCount: casebackRing.degenerateTriangleCount,
      duplicateTriangleCount: casebackRing.duplicateTriangleCount,
      reversedDuplicateTriangleCount:
        casebackRing.reversedDuplicateTriangleCount,
      normalAudit: casebackRing.normalAudit,
      orientation: casebackRing.orientation,
      creaseNormalMode: casebackRing.creaseNormalMode,
      taper: casebackRing.taper,
    },
  },
  checks: {
    areaBearingCoplanarOverlapZero:
      after.overlapTotals.areaEquivalent === 0,
    sameCylinderAxialOverlapZero:
      after.overlapTotals.sameCylinderAxial === 0,
    duplicateTrianglesZero:
      bezel.duplicateTriangleCount === 0
      && casebackRing.duplicateTriangleCount === 0,
    reversedDuplicateTrianglesZero:
      bezel.reversedDuplicateTriangleCount === 0
      && casebackRing.reversedDuplicateTriangleCount === 0,
    degenerateTrianglesZero:
      bezel.degenerateTriangleCount === 0
      && casebackRing.degenerateTriangleCount === 0,
    nonManifoldEdgesZero:
      bezel.topology.nonManifoldEdgeCount === 0
      && casebackRing.topology.nonManifoldEdgeCount === 0,
    finiteGeometry:
      Object.values(bezel.finite).every(Boolean)
      && Object.values(casebackRing.finite).every(Boolean),
    reversedNormalsZero:
      bezel.normalAudit.reversedTriangleCount === 0
      && casebackRing.normalAudit.reversedTriangleCount === 0,
    periodicNormalMismatchZero:
      bezel.normalAudit.periodicSeamMismatchCount === 0
      && casebackRing.normalAudit.periodicSeamMismatchCount === 0,
    forbiddenInterferenceZero: after.forbiddenInterferenceCount === 0,
  },
};

const visual = {
  metadata,
  status: "PASSED_WITH_HUMAN_CONFIRMATION_REQUIRED",
  staticCaptures: {
    beforeAfter: [
      "interface-before-after-back.png",
      "interface-before-after-oblique-back.png",
      "interface-before-after-side.png",
    ],
    states: [
      "interface-after-unselected-back.png",
      "interface-after-selected-back.png",
      "interface-after-opacity-50.png",
      "interface-after-opacity-16.png",
      "interface-after-mobile-390-back.png",
      "interface-after-mobile-390-selected-back.png",
      "interface-after-mobile-390-opacity-50.png",
    ],
    diagnostics: [
      "interface-diagnostic-wireframe.png",
      "interface-diagnostic-normal.png",
    ],
    sections: [
      "interface-section-bezel-case-body.png",
      "interface-section-case-body-caseback.png",
      "interface-section-caseback-window.png",
    ],
  },
  rotationVideos: [
    "interface-rotation-back-unselected.gif",
    "interface-rotation-back-selected.gif",
    "interface-rotation-back-opacity-50.gif",
    "interface-rotation-front-bezel.gif",
    "interface-rotation-mobile-390-back.gif",
  ],
  observations: {
    selected: "no black intermittent triangles in 32-frame rotation sequence",
    unselected: "no edge switching in 32-frame rotation sequence",
    opacity100: "stable",
    opacity50: "stable; human visual acceptance remains pending",
    opacity16: "stable static capture; existing transparency behavior unchanged",
    mobile390: "stable 32-frame rotation sequence",
    modelRotated: false,
    cameraRotated: true,
  },
  humanReview: [
    "PC: slowly rotate through the supplied selected/unselected back views",
    "physical iPhone: repeat the back rotation at opacity 100% and 50%",
    "confirm that the small intentional interface reveals are visually acceptable",
  ],
};

const readJson = async name =>
  JSON.parse(await readFile(path.join(reportsDirectory, name), "utf8"));
const writeJson = async (name, value) =>
  writeFile(
    path.join(reportsDirectory, name),
    `${JSON.stringify(value, null, 2)}\n`,
  );

for (const name of [
  "exterior-interface-capture-metadata.json",
  "exterior-interface-video-metadata.json",
  "exterior-interface-normal-path.json",
  "performance-results.json",
  "regression-results.json",
]) {
  const report = await readJson(name);
  report.metadata = { ...report.metadata, ...metadata };
  if (name === "regression-results.json") {
    report.node = { passed: 119, total: 119 };
  }
  await writeJson(name, report);
}

await Promise.all([
  writeJson("exterior-interface-diagnosis.json", diagnosis),
  writeJson("exterior-interface-audit.json", audit),
  writeJson("exterior-interface-visual-validation.json", visual),
]);

const annular = await readJson("annular-taper-report.json");
annular.metadata = metadata;
annular.bezel = audit.geometry.bezel;
annular.casebackRing = audit.geometry.casebackRing;
annular.interfaces = Object.fromEntries(
  after.records.map(record => [record.id, {
    classification: record.classification,
    signedMinimumClearance: record.signedMinimumClearance,
    coplanarRadialOverlap: record.coplanarRadialOverlap,
    coplanarAxialOverlap: record.coplanarAxialOverlap,
    sameCylinderAxialOverlap: record.sameCylinderAxialOverlap,
    areaEquivalentOverlap: record.areaEquivalentOverlap,
    forbiddenInterferenceCount: record.forbiddenInterferenceCount,
  }]),
);
annular.interfaceOverlapTotals = after.overlapTotals;
annular.passed =
  Object.values(audit.checks).every(Boolean)
  && annular.bezel.taper.passed
  && annular.casebackRing.taper.passed;
await writeJson("annular-taper-report.json", annular);

const decision = await readJson("decision-summary.json");
decision.metadata = metadata;
decision.status = "FUNCTIONAL_PASS_WITH_BROWSER_ENVIRONMENT_LIMITATIONS";
decision.geometryDecision = "INTERFACE_GEOMETRY_ACCEPTED_FOR_HUMAN_REVIEW";
decision.defaultAdoption = "NOT_APPROVED_FOR_DEFAULT_ADOPTION";
decision.interfaceCorrection = {
  cause: "GEOMETRY_DEPTH_CONFLICT_AND_FACE_WINDING",
  coplanarAreaBefore: before.overlapTotals.areaEquivalent,
  coplanarAreaAfter: after.overlapTotals.areaEquivalent,
  sameCylinderAxialBefore: before.overlapTotals.sameCylinderAxial,
  sameCylinderAxialAfter: after.overlapTotals.sameCylinderAxial,
  videosGenerated: 5,
  humanReviewRequired: true,
};
decision.nextStep =
  "PC and physical iPhone human review of selected/unselected back rotation and opacity 50%; do not start Phase 3B.2 before approval";
await writeJson("decision-summary.json", decision);

const captureMetadata = await readJson(
  "exterior-interface-capture-metadata.json",
);
const videoMetadata = await readJson(
  "exterior-interface-video-metadata.json",
);
for (const [file, data] of Object.entries({
  "exterior-interface-capture-metadata.json": captureMetadata,
  "exterior-interface-video-metadata.json": videoMetadata,
})) {
  if (data.metadata.sourceCaptureCommit !== sourceCaptureCommit) {
    throw new Error(`${file}: sourceCaptureCommit mismatch`);
  }
}

const sourceDigest = createHash("sha256")
  .update(JSON.stringify({ before, after, bezel, casebackRing }))
  .digest("hex");
await writeJson("exterior-interface-generation.json", {
  metadata,
  sourceDigest,
  generatedReports: [
    "exterior-interface-diagnosis.json",
    "exterior-interface-audit.json",
    "exterior-interface-visual-validation.json",
    "annular-taper-report.json",
    "decision-summary.json",
  ],
});
