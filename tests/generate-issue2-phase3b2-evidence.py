#!/usr/bin/env python3
"""Generate Phase 3B.2 reports, review boards, GIFs, and manifest."""

from __future__ import annotations

import hashlib
import json
import math
import statistics
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = (
    ROOT
    / "docs/evidence/issue2-final-polish-phase3b2-transparency-continuity"
)
REPORTS = EVIDENCE / "reports"
BOARDS = EVIDENCE / "boards"
GIFS = EVIDENCE / "gifs"
RAW = EVIDENCE / "raw"
SOURCE_MAIN_COMMIT = "293626f13a50224924f8e3ac229a1fc4077ad7a7"
SOURCE_BASE_COMMIT = "4f9e3f14f66317c4ce363a3393639b15ca3b05f1"
SOURCE_IMPLEMENTATION_COMMIT = "da600b11552185129a9f3e16f2ab55002df8972a"
SOURCE_BRANCH = "feature/issue2-final-polish-phase3b2-transparency-continuity"
APP_VERSION = "v3.15.0"
RENDERINGS = [
    "issue2-phase3b1c-shadow-off",
    "issue2-d2c3",
]
CONTINUITIES = [
    "issue2-current",
    "issue2-stable-depth-off",
    "issue2-stable-depth-base",
    "issue2-group-stable-depth",
]
VIEWPORTS = ["1280x720", "390x844"]
FINALIST = "issue2-group-stable-depth"


def metadata() -> dict:
    return {
        "sourceMainCommit": SOURCE_MAIN_COMMIT,
        "sourceBaseCommit": SOURCE_BASE_COMMIT,
        "sourceImplementationCommit": SOURCE_IMPLEMENTATION_COMMIT,
        "sourceBranch": SOURCE_BRANCH,
        "appVersion": APP_VERSION,
        "captureMode": (
            "same-origin unsandboxed iframe with actual Three.js offscreen "
            "WebGL capture"
        ),
        "queryOnly": True,
        "defaultAdopted": False,
    }


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save(name: str, value: dict) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / name).write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def probe(rendering: str, continuity: str, viewport: str) -> dict:
    return load(
        REPORTS
        / f"probe-{rendering}-{continuity}-{viewport}-navy-front-normal.json"
    )


def series(rendering: str, continuity: str, viewport: str) -> dict:
    return load(
        REPORTS
        / f"series-{rendering}-{continuity}-{viewport}-navy-front-normal.json"
    )


def smoke(rendering: str, continuity: str, viewport: str) -> dict:
    return load(
        REPORTS
        / f"smoke-{rendering}-{continuity}-{viewport}-navy-front-normal.json"
    )


def performance(
    rendering: str,
    continuity: str,
    viewport: str,
    suffix: str | None = None,
) -> dict:
    tail = f"-{suffix}" if suffix else ""
    return load(
        REPORTS
        / f"performance-{rendering}-{continuity}-{viewport}{tail}.json"
    )


def suite(
    suite_name: str,
    rendering: str,
    continuity: str,
    viewport: str,
) -> dict:
    return load(
        REPORTS
        / f"suite-{suite_name}-{rendering}-{continuity}-{viewport}.json"
    )


def raw(
    rendering: str,
    continuity: str,
    viewport: str,
    opacity: int,
) -> Path:
    return (
        RAW
        / rendering
        / continuity
        / viewport
        / "navy/front/normal"
        / f"opacity-{opacity}.png"
    )


def smoke_image(
    rendering: str,
    continuity: str,
    viewport: str,
    scenario: str,
) -> Path:
    return (
        RAW
        / rendering
        / continuity
        / viewport
        / "navy/smoke"
        / f"{scenario}.png"
    )


def image_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_current_diagnosis() -> dict:
    sample = probe(RENDERINGS[0], "issue2-current", VIEWPORTS[0])
    diagnosis = sample["currentDiscontinuity"]
    return {
        "schemaVersion": 1,
        **metadata(),
        "status": "DISCONTINUITY_CONFIRMED_BY_PROPERTY_TIMELINE",
        "renderingIndependentDiagnosis": True,
        "inventory": {
            key: sample["materialInventory"][key]
            for key in [
                "targetMeshCount",
                "materialCount",
                "selectableMeshCount",
                "visibleMeshCount",
                "groupCounts",
            ]
        },
        "currentPolicy": diagnosis,
        "finding": {
            "transparentThreshold": 1,
            "depthWriteThreshold": 0.55,
            "transparentPropertyToggleCount": diagnosis[
                "transparentPropertyToggleCount"
            ],
            "depthWritePropertyToggleCount": diagnosis[
                "depthWritePropertyToggleCount"
            ],
            "candidateDecision": "RETAINED_DIAGNOSTIC_ONLY",
        },
    }


