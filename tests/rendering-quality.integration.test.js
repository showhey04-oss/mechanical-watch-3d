function maxAbsolute(values) {
  return Math.max(0, ...values.map((value) => Math.abs(value)));
}

function changedStateCount(transition) {
  return Object.values(transition.changed).reduce((sum, value) => sum + value, 0);
}

export async function runRenderingQualityIntegrationTest(diagnostics) {
  const checks = [];
  const measurements = {};
  const check = (name, ok, detail = null) => checks.push({ name, ok: Boolean(ok), detail });
  const pipeline = diagnostics.getRenderPipelineReport();
  const candidate = pipeline.candidate;
  const modelBefore = diagnostics.getModelWorldSignature();

  const studioCandidates = ["studio-d1", "studio-d2", "studio-d3"];
  check("issue2-candidate-is-explicit-and-query-only", ["baseline", "shadow", "transparency", "lighting", ...studioCandidates].includes(candidate), pipeline);
  check("issue2-pipeline-keeps-srgb-aces-and-production-exposure", pipeline.outputColorSpace === "srgb"
    && pipeline.toneMapping === 4
    && pipeline.toneMappingExposure >= 0.82
    && pipeline.toneMappingExposure <= 1.12, pipeline);

  const shadow = diagnostics.getShadowCoverageReport();
  const structural = diagnostics.getStructuralMaterialReport();
  const structuralTransitions = diagnostics.getStructuralTransitionReport();
  check("issue2-shadow-and-material-reports-cover-real-model", shadow.frontKey.model.meshCount >= 480
    && structural.meshCount >= 100 && structural.materialCount >= structural.meshCount, {
    shadowMeshes: shadow.frontKey.model.meshCount,
    structuralMeshes: structural.meshCount,
    structuralMaterials: structural.materialCount,
  });
  check("issue2-shadow-and-material-reports-preserve-caster-receiver-flags", structuralTransitions.transitions.every((transition) => transition.changed.castShadow === 0
    && transition.changed.receiveShadow === 0), {
    initial: { castShadow: structural.states.castShadow, receiveShadow: structural.states.receiveShadow },
    transitions: structuralTransitions.transitions.map(({ from, to, changed }) => ({ from, to, castShadow: changed.castShadow, receiveShadow: changed.receiveShadow })),
  });

  if (candidate === "baseline") {
    check("issue2-baseline-retains-a7-shadow-defaults", shadow.frontKey.mapType === "PCFShadowMap"
      && shadow.frontKey.mapSize[0] === 512 && shadow.frontKey.mapSize[1] === 512
      && shadow.frontKey.camera.left === -5 && shadow.frontKey.camera.right === 5
      && shadow.frontKey.camera.top === 5 && shadow.frontKey.camera.bottom === -5, shadow.frontKey);
    const transitions = structuralTransitions;
    const oneHundredToNinetyNine = transitions.transitions.find((item) => item.from === 1 && item.to === 0.99);
    const fiftyFiveToFiftyFour = transitions.transitions.find((item) => item.from === 0.55 && item.to === 0.54);
    check("issue2-baseline-reproduces-transparent-discontinuity", oneHundredToNinetyNine?.changed.transparent > 0, oneHundredToNinetyNine);
    check("issue2-baseline-reproduces-depthwrite-discontinuity", fiftyFiveToFiftyFour?.changed.depthWrite > 0, fiftyFiveToFiftyFour);
    measurements.transitions = transitions;
  }

  if (candidate === "shadow") {
    check("issue2-shadow-candidate-uses-soft-map-and-device-budget", shadow.frontKey.mapType === "PCFSoftShadowMap"
      && shadow.frontKey.mapSize[0] === (innerWidth <= 420 ? 1024 : 2048)
      && shadow.frontKey.mapSize[1] === shadow.frontKey.mapSize[0], shadow.frontKey);
    check("issue2-shadow-candidate-tight-fit-contains-all-model-corners", shadow.fit?.allModelCornersInside === true
      && shadow.frontKey.model.insideCount === shadow.frontKey.model.worldCorners.length, shadow.fit);
    check("issue2-shadow-candidate-snaps-center-within-half-texel", shadow.fit?.snapDelta.every((value, index) => Math.abs(value) <= shadow.fit.texelSize[index] / 2 + 1e-9), shadow.fit);
    check("issue2-shadow-candidate-keeps-tight-four-percent-margin", shadow.fit?.marginXY.every((value, index) => value <= shadow.fit.rawLightSpace.span[index] * 0.05 + 0.6), shadow.fit);
    measurements.shadow = shadow;
  }

  if (candidate === "transparency") {
    const transitions = structuralTransitions;
    check("issue2-transparency-candidate-has-one-stable-render-state", transitions.states.every((state) => state.states.transparent.length === 1
      && state.states.transparent[0] === true
      && state.states.depthWrite.length === 1
      && state.states.depthWrite[0] === false), transitions.states.map(({ ratio, states }) => ({ ratio, states })));
    check("issue2-transparency-candidate-has-no-threshold-state-change", transitions.transitions.every((transition) => changedStateCount(transition) === 0), transitions.transitions);
    check("issue2-transparency-candidate-avoids-slider-shader-churn", transitions.transitions.every((transition) => transition.materialVersionDelta === 0), transitions.transitions);
    diagnostics.setStructuralOpacity(0.16);
    await diagnostics.waitForFrames(4);
    const selected = diagnostics.pickProjectedPart("設定車2");
    check("issue2-transparency-candidate-keeps-internal-selection", selected === "設定車2", { selected, pickLayers: diagnostics.getPickLayerReport() });
    diagnostics.clearSelectionInfo();
    diagnostics.setStructuralOpacity(1);
    measurements.transitions = transitions;
  }

  if (candidate === "lighting") {
    const lighting = diagnostics.getLightingQualityReport();
    const rigByName = Object.fromEntries(lighting.rig.lights.map((light) => [light.name, light]));
    check("issue2-lighting-candidate-adds-only-shadowless-camera-fill", lighting.issue2ViewFill.enabled
      && lighting.issue2ViewFill.type === "DirectionalLight"
      && lighting.issue2ViewFill.distanceInvariant
      && lighting.issue2ViewFill.cameraAttached
      && !lighting.issue2ViewFill.castShadow, lighting.issue2ViewFill);
    check("issue2-lighting-candidate-remains-subordinate-to-key", lighting.issue2ViewFill.keyRatio > 0
      && lighting.issue2ViewFill.keyRatio <= 0.05
      && rigByName.frontKey?.intensity === 1.96
      && rigByName.backKey?.intensity === 1.70
      && rigByName.cameraFill?.intensity === 0.38, lighting.rig);
    check("issue2-lighting-candidate-keeps-material-samples-finite", Object.values(lighting.materials).every((sample) => sample.inside
      && Number.isFinite(sample.averageLuminance)
      && sample.darkRatio >= 0 && sample.darkRatio <= 1
      && sample.clippedRatio >= 0 && sample.clippedRatio <= 1), lighting.materials);
    const frontBack = diagnostics.getFrontBackLuminanceReport({ themes: "all" });
    check("issue2-lighting-candidate-keeps-all-theme-front-back-balance", frontBack.allWithinThirtyPercent, frontBack);
    check("issue2-lighting-candidate-avoids-broad-frame-clipping", lighting.framebuffer.clippedRatio < 0.18, lighting.framebuffer);
    measurements.lighting = lighting;
    measurements.frontBack = frontBack;
  }

  if (studioCandidates.includes(candidate)) {
    const studio = diagnostics.getIssue2StudioRigReport();
    const activeLegacy = studio.legacyLights.filter((light) => light.currentIntensity > 0);
    check("issue2-studio-candidate-is-query-isolated-and-background-independent", studio.enabled
      && studio.candidate === candidate
      && studio.backgroundIndependent
      && studio.environment.applied
      && studio.environment.source === "PMREMGenerator.fromScene"
      && studio.environment.panels.length === 3
      && studio.environment.flags.length === 2
      && studio.initialization.generationCount === 1, studio);
    check("issue2-studio-candidate-removes-legacy-point-and-colored-lights-from-main-rig", activeLegacy.length === 0
      && studio.pointLightActive === false
      && studio.legacyLights.find((light) => light.name === "cameraFill")?.currentIntensity === 0, studio.legacyLights);
    check("issue2-studio-candidate-keeps-neutral-white-active-lights", [...studio.rectLights, ...(studio.shadowCarrier ? [studio.shadowCarrier] : [])]
      .every((light) => light.color === "#ffffff"), studio);

    if (candidate === "studio-d1") {
      check("issue2-d1-uses-only-pmrem-ibl-without-direct-or-shadow-light", studio.rectLights.length === 0
        && studio.shadowCarrier === null
        && studio.rectAreaUniformsInitialized === false, studio);
    } else {
      const [key, fill] = studio.rectLights;
      check("issue2-d2-d3-use-two-large-neutral-rect-area-lights", studio.rectAreaUniformsInitialized
        && studio.rectLights.length === 2
        && key.name === "studioRectKey" && key.intensity === 1 && key.size[0] >= 28 && key.size[1] >= 18
        && fill.name === "studioRectFill" && fill.intensity >= .25 && fill.intensity <= .35
        && !key.castShadow && !fill.castShadow, studio.rectLights);
      if (candidate === "studio-d2") {
        check("issue2-d2-has-no-shadow-casting-main-light", studio.shadowCarrier === null, studio);
      } else {
        const carrier = studio.shadowCarrier;
        const shadowUpdatePolicy = diagnostics.getIssue2StudioShadowUpdateReport();
        check("issue2-d3-uses-one-weak-neutral-shadow-carrier", carrier?.type === "DirectionalLight"
          && carrier.color === "#ffffff" && carrier.intensity >= .10 && carrier.intensity <= .20
          && carrier.castShadow && carrier.shadowIntensitySupported === false
          && carrier.effectiveShadowStrengthControl === "carrier-light-intensity", carrier);
        check("issue2-d3-shadow-carrier-uses-pcfsoft-fitted-and-texel-snapped", shadow.studioShadowCarrier?.mapType === "PCFSoftShadowMap"
          && shadow.studioShadowCarrier?.mapSize[0] === (innerWidth <= 420 ? 1024 : 2048)
          && shadow.fit?.light === "studioShadowCarrier"
          && shadow.fit?.allModelCornersInside === true
          && shadow.fit?.snapDelta.every((value, index) => Math.abs(value) <= shadow.fit.texelSize[index] / 2 + 1e-9)
          && shadowUpdatePolicy.strategy === "transform-driven-throttled"
          && shadowUpdatePolicy.autoUpdate === false
          && shadowUpdatePolicy.intervalMs === 200, { shadow, shadowUpdatePolicy });
      }
    }

    const phase2Framebuffer = diagnostics.getPhase2FramebufferReport();
    check("issue2-studio-candidate-mask-report-covers-model-without-crush-or-clipping", phase2Framebuffer.statistics.method === "model-silhouette-mask-pass"
      && phase2Framebuffer.statistics.sampleCount > 1000
      && phase2Framebuffer.statistics.darkRatio < .35
      && phase2Framebuffer.statistics.clippedRatio < .18
      && Number.isFinite(phase2Framebuffer.statistics.p99Luminance), phase2Framebuffer);
    measurements.studio = studio;
    measurements.phase2Framebuffer = phase2Framebuffer;
  }

  const handCoupling = diagnostics.getHandCouplingReport();
  check("issue2-candidate-preserves-three-hand-one-to-one-coupling", handCoupling.length === 3
    && maxAbsolute(handCoupling.map(({ error }) => error)) < 1e-7
    && maxAbsolute(handCoupling.map(({ mountDistance }) => mountDistance)) < 1e-6, handCoupling);
  const modelAfter = diagnostics.getModelWorldSignature();
  check("issue2-diagnostics-do-not-transform-model-root", JSON.stringify(modelBefore.root) === JSON.stringify(modelAfter.root), {
    before: modelBefore.root,
    after: modelAfter.root,
  });

  measurements.candidate = candidate;
  measurements.pipeline = pipeline;
  measurements.structural = {
    ratio: structural.ratio,
    meshCount: structural.meshCount,
    materialCount: structural.materialCount,
    states: structural.states,
  };
  measurements.visualDecisionRequired = candidate === "shadow"
    ? "Confirm full-area structural shadow darkness before integration."
    : candidate === "transparency"
      ? "Confirm opaque-mode depth ordering before integration."
      : candidate === "lighting"
        ? "Confirm metal contrast and physical iPhone brightness before integration."
        : candidate === "studio-d1"
          ? "Rejected after fixed-matrix comparison; PMREM-only base illumination is insufficient. Do not integrate."
          : ["studio-d2", "studio-d3"].includes(candidate)
            ? "Hold for fixed-matrix visual comparison and physical iPhone Safari approval; do not integrate."
            : "Baseline diagnosis only.";
  return { ok: checks.every(({ ok }) => ok), checks, measurements };
}
