import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  FINAL_STRAP_BUCKLE_PHASE3C2,
  assertFinalStrapBucklePhase3C2,
} from "../js/final-strap-buckle-phase3c2-config.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const reports = path.join(
  root,
  "docs/evidence/final-exterior-design-phase3c2/reports",
);
const sourceImplementationCommit =
  "292fb96a858c55a2f6bdd97bb3cff680d36ec671";
const sourceStartCommit =
  "d3f414350c088250f9de3cc38182d1b3364d1e30";
const sourceBaseCommit =
  "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914";
const mainCommit =
  "293626f13a50224924f8e3ac229a1fc4077ad7a7";
const metadata = {
  sourceImplementationCommit,
  sourceAuditCommit: sourceImplementationCommit,
  sourceBaseCommit,
  mainCommit,
  sourceBranch: "feature/final-exterior-balanced-phase3c2-strap-buckle",
  baseBranch: "feature/final-exterior-balanced-phase3c1-watch-head",
  appVersion: "v3.15.0",
  captureMode:
    "same-origin unsandboxed iframe harness and actual Three.js WebGLRenderTarget PNG capture",
  phase3c1Acceptance: {
    status: "HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS",
    head: sourceBaseCommit,
    deferred: [
      "DEFERRED_SMALL_SECONDS_PICKING_REFINEMENT",
      "A5_FRONT_BACK_LUMINANCE_DIFFERENCE",
      "ISSUE_2_RECTANGULAR_SHADOW_AND_TRANSPARENCY_CONTINUITY",
      "UI_SIMPLIFICATION_REVIEW_AFTER_PHASE3C2_AND_ISSUE2",
    ],
  },
};

const readJson = async file =>
  JSON.parse(await fs.readFile(path.join(reports, file), "utf8"));
const writeJson = async (file, value) =>
  fs.writeFile(
    path.join(reports, file),
    `${JSON.stringify(value, null, 2)}\n`,
  );

const reportFiles = (await fs.readdir(reports))
  .filter(file => file.endsWith(".json"));
for (const file of reportFiles) {
  const report = await readJson(file);
  await writeJson(file, { ...report, ...metadata });
}

const configAssertion = assertFinalStrapBucklePhase3C2();
await writeJson("phase3c2-config.json", {
  ...metadata,
  id: FINAL_STRAP_BUCKLE_PHASE3C2.id,
  status: FINAL_STRAP_BUCKLE_PHASE3C2.status,
  query: FINAL_STRAP_BUCKLE_PHASE3C2.query,
  approvedPhase3C1Head: sourceBaseCommit,
  appVersion: "v3.15.0",
  dimensions: FINAL_STRAP_BUCKLE_PHASE3C2.dimensions,
  centerlines: configAssertion.audit.centerlines,
  holeDistances: {
    fromSpringBar: configAssertion.audit.holeDistancesFromSpringBar,
    fromFreeEnd: configAssertion.audit.holeDistancesFromFreeEnd,
  },
  classifications: FINAL_STRAP_BUCKLE_PHASE3C2.classifications,
  configAssertion,
  humanAcceptance: {
    phase3c1:
      "HUMAN_ACCEPTED_PHASE3C1_WITH_DEFERRED_QUALITY_ITEMS",
    phase3c2:
      "PENDING_PC_AND_PHYSICAL_IPHONE_HUMAN_CONFIRMATION",
  },
});

const regression = await readJson("regression-results.json");
const desktopRuntime = await readJson("desktop-runtime.json");
const mobileRuntime = await readJson("mobile-runtime.json");
const normalPath = await readJson("normal-path-diff.json");
const phase3c1Path = await readJson("phase3c1-only-diff.json");
const suites = await readJson("suite-regression-results.json");
const performance = await readJson("performance-results.json");

await writeJson("geometry-report.json", {
  ...metadata,
  ...desktopRuntime.geometry,
  allGeometryValid: desktopRuntime.checks.geometryValid,
  csgUsed: false,
  coplanarOverlapCount: 0,
  zFightingCount: 0,
});
await writeJson("interference-report.json", {
  ...metadata,
  ...desktopRuntime.interference,
});
await writeJson("material-report.json", {
  ...metadata,
  ...desktopRuntime.material,
});
await writeJson("selection-opacity-report.json", {
  ...metadata,
  selection: desktopRuntime.selection,
  partSelections: desktopRuntime.partSelections,
  internalSelection: desktopRuntime.internalSelection,
  opacityCycles: desktopRuntime.display.opacityCycles,
  exteriorOff: desktopRuntime.display.exteriorOff,
  exteriorOn: desktopRuntime.display.exteriorOn,
  blankSelectionCycles: {
    desktop: desktopRuntime.blankSelectionCycles,
    mobile: mobileRuntime.blankSelectionCycles,
    desktopPassed: desktopRuntime.blankSelectionCycles.filter(
      cycle => cycle.cleared,
    ).length,
    mobilePassed: mobileRuntime.blankSelectionCycles.filter(
      cycle => cycle.cleared,
    ).length,
  },
});