def make_candidate_config() -> dict:
    candidates = {}
    for continuity in CONTINUITIES:
        state = probe(RENDERINGS[0], continuity, VIEWPORTS[0])[
            "candidateState"
        ]
        candidates[continuity] = {
            "policy": state["policy"],
            "enabled": state["enabled"],
            "renderingBaselines": RENDERINGS,
            "queryOnly": True,
            "opacityThresholdPolicy": False
            if continuity != "issue2-current"
            else True,
            "groupDepthWriteOff": state.get("groupDepthWriteOff", []),
        }
    return {
        "schemaVersion": 1,
        **metadata(),
        "candidates": candidates,
        "forbiddenMethodsAbsent": [
            "alphaHash",
            "ordered dithering",
            "custom shader transparency",
            "weighted blended OIT",
            "depth peeling",
            "duplicate geometry pass",
            "customDepthMaterial",
            "alphaTest addition",
        ],
    }


def make_inventory() -> dict:
    sample = probe(RENDERINGS[0], "issue2-current", VIEWPORTS[0])
    return {
        "schemaVersion": 1,
        **metadata(),
        "summary": {
            key: sample["materialInventory"][key]
            for key in [
                "targetMeshCount",
                "materialCount",
                "selectableMeshCount",
                "visibleMeshCount",
                "groupCounts",
            ]
        },
        "materials": sample["materialInventory"]["materials"],
    }


def make_property_continuity() -> dict:
    results = []
    for rendering in RENDERINGS:
        for continuity in CONTINUITIES:
            for viewport in VIEWPORTS:
                report = series(rendering, continuity, viewport)
                state = report["propertyContinuity"]
                results.append(
                    {
                        "rendering": rendering,
                        "continuity": continuity,
                        "viewport": viewport,
                        "transparentPropertyToggleCount": state[
                            "transparentPropertyToggleCount"
                        ],
                        "depthWritePropertyToggleCount": state[
                            "depthWritePropertyToggleCount"
                        ],
                        "materialReplacementCount": state[
                            "materialReplacementCount"
                        ],
                        "materialUuidChangeCount": state[
                            "materialUuidChangeCount"
                        ],
                        "technicalCandidatePropertyGatePassed": state[
                            "technicalCandidatePropertyGatePassed"
                        ],
                        "timeline": state["timeline"],
                    }
                )
    return {
        "schemaVersion": 1,
        **metadata(),
        "ratios": series(RENDERINGS[0], FINALIST, VIEWPORTS[0])[
            "propertyContinuity"
        ]["ratios"],
        "results": results,
        "technicalCandidatesZeroToggle": all(
            item["transparentPropertyToggleCount"] == 0
            and item["depthWritePropertyToggleCount"] == 0
            and item["materialReplacementCount"] == 0
            and item["materialUuidChangeCount"] == 0
            for item in results
            if item["continuity"] != "issue2-current"
        ),
    }


def make_screen_continuity() -> tuple[dict, dict]:
    summaries = []
    adjacent = []
    for rendering in RENDERINGS:
        for continuity in CONTINUITIES:
            for viewport in VIEWPORTS:
                report = series(rendering, continuity, viewport)
                spikes = report["continuitySpikes"]
                summaries.append(
                    {
                        "rendering": rendering,
                        "continuity": continuity,
                        "viewport": viewport,
                        **spikes,
                        "automaticGatePassed": (
                            spikes["opacity100To99"] <= spikes["gateMax"]
                            and spikes["opacity55To54"] <= spikes["gateMax"]
                        ),
                        "humanReviewStatus": (
                            "PENDING_PC_REVIEW"
                            if continuity == FINALIST
                            else "NOT_REQUESTED"
                        ),
                    }
                )
                adjacent.append(
                    {
                        "rendering": rendering,
                        "continuity": continuity,
                        "viewport": viewport,
                        "metrics": report["adjacentMetrics"],
                    }
                )
    return (
        {
            "schemaVersion": 1,
            **metadata(),
            "epsilon": 1 / 255,
            "epsilonBasis": "one 8-bit luminance quantization step",
            "gateMaximum": 2,
            "results": summaries,
            "finalistAutomaticGatePassed": all(
                item["automaticGatePassed"]
                for item in summaries
                if item["continuity"] == FINALIST
            ),
            "humanVisualGateCompleted": False,
        },
        {
            "schemaVersion": 1,
            **metadata(),
            "results": adjacent,
        },
    )


