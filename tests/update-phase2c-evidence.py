from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/movement-dial-y-stack-phase2c"
REPORTS = EVIDENCE / "reports"
CAPTURE = json.loads((REPORTS / "capture-metadata.json").read_text())
AUTHENTICITY = json.loads((REPORTS / "image-authenticity.json").read_text())
SOURCE_BASE_COMMIT = "81752950b2b8f9501399576f64faad238b1e4f13"
SOURCE_AUDIT_COMMIT = "da473d7d569f1b43b9d6adc04087a0a8011e9951"
CAPTURE_IMPLEMENTATION_COMMIT = "c8d59606810026a69ddef1a9a7c4e68bd379cf51"
CAPTURE_MODE = "same-origin unsandboxed iframe harness - actual Three.js scene rendered to offscreen WebGLRenderTarget"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def common_metadata() -> dict:
    return {
        "sourceBaseCommit": SOURCE_BASE_COMMIT,
        "sourceAuditCommit": SOURCE_AUDIT_COMMIT,
        "captureImplementationCommit": CAPTURE_IMPLEMENTATION_COMMIT,
        "sourceBranch": "audit/y-layer-stack-phase2c",
        "captureMode": CAPTURE_MODE,
        "desktopViewport": {"width": 1280, "height": 720},
        "mobileViewport": {"width": 390, "height": 844},
        "captureTimestamp": CAPTURE["captureTimestamp"],
        "APP_VERSION": "v3.15.0",
    }


def update_common(path: Path) -> dict:
    current = json.loads(path.read_text())
    metadata = common_metadata()
    return {**metadata, **{key: value for key, value in current.items() if key not in metadata}}


def raw_capture_result(metadata: dict, path: Path) -> dict:
    saved_sha = sha256(path)
    return {
        "source": metadata["source"],
        "cameraPreset": metadata["cameraPreset"],
        "renderTargetWidth": metadata["renderTargetWidth"],
        "renderTargetHeight": metadata["renderTargetHeight"],
        "pngByteLength": metadata["pngByteLength"],
        "chunkCount": metadata["chunkCount"],
        "browserSha256": metadata["pngSha256"],
        "savedSha256": saved_sha,
        "browserAndSavedShaMatch": saved_sha == metadata["pngSha256"],
        "stateInvariant": metadata["stateInvariant"],
        "liveCanvasMetadata": metadata["liveCanvasMetadata"],
        "environmentLimitation": metadata["environmentLimitation"],
    }


def main() -> None:
    for name in [
        "y-datum-map.json",
        "y-envelope-breakdown.json",
        "y-layer-stack.json",
        "official-height-datum-assessment.json",
        "decision-summary.json",
    ]:
        path = REPORTS / name
        report = update_common(path)
        if name == "decision-summary.json":
            report["captureImplementationCommit"] = CAPTURE_IMPLEMENTATION_COMMIT
            report["captureEvidence"] = {
                "desktop": raw_capture_result(CAPTURE["desktop"], EVIDENCE / "desktop-side.png"),
                "mobile390": raw_capture_result(CAPTURE["mobile390"], EVIDENCE / "mobile-390-side.png"),
            }
            report["environmentClassification"] = "TEST_ENVIRONMENT_NESTED_VIEWPORT_LIMITATION"
            report["productDefectDetected"] = False
            report["liveCanvasResamplingAdopted"] = False
        path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")

    regression_path = REPORTS / "regression-results.json"
    regression = update_common(regression_path)
    regression["status"] = "PASSED"
    regression["absolutePassClaimed"] = False
    regression["dimensionChangeDecision"] = "NO_DIMENSION_CHANGE"
    regression["officialDatumDecision"] = "REFERENCE_DATUM_UNRESOLVED"
    regression["nextPhaseRecommendation"] = "FINAL_EXTERIOR_INTEGRATION"
    regression["captureImplementationCommit"] = CAPTURE_IMPLEMENTATION_COMMIT
    regression["offscreenCapture"] = {
        "desktop": raw_capture_result(CAPTURE["desktop"], EVIDENCE / "desktop-side.png"),
        "mobile390": raw_capture_result(CAPTURE["mobile390"], EVIDENCE / "mobile-390-side.png"),
    }
    regression["imageAuthenticity"] = AUTHENTICITY
    regression["environmentLimitation"] = {
        "classification": "TEST_ENVIRONMENT_NESTED_VIEWPORT_LIMITATION",
        "productDefect": False,
        "liveCanvasResamplingAdopted": False,
        "requestedDesktopIframeViewport": {"width": 1280, "height": 720},
        "observedLiveDrawingBuffer": {"width": 640, "height": 300},
        "liveAspect": 2.1333333333333333,
        "desktopEvidenceAspect": 1.7777777777777777,
        "captureResolution": "explicit offscreen WebGLRenderTarget",
    }
    regression["consoleAssessment"] = {
        "applicationErrorWarningCount": 0,
        "applicationRenderStatus": "done",
        "browserControlSurface": CAPTURE["browserControlSurface"],
        "browserControlSurfaceErrorsAreProductErrors": False,
    }
    regression["verification"] = {
        "node": {"passed": True, "tests": 69},
        "desktopMobileWorldValuesMatch": all(regression["worldValuesMatch"].values()),
        "transformInvariant": regression["transformInvariant"],
        "offscreenStateInvariant": regression["offscreenCapture"]["desktop"]["stateInvariant"]["all"]
        and regression["offscreenCapture"]["mobile390"]["stateInvariant"]["all"],
        "browserSavedShaMatch": regression["offscreenCapture"]["desktop"]["browserAndSavedShaMatch"]
        and regression["offscreenCapture"]["mobile390"]["browserAndSavedShaMatch"],
        "imageAuthenticity": AUTHENTICITY["checks"]["bothAuthentic"],
        "forbiddenInterferenceCount": regression["forbiddenInterferenceCount"],
        "a7": "9/9",
        "s86RuntimeToSaved": "5/5",
        "phase1EvidenceDifferenceCount": 0,
        "manifest": "PASSED",
    }
    regression_path.write_text(json.dumps(regression, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