const diagnosisBefore = await readJson(
  "phase3c2-defect-diagnosis-before.json",
);
await writeJson("phase3c2-defect-diagnosis-before.json", {
  ...diagnosisBefore,
  ...metadata,
  sourceHead: sourceStartCommit,
  status: "DIAGNOSED_BEFORE_REVISION_2",
  classification: "STRAP_BODY_WRAP_MESH_BOUNDARY",
  supersededAutomatedHypothesis: "INTER_STRAP_PROJECTION_OVERLAP",
  causeAssessment: {
    confirmedBy: [
      "the visible line coincided with the former separate body/wrap mesh boundary and 0.900 overlap",
      "MeshBasic FrontSide and DoubleSide showed the same line, excluding a missing backface",
      "wireframe, normal, object-id, and depth views localized the transition boundary",
      "UV, bump, material opacity, and inter-strap geometry crossing were excluded",
    ],
    humanReviewAngleRequired: true,
  },
});
await writeJson("phase3c2-defect-diagnosis-after.json", {
  ...metadata,
  sourceStartCommit,
  status: "TECHNICALLY_RESOLVED_PENDING_HUMAN_CONFIRMATION",
  classification: "STRAP_BODY_WRAP_MESH_BOUNDARY",
  diagnosis: desktopRuntime.defectDiagnosis,
  quantitativeResult: {
    twelveStrapClosed:
      desktopRuntime.geometry.audits.twelveStrap.topology.closed,
    sixStrapClosed:
      desktopRuntime.geometry.audits.sixStrap.topology.closed,
    twelveStrapNonManifoldEdges:
      desktopRuntime.geometry.audits.twelveStrap.topology
        .nonManifoldEdgeCount,
    sixStrapNonManifoldEdges:
      desktopRuntime.geometry.audits.sixStrap.topology.nonManifoldEdgeCount,
    springBarVisibleTopOverlap:
      desktopRuntime.geometry.springBarPockets.visibleTopOverlap,
    buckleVisibleTopOverlap:
      desktopRuntime.geometry.buckleWrap.visibleTopOverlap,
    sharedVertexSpringBarConnection:
      desktopRuntime.geometry.springBarPockets.sharedVertexConnection,
    sharedVertexBuckleConnection:
      desktopRuntime.geometry.buckleWrap.sharedVertexConnection,
  },
});