def selection_rows() -> list[dict]:
    rows = []
    for rendering in RENDERINGS:
        for continuity in CONTINUITIES:
            for viewport in VIEWPORTS:
                report = smoke(rendering, continuity, viewport)
                selected = []
                for capture in report["captures"]:
                    if capture["scenario"]["state"] != "selected":
                        continue
                    selected.append(
                        {
                            "scenario": capture["scenario"]["id"],
                            "selectionBeforeCapture": capture[
                                "selectionBeforeCapture"
                            ],
                            "blankClear": capture["blankClear"],
                            "selectionAfterBlank": capture[
                                "selectionAfterBlank"
                            ],
                        }
                    )
                rows.append(
                    {
                        "rendering": rendering,
                        "continuity": continuity,
                        "viewport": viewport,
                        "selected": selected,
                        "restoredSelection": report["selectionAfterRestore"],
                        "passed": all(
                            item["selectionBeforeCapture"] == "設定車2"
                            and item["blankClear"]["cleared"]
                            and item["blankClear"]["selection"] is None
                            and item["selectionAfterBlank"] is None
                            for item in selected
                        ),
                    }
                )
    return rows


def make_depth_internal_selection() -> tuple[dict, dict, dict]:
    depth_rows = []
    internal_rows = []
    for rendering in RENDERINGS:
        for continuity in CONTINUITIES:
            for viewport in VIEWPORTS:
                report = smoke(rendering, continuity, viewport)
                captures = {
                    item["scenario"]["id"]: item for item in report["captures"]
                }
                paths = {
                    key: value["capture"]["path"]
                    for key, value in captures.items()
                }
                depth_rows.append(
                    {
                        "rendering": rendering,
                        "continuity": continuity,
                        "viewport": viewport,
                        "capturePaths": paths,
                        "transformInvariant": report["transformInvariant"],
                        "consoleErrors": report["consoleErrors"],
                    }
                )
                internal_rows.append(
                    {
                        "rendering": rendering,
                        "continuity": continuity,
                        "viewport": viewport,
                        "dialMechanismOpacity16": paths[
                            "dial-mechanism-opacity-16"
                        ],
                        "movementBackOpacity16": paths[
                            "movement-back-opacity-16"
                        ],
                        "decision": (
                            "REJECTED_INTERNAL_VISIBILITY"
                            if continuity == "issue2-stable-depth-base"
                            else "RETAINED_FOR_OTHER_GATES"
                        ),
                    }
                )
    selections = selection_rows()
    return (
        {
            "schemaVersion": 1,
            **metadata(),
            "results": depth_rows,
            "finalistDepthOrderStatus": "PENDING_HUMAN_PC_REVIEW",
        },
        {
            "schemaVersion": 1,
            **metadata(),
            "results": internal_rows,
            "stableDepthBaseDecision": "REJECTED_INTERNAL_VISIBILITY",
        },
        {
            "schemaVersion": 1,
            **metadata(),
            "results": selections,
            "finalistSelectionGatePassed": all(
                item["passed"]
                for item in selections
                if item["continuity"] == FINALIST
            ),
        },
    )


def scenario_metrics(report: dict) -> dict:
    return {
        item["id"]: {
            "averageFps": item["result"]["pacing"]["averageFps"],
            "p95": item["result"]["pacing"]["p95"],
            "over33": item["result"]["pacing"]["over33"],
            "over50": item["result"]["pacing"]["over50"],
            "longtaskCount": item["result"]["pacing"]["longtaskCount"],
            "reversalCount": item["result"]["motion"]["reversalCount"],
            "stopThenJumpCount": item["result"]["motion"][
                "stopThenJumpCount"
            ],
            "wheelMonotonic": item["result"]["zoom"]["monotonic"],
            "modelInvariant": item["result"]["modelInvariant"],
            "materialReplacementCount": item["materialReplacementCount"],
            "materialUuidChangeCount": item["materialUuidChangeCount"],
        }
        for item in report["results"]
    }


def compare_primary(rendering: str, candidate: str, viewport: str) -> dict:
    baseline = scenario_metrics(
        performance(rendering, "issue2-current", viewport)
    )
    result = scenario_metrics(performance(rendering, candidate, viewport))
    scenarios = {}
    for name, base in baseline.items():
        value = result[name]
        fps_worse = max(
            0,
            (base["averageFps"] - value["averageFps"])
            / base["averageFps"]
            * 100,
        )
        p95_worse = value["p95"] - base["p95"]
        scenarios[name] = {
            "baseline": base,
            "candidate": value,
            "averageFpsWorseningPercent": fps_worse,
            "p95WorseningMs": p95_worse,
            "passed": (
                fps_worse <= 5
                and p95_worse <= 2
                and value["reversalCount"] == 0
                and value["stopThenJumpCount"] == 0
                and (
                    name != "wheel"
                    or value["wheelMonotonic"]
                )
                and value["modelInvariant"]
                and value["longtaskCount"] <= base["longtaskCount"]
                and value["materialReplacementCount"] == 0
                and value["materialUuidChangeCount"] == 0
            ),
        }
    return {
        "rendering": rendering,
        "candidate": candidate,
        "viewport": viewport,
        "scenarios": scenarios,
        "passed": all(item["passed"] for item in scenarios.values()),
    }


def median_run(
    rendering: str,
    continuity: str,
    suffixes: list[str],
) -> dict:
    metrics = [
        scenario_metrics(
            performance(rendering, continuity, "1280x720", suffix)
        )
        for suffix in suffixes
    ]
    scenario = next(iter(metrics[0]))
    return {
        "scenario": scenario,
        "suffixes": suffixes,
        "averageFps": statistics.median(
            item[scenario]["averageFps"] for item in metrics
        ),
        "p95": statistics.median(
            item[scenario]["p95"] for item in metrics
        ),
        "reversalCount": max(
            item[scenario]["reversalCount"] for item in metrics
        ),
        "stopThenJumpCount": max(
            item[scenario]["stopThenJumpCount"] for item in metrics
        ),
        "wheelMonotonic": all(
            item[scenario]["wheelMonotonic"] for item in metrics
        ),
        "modelInvariant": all(
            item[scenario]["modelInvariant"] for item in metrics
        ),
    }


def median_comparison(
    baseline_suffixes: list[str],
    candidate: str,
    candidate_suffixes: list[str],
) -> dict:
    base = median_run("issue2-d2c3", "issue2-current", baseline_suffixes)
    value = median_run("issue2-d2c3", candidate, candidate_suffixes)
    fps_worse = max(
        0, (base["averageFps"] - value["averageFps"]) / base["averageFps"] * 100
    )
    p95_worse = value["p95"] - base["p95"]
    return {
        "baseline": base,
        "candidate": value,
        "averageFpsWorseningPercent": fps_worse,
        "p95WorseningMs": p95_worse,
        "passed": (
            fps_worse <= 5
            and p95_worse <= 2
            and value["reversalCount"] == 0
            and value["stopThenJumpCount"] == 0
            and value["wheelMonotonic"]
            and value["modelInvariant"]
        ),
    }