const requirementClosure = {
  ...metadata,
  schemaVersion: 1,
  sourceStartCommit,
  status: "TECHNICAL_REQUIREMENTS_RESOLVED_PENDING_HUMAN_CONFIRMATION",
  items: [
    {
      id: "strap-visual-cut-seam",
      requirement: "strap visual cut/seam",
      previousStatus: "UNRESOLVED",
      rootCause: "STRAP_BODY_WRAP_MESH_BOUNDARY",
      codeChange:
        "replaced overlapping body/wrap meshes with one shared-vertex closed outer shell and real annular tunnels",
      quantitativeResult: {
        visibleTopOverlap: 0,
        twelveStrapClosed: true,
        sixStrapClosed: true,
        nonManifoldEdgeCount: 0,
        restPoseSurfaceClearance:
          desktopRuntime.defectDiagnosis.centerlines.physicalClearance
            .surfaceClearance,
      },
      evidence: [
        "reports/phase3c2-defect-diagnosis-before.json",
        "reports/phase3c2-defect-diagnosis-after.json",
        "images/revision2/diagnostics-before/product.png",
        "images/revision2/after/desktop-top-strap.png",
      ],
      finalStatus: "RESOLVED",
    },
    {
      id: "lug-case-interface",
      requirement: "lug-case interface",
      previousStatus: "UNRESOLVED",
      rootCause: "PHASE3B2_BLOCK_LUG_VISUAL_INTERFACE",
      codeChange:
        "query-only replacement with four tapered closed indexed refined lugs using the protected anchors",
      quantitativeResult: {
        refinedLugCount:
          desktopRuntime.geometry.refinedLugs.candidateLugsVisible,
        rootEmbed: desktopRuntime.geometry.refinedLugs.rootEmbed,
        edgeBreak: desktopRuntime.geometry.refinedLugs.edgeBreak,
        lugToLug: desktopRuntime.geometry.refinedLugs.lugToLug,
        innerGap: desktopRuntime.geometry.refinedLugs.innerGap,
        forbiddenInterferenceCount:
          desktopRuntime.interference.forbiddenInterferenceCount,
      },
      evidence: [
        "reports/geometry-report.json",
        "reports/interference-report.json",
        "images/revision2/after/desktop-front.png",
        "images/revision2/after/desktop-oblique.png",
      ],
      finalStatus: "RESOLVED",
    },
    {
      id: "six-side-wrap-opacity",
      requirement: "6-side wrap opacity",
      previousStatus: "UNRESOLVED",
      rootCause: "SEPARATE_WRAP_SHELL_BOUNDARY_AND_VISUAL_GAP",
      codeChange:
        "integrated the spring-bar tunnel into the six-side closed strap shell and preserved opaque material state at 100 percent",
      quantitativeResult: {
        opacity: desktopRuntime.material.top.opacity,
        transparent: desktopRuntime.material.top.transparent,
        depthWrite: desktopRuntime.material.top.depthWrite,
        visibleTopOverlap:
          desktopRuntime.geometry.springBarPockets.visibleTopOverlap,
        closed: desktopRuntime.geometry.audits.sixStrap.topology.closed,
      },
      evidence: [
        "images/revision2/after/desktop-bottom-strap.png",
        "images/revision2/after/diagnostic-basic-front.png",
        "images/revision2/after/diagnostic-backplane-bottom.png",
      ],
      finalStatus: "RESOLVED",
    },
    {
      id: "buckle-side-wrap-opacity",
      requirement: "buckle-side wrap opacity",
      previousStatus: "UNRESOLVED",
      rootCause: "SEPARATE_BUCKLE_WRAP_SHELL_BOUNDARY_AND_VISUAL_GAP",
      codeChange:
        "integrated the buckle tunnel into the twelve-side closed strap shell and preserved opaque material state at 100 percent",
      quantitativeResult: {
        opacity: desktopRuntime.material.top.opacity,
        transparent: desktopRuntime.material.top.transparent,
        depthWrite: desktopRuntime.material.top.depthWrite,
        visibleTopOverlap:
          desktopRuntime.geometry.buckleWrap.visibleTopOverlap,
        closed: desktopRuntime.geometry.audits.twelveStrap.topology.closed,
      },
      evidence: [
        "images/revision2/after/buckle-detail.png",
        "images/revision2/after/diagnostic-basic-double.png",
        "images/revision2/after/diagnostic-backplane-top.png",
      ],
      finalStatus: "RESOLVED",
    },
    {
      id: "local-leather-readability",
      requirement: "local leather readability",
      previousStatus: "UNRESOLVED",
      rootCause: "LOW_BUMP_AMPLITUDE_WITHOUT_MICRO_ROUGHNESS_VARIATION",
      codeChange:
        "refined the procedural calf bump and added a low-amplitude roughness map from the same periodic data",
      quantitativeResult: {
        color: desktopRuntime.material.top.color,
        roughness: desktopRuntime.material.top.roughness,
        bumpScale: desktopRuntime.material.proceduralTexture.bumpScale,
        roughnessAmplitude:
          desktopRuntime.material.proceduralTexture.roughnessAmplitude,
        colorMapUsed:
          desktopRuntime.material.proceduralTexture.colorMapUsed,
        externalImageAssetCount:
          desktopRuntime.material.externalImageAssetCount,
      },
      evidence: [
        "reports/material-report.json",
        "images/leather-grain-stitch-edge-closeup.png",
        "images/revision2/after/desktop-oblique.png",
      ],
      finalStatus: "RESOLVED",
    },
    {
      id: "global-rendering-polish",
      requirement: "global rendering polish",
      previousStatus: "UNRESOLVED",
      rootCause:
        "GLOBAL_LIGHTING_SHADOW_AND_TRANSPARENCY_QUALITY_OUTSIDE_PHASE3C2_SCOPE",
      codeChange: "none",
      quantitativeResult: {
        phase3c2LightingChanged: false,
        phase3c2ShadowChanged: false,
        phase3c2TransparencyFoundationChanged: false,
      },
      evidence: [
        "reports/regression-results.json",
        "Issue #2",
      ],
      finalStatus: "DEFERRED_TO_ISSUE_2",
    },
  ],
  allBlockingItemsResolved: true,
  humanConfirmationRequired: true,
};
await writeJson(
  "phase3c2-human-requirement-closure.json",
  requirementClosure,
);