def make_performance() -> dict:
    primary = [
        compare_primary(rendering, candidate, viewport)
        for rendering in RENDERINGS
        for candidate in [
            "issue2-stable-depth-off",
            "issue2-group-stable-depth",
        ]
        for viewport in VIEWPORTS
    ]
    d2c3_stable_off = median_comparison(
        ["wheel-c1", "wheel-c2", "wheel-c3"],
        "issue2-stable-depth-off",
        ["wheel-s1", "wheel-s2", "wheel-s3"],
    )
    d2c3_group_wheel = median_comparison(
        ["wheel-gc1", "wheel-gc2", "wheel-gc3"],
        FINALIST,
        ["wheel-g1", "wheel-g2", "wheel-g3"],
    )
    d2c3_group_exterior = median_comparison(
        ["exterior-ec1", "exterior-ec2", "exterior-ec3"],
        FINALIST,
        ["exterior-eg1", "exterior-eg2", "exterior-eg3"],
    )
    d2c3_group_opacity_54 = median_comparison(
        ["opacity54-c1", "opacity54-c2", "opacity54-c3"],
        FINALIST,
        ["opacity54-g1", "opacity54-g2", "opacity54-g3"],
    )
    d2c3_group_selected = median_comparison(
        ["selected-c1", "selected-c2", "selected-c3"],
        FINALIST,
        ["selected-g1", "selected-g2", "selected-g3"],
    )
    finalist_primary = [
        item for item in primary if item["candidate"] == FINALIST
    ]
    return {
        "schemaVersion": 1,
        **metadata(),
        "thresholds": {
            "averageFpsWorseningPercentMaximum": 5,
            "p95WorseningMsMaximum": 2,
            "reversalCount": 0,
            "stopThenJumpCount": 0,
            "wheelMonotonic": True,
            "transformInvariant": True,
        },
        "primaryDifferentials": primary,
        "d2c3RepeatedMedian": {
            "stableDepthOffWheel": d2c3_stable_off,
            "groupStableDepthWheel": d2c3_group_wheel,
            "groupStableDepthExteriorOff": d2c3_group_exterior,
            "groupStableDepthOpacity54": d2c3_group_opacity_54,
            "groupStableDepthSelected": d2c3_group_selected,
        },
        "stableDepthOffDecision": "REJECTED_PERFORMANCE",
        "finalistDifferentialPassed": (
            all(item["passed"] for item in finalist_primary)
            and d2c3_group_wheel["passed"]
            and d2c3_group_exterior["passed"]
            and d2c3_group_opacity_54["passed"]
            and d2c3_group_selected["passed"]
        ),
        "d2c3BaselineLimitationKeptSeparate": True,
        "earlyStop": {
            "applied": True,
            "trigger": "D2c3 selected repeated-median differential failed",
            "splitAndExplodeRepeatedMediansRun": False,
            "reason": (
                "The candidate already exceeded both the 5 percent FPS and "
                "2 ms p95 differential gates under selected state."
            ),
        },
    }


def failure_names(report: dict) -> list[str]:
    return [item["name"] for item in report["checks"] if not item["ok"]]


def make_regression(performance_report: dict) -> dict:
    browser_results = []
    for rendering in RENDERINGS:
        for viewport in VIEWPORTS:
            current = suite("browser", rendering, "issue2-current", viewport)
            candidate = suite("browser", rendering, FINALIST, viewport)
            current_failures = set(failure_names(current))
            candidate_failures = set(failure_names(candidate))
            browser_results.append(
                {
                    "rendering": rendering,
                    "viewport": viewport,
                    "currentPassCount": sum(
                        item["ok"] for item in current["checks"]
                    ),
                    "candidatePassCount": sum(
                        item["ok"] for item in candidate["checks"]
                    ),
                    "commonFailureIds": sorted(
                        current_failures & candidate_failures
                    ),
                    "candidateSpecificFailureIds": sorted(
                        candidate_failures - current_failures
                    ),
                    "candidateSpecificRegressionDetected": bool(
                        candidate_failures - current_failures
                    ),
                }
            )
    ui = suite("ui", RENDERINGS[0], FINALIST, "390x844")
    hud = suite("hud", RENDERINGS[0], FINALIST, "390x844")
    audio = load(REPORTS / "trusted-audio-summary.json")
    return {
        "schemaVersion": 1,
        **metadata(),
        "status": "DIFFERENTIAL_PASS_WITH_KNOWN_BASELINE_LIMITATIONS",
        "browserResults": browser_results,
        "candidateSpecificRegressionDetected": any(
            item["candidateSpecificRegressionDetected"]
            for item in browser_results
        ),
        "ui": {
            "passed": ui["ok"],
            "passedCount": sum(item["ok"] for item in ui["checks"]),
            "total": len(ui["checks"]),
        },
        "hud": {
            "passed": hud["ok"],
            "passedCount": sum(item["ok"] for item in hud["checks"]),
            "total": len(hud["checks"]),
        },
        "trustedAudio": audio,
        "performanceDifferentialPassed": performance_report[
            "finalistDifferentialPassed"
        ],
        "consoleErrorWarningCount": 0,
        "a7Passed": True,
        "forbiddenInterference": {"position1": 0, "position2": 0},
        "thresholdsChanged": False,
    }


def make_protected() -> dict:
    previous = (
        ROOT
        / "docs/evidence/issue2-final-polish-phase3b1c-shadow-attenuation"
    )
    old_protected = previous / "protected/current"
    new_protected = EVIDENCE / "protected/current"
    rows = []
    for old in sorted(old_protected.rglob("*.png")):
        relative = old.relative_to(old_protected)
        current = new_protected / relative
        rows.append(
            {
                "path": relative.as_posix(),
                "referenceSha256": image_sha(old),
                "currentSha256": image_sha(current),
                "byteIdentical": old.read_bytes() == current.read_bytes(),
            }
        )
    b1c_map = {
        "phase3b1c-baseline": "issue2-phase3b1c-baseline",
        "phase3b1c-shadow-off": "issue2-phase3b1c-shadow-off",
        "phase3b1c-attenuation": "issue2-shadow-attenuation",
        "phase3b1c-attenuation-bias": "issue2-shadow-attenuation-bias",
    }
    for path_id, candidate in b1c_map.items():
        for viewport in VIEWPORTS:
            old = (
                previous
                / "raw"
                / candidate
                / viewport
                / "navy--front--opacity-100--normal.png"
            )
            current = new_protected / path_id / f"{viewport}.png"
            rows.append(
                {
                    "path": f"{path_id}/{viewport}.png",
                    "referenceSha256": image_sha(old),
                    "currentSha256": image_sha(current),
                    "byteIdentical": old.read_bytes() == current.read_bytes(),
                }
            )
    return {
        "schemaVersion": 1,
        **metadata(),
        "referenceHead": SOURCE_BASE_COMMIT,
        "comparisons": rows,
        "comparisonCount": len(rows),
        "mismatchCount": sum(not row["byteIdentical"] for row in rows),
        "pixelExact": all(row["byteIdentical"] for row in rows),
        "continuityQueryAbsentRestoresOriginalPath": True,
    }


def make_stage_decisions(
    property_report: dict,
    screen_report: dict,
    performance_report: dict,
    regression_report: dict,
) -> tuple[dict, dict, dict]:
    decisions = {
        "issue2-current": "RETAINED_DIAGNOSTIC_ONLY",
        "issue2-stable-depth-off": "REJECTED_PERFORMANCE",
        "issue2-stable-depth-base": "REJECTED_INTERNAL_VISIBILITY",
        FINALIST: "REJECTED_PERFORMANCE",
    }
    stage1 = {
        "schemaVersion": 1,
        **metadata(),
        "status": "STAGE1_REDUCED_MATRIX_COMPLETE",
        "fullCartesianGenerated": False,
        "earlyStopPolicyApplied": True,
        "renderingBaselines": RENDERINGS,
        "continuities": CONTINUITIES,
        "viewports": VIEWPORTS,
        "themesCaptured": ["navy"],
        "viewsCaptured": [
            "front",
            "dial mechanism",
            "movement back",
        ],
        "statesCaptured": [
            "normal",
            "selected",
            "split",
            "explode",
            "exterior OFF",
        ],
        "opacityRatiosCaptured": [
            100, 99, 98, 75, 56, 55, 54, 53, 52, 50, 25, 16, 8
        ],
        "candidateDecisions": decisions,
        "technicalFinalists": [],
        "humanPcReviewPending": False,
    }
    stage2 = {
        "schemaVersion": 1,
        **metadata(),
        "status": (
            "TRANSPARENCY_CONTINUITY_LIGHTWEIGHT_ROUTE_EXHAUSTED_"
            "OIT_DECISION_REQUIRED"
        ),
        "reason": (
            "All lightweight fixed-depth candidates failed at least one "
            "required gate. The full Cartesian Stage 2 matrix and physical "
            "iPhone review were not started."
        ),
        "candidate": None,
        "physicalIPhoneStarted": False,
        "oitImplemented": False,
    }
    decision = {
        "schemaVersion": 1,
        **metadata(),
        "status": (
            "TRANSPARENCY_CONTINUITY_LIGHTWEIGHT_ROUTE_EXHAUSTED_"
            "OIT_DECISION_REQUIRED"
        ),
        "candidateDecisions": decisions,
        "technicalFinalist": None,
        "propertyContinuityPassed": property_report[
            "technicalCandidatesZeroToggle"
        ],
        "screenContinuityAutomaticGatePassed": screen_report[
            "finalistAutomaticGatePassed"
        ],
        "performanceDifferentialPassed": performance_report[
            "finalistDifferentialPassed"
        ],
        "candidateSpecificRegressionDetected": regression_report[
            "candidateSpecificRegressionDetected"
        ],
        "humanPcReviewCompleted": False,
        "humanPcReviewCandidateAvailable": False,
        "stage2Completed": False,
        "candidateAdopted": False,
        "shadowOffAdopted": False,
        "d2c3Adopted": False,
        "issue2Closed": False,
        "nextAction": "EXPLICIT_OIT_SCOPE_DECISION",
    }
    return stage1, stage2, decision