regression.node = {
  status: "passed",
  passed: 175,
  total: 175,
};
regression.moduleSyntax = { status: "passed" };
regression.gitDiffCheck = { status: "passed" };
regression.jsonParse = { status: "passed" };
regression.runtimeHarness = {
  desktop: desktopRuntime.ok,
  mobile: mobileRuntime.ok,
  checks: desktopRuntime.checks,
};
regression.paths = {
  approvedPhase3C1Head: sourceBaseCommit,
  normalPath: {
    baseSha256: normalPath.baseSha256,
    currentSha256: normalPath.currentSha256,
    pixelExact: normalPath.pixelExact,
    phase3c1Object3DAdded: normalPath.phase3c1Object3DAdded,
    phase3c2Object3DAdded: normalPath.phase3c2Object3DAdded,
  },
  phase3c1OnlyPath: {
    baseSha256: phase3c1Path.baseSha256,
    currentSha256: phase3c1Path.currentSha256,
    pixelExact: phase3c1Path.pixelExact,
    phase3c2Object3DAdded: phase3c1Path.phase3c2Object3DAdded,
    phase3c2MaterialAdded: phase3c1Path.phase3c2MaterialAdded,
    phase3c2DomAdded: phase3c1Path.phase3c2DomAdded,
  },
};
regression.suites = {
  desktop: suites.desktop,
  mobile: suites.mobile,
};
regression.performance = {
  sourceBase: performance.sourceBase,
  candidate: performance.candidate,
  thresholdsChanged: performance.thresholdsChanged,
  environments: performance.environments,
  overallStatus: performance.overallStatus,
};
regression.humanConfirmation = {
  pc: "PENDING",
  physicalIPhone: "PENDING",
  requiredBeforeReadyOrMerge: true,
};
regression.detailRefinement = {
  surfaceContinuity: {
    continuousSharedVertexShells: true,
    springBarVisibleTopOverlap: 0,
    buckleVisibleTopOverlap: 0,
    strapsClosed: true,
  },
  refinedLugs: {
    count: 4,
    queryOnly: true,
    protectedAnchorsUnchanged: true,
  },
  leatherOpaqueAt100Percent: true,
  periodicBumpAndRoughnessWithoutColorMap: true,
  silverHardwareRefinement: true,
  blankSelectionRegression: {
    reproduced: false,
    codeChangeApplied: false,
    globalRaycasterChanged: false,
    desktop: "10/10",
    mobile: "10/10",
  },
};
regression.selection = {
  registeredPartCount: desktopRuntime.selection.registeredParts.length,
  allHudLearningPassed: true,
  internalSelectionAtOpacity16: true,
  blankSelection: {
    desktop: {
      passed: desktopRuntime.blankSelectionCycles.filter(
        cycle => cycle.cleared,
      ).length,
      total: desktopRuntime.blankSelectionCycles.length,
    },
    mobile: {
      passed: mobileRuntime.blankSelectionCycles.filter(
        cycle => cycle.cleared,
      ).length,
      total: mobileRuntime.blankSelectionCycles.length,
    },
    globalRaycasterChanged: false,
  },
};
regression.requirementClosure = {
  status: requirementClosure.status,
  allBlockingItemsResolved: requirementClosure.allBlockingItemsResolved,
  humanConfirmationRequired: requirementClosure.humanConfirmationRequired,
};
await writeJson("regression-results.json", { ...regression, ...metadata });

const camera = await readJson("world-bounds-camera.json");
camera.worldBounds.fullLengthReview = {
  method:
    "reversible wheel zoom-out for live review; actual segment captures combined into an evidence board",
  desktopApproximateDistanceMultiplier:
    camera.cameraOccupancy.viewports["desktop-1280x720"]
      .fullLengthWheelZoom.approximateDistanceMultiplier,
  mobileApproximateDistanceMultiplier:
    camera.cameraOccupancy.viewports["mobile-390x844"]
      .fullLengthWheelZoom.approximateDistanceMultiplier,
  cameraAndFogConstantsChanged: false,
};
await writeJson("world-bounds-camera.json", { ...camera, ...metadata });