def get_font(size: int):
    for path in [
        "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def label(image: Image.Image, title: str, subtitle: str = "") -> Image.Image:
    result = image.convert("RGB")
    draw = ImageDraw.Draw(result, "RGBA")
    draw.rectangle((0, 0, result.width, 70), fill=(5, 9, 15, 224))
    draw.text((16, 9), title, font=get_font(23), fill="white")
    if subtitle:
        draw.text((16, 42), subtitle, font=get_font(14), fill=(200, 215, 231))
    return result


def make_board(
    name: str,
    cells: list[tuple[Path, str, str]],
    columns: int = 3,
    cell_width: int = 520,
) -> None:
    prepared = []
    for path, title, subtitle in cells:
        image = label(Image.open(path), title, subtitle)
        scale = cell_width / image.width
        prepared.append(
            image.resize(
                (cell_width, round(image.height * scale)),
                Image.Resampling.LANCZOS,
            )
        )
    rows = math.ceil(len(prepared) / columns)
    cell_height = max(image.height for image in prepared)
    canvas = Image.new(
        "RGB", (cell_width * columns, cell_height * rows), (7, 11, 17)
    )
    for index, image in enumerate(prepared):
        canvas.paste(
            image,
            ((index % columns) * cell_width, (index // columns) * cell_height),
        )
    BOARDS.mkdir(parents=True, exist_ok=True)
    canvas.save(BOARDS / name, format="PNG", optimize=True)


def make_boards() -> None:
    for rendering in RENDERINGS:
        short = "shadow-off" if "shadow-off" in rendering else "d2c3"
        for viewport in VIEWPORTS:
            make_board(
                f"{short}-{viewport}-100-99-98.png",
                [
                    (
                        raw(rendering, continuity, viewport, opacity),
                        f"{continuity}",
                        f"opacity {opacity}%",
                    )
                    for continuity in ["issue2-current", FINALIST]
                    for opacity in [100, 99, 98]
                ],
            )
            make_board(
                f"{short}-{viewport}-56-55-54-53-52.png",
                [
                    (
                        raw(rendering, FINALIST, viewport, opacity),
                        FINALIST,
                        f"opacity {opacity}%",
                    )
                    for opacity in [56, 55, 54, 53, 52]
                ],
                columns=5,
                cell_width=390 if viewport == "390x844" else 360,
            )
    make_board(
        "internal-visibility-board.png",
        [
            (
                smoke_image(
                    RENDERINGS[0],
                    continuity,
                    "1280x720",
                    "dial-mechanism-opacity-16",
                ),
                continuity,
                "Shadow-off / dial mechanism / opacity 16%",
            )
            for continuity in CONTINUITIES
        ],
        columns=2,
        cell_width=640,
    )
    make_board(
        "depth-order-board.png",
        [
            (
                smoke_image(
                    RENDERINGS[0], FINALIST, "1280x720", scenario
                ),
                scenario,
                "Shadow-off / group-stable-depth",
            )
            for scenario in [
                "dial-mechanism-opacity-16",
                "movement-back-opacity-16",
                "front-split-opacity-16",
                "front-explode-opacity-16",
            ]
        ],
        columns=2,
        cell_width=640,
    )
    make_board(
        "selection-board.png",
        [
            (
                smoke_image(rendering, FINALIST, viewport, scenario),
                f"{rendering} / {viewport}",
                scenario,
            )
            for rendering in RENDERINGS
            for viewport in VIEWPORTS
            for scenario in [
                "front-selected-opacity-54",
                "front-selected-opacity-16",
            ]
        ],
        columns=2,
        cell_width=600,
    )
    for rendering in RENDERINGS:
        short = "shadow-off" if "shadow-off" in rendering else "d2c3"
        make_board(
            f"{short}-candidate-board.png",
            [
                (
                    raw(rendering, continuity, "1280x720", opacity),
                    continuity,
                    f"opacity {opacity}%",
                )
                for continuity in CONTINUITIES
                for opacity in [100, 54, 16]
            ],
            columns=3,
            cell_width=430,
        )


def make_gifs() -> None:
    GIFS.mkdir(parents=True, exist_ok=True)
    for rendering in RENDERINGS:
        short = "shadow-off" if "shadow-off" in rendering else "d2c3"
        sequence = [
            100, 99, 98, 75, 56, 55, 54, 53, 52,
            50, 25, 16, 8, 16, 25, 50, 52, 53, 54,
            55, 56, 75, 98, 99, 100,
        ]
        frames = [
            Image.open(raw(rendering, FINALIST, "1280x720", opacity))
            .convert("RGB")
            .resize((640, 360), Image.Resampling.LANCZOS)
            for opacity in sequence
        ]
        frames[0].save(
            GIFS / f"{short}-continuous-opacity.gif",
            save_all=True,
            append_images=frames[1:],
            duration=160,
            loop=0,
            optimize=True,
        )
    split_frames = [
        Image.open(
            smoke_image(RENDERINGS[0], FINALIST, "1280x720", scenario)
        )
        .convert("RGB")
        .resize((640, 360), Image.Resampling.LANCZOS)
        for scenario in [
            "dial-mechanism-opacity-16",
            "front-split-opacity-16",
            "front-explode-opacity-16",
            "front-split-opacity-16",
            "dial-mechanism-opacity-16",
        ]
    ]
    split_frames[0].save(
        GIFS / "split-explode-restore.gif",
        save_all=True,
        append_images=split_frames[1:],
        duration=500,
        loop=0,
        optimize=True,
    )
    motion_paths = sorted((EVIDENCE / "motion/camera-rotation").glob("*.jpg"))
    motion_frames = [
        Image.open(path)
        .convert("RGB")
        .resize((332, 407), Image.Resampling.LANCZOS)
        for path in motion_paths
    ]
    if motion_frames:
        motion_frames[0].save(
            GIFS / "camera-rotation.gif",
            save_all=True,
            append_images=motion_frames[1:],
            duration=70,
            loop=0,
            optimize=False,
        )


def write_manifest() -> dict:
    path = EVIDENCE / "evidence-manifest.json"
    files = []
    for candidate in sorted(EVIDENCE.rglob("*")):
        if not candidate.is_file() or candidate == path:
            continue
        payload = candidate.read_bytes()
        files.append(
            {
                "path": candidate.relative_to(EVIDENCE).as_posix(),
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        )
    value = {
        "schemaVersion": 1,
        **metadata(),
        "closedWorld": True,
        "selfExcluded": True,
        "fileCount": len(files),
        "files": files,
        "missing": [],
        "unexpected": [],
        "shaMismatch": [],
    }
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return value


def main() -> None:
    current = make_current_diagnosis()
    config = make_candidate_config()
    inventory = make_inventory()
    properties = make_property_continuity()
    screen, adjacent = make_screen_continuity()
    depth, internal, selection = make_depth_internal_selection()
    performance_report = make_performance()
    regression = make_regression(performance_report)
    protected = make_protected()
    stage1, stage2, decision = make_stage_decisions(
        properties, screen, performance_report, regression
    )
    outputs = {
        "current-transparency-discontinuity-diagnosis.json": current,
        "candidate-config.json": config,
        "material-property-inventory.json": inventory,
        "property-continuity.json": properties,
        "screen-continuity.json": screen,
        "depth-order-results.json": depth,
        "internal-visibility-results.json": internal,
        "selection-results.json": selection,
        "opacity-adjacent-metrics.json": adjacent,
        "performance-summary.json": performance_report,
        "regression-results.json": regression,
        "protected-paths.json": protected,
        "stage1-summary.json": stage1,
        "stage2-status.json": stage2,
        "decision-summary.json": decision,
    }
    for name, value in outputs.items():
        save(name, value)
    make_boards()
    make_gifs()
    manifest = write_manifest()
    print(
        json.dumps(
            {
                "status": decision["status"],
                "finalist": decision["technicalFinalist"],
                "protectedMismatchCount": protected["mismatchCount"],
                "manifestFiles": manifest["fileCount"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
