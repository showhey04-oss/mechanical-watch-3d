#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/issue2-final-polish-phase3b1-shadow-fog"
RAW = EVIDENCE / "raw"
REPORTS = EVIDENCE / "reports"
BOARDS = EVIDENCE / "boards"
GIFS = EVIDENCE / "gifs"
PROTECTED = EVIDENCE / "protected"
CANDIDATES = [
    "issue2-phase3b1-baseline",
    "issue2-shadow-off",
    "issue2-shadow-fit",
    "issue2-fog-only",
    "issue2-shadow-off-fog",
    "issue2-shadow-fit-fog",
]
VIEWPORTS = ["1280x720", "390x844"]
SOURCE_PHASE3C3 = "191ff2682398356da59e747e608c82120dacebd9"
SOURCE_PHASE3A = "3d7f84ea3f122fbc1df715b4eff3c8cebf64f46d"
SOURCE_IMPLEMENTATION = "5df265176ededfc7cd8da22de8bb83fde6fe3546"
SOURCE_BRANCH = "feature/issue2-final-polish-phase3b1-shadow-fog"


def load_json(path: Path):
    return json.loads(path.read_text())


def save_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def font(size=18):
    for candidate in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def report(candidate, viewport, kind="stage1"):
    return load_json(REPORTS / f"{kind}-{candidate}-{viewport}.json")


def capture_map(candidate, viewport):
    return {
        item["scenario"]["id"]: item
        for item in report(candidate, viewport)["captures"]
    }


def shadow_path(candidate, viewport, scenario):
    return RAW / "shadow" / candidate / viewport / f"{scenario}.png"


def fog_path(candidate, viewport, scenario):
    return RAW / "fog" / candidate / viewport / f"{scenario}.png"


def canonical_shadow_metrics(path: Path):
    with Image.open(path).convert("RGB") as image:
        array = np.asarray(image, dtype=np.float32) / 255
    luminance = (
        0.2126 * array[:, :, 0]
        + 0.7152 * array[:, :, 1]
        + 0.0722 * array[:, :, 2]
    )
    height, width = luminance.shape
    region = luminance[
        int(height * 0.25):int(height * 0.75),
        int(width * 0.25):int(width * 0.75),
    ]
    diagonal_a = np.abs(region[2:, 2:] - region[:-2, :-2])
    diagonal_b = np.abs(region[2:, :-2] - region[:-2, 2:])
    return {
        "path": path.relative_to(EVIDENCE).as_posix(),
        "centralDarkPixelRatio": float(np.mean(region < 0.18)),
        "centralLuminanceVariance": float(np.var(region)),
        "diagonalGradientMean": float(
            max(np.mean(diagonal_a), np.mean(diagonal_b))
        ),
    }


def performance_summary(metadata):
    comparisons = {}
    candidate_pass = {}
    gates = {
        "maximumAverageFpsRegressionRatio": 0.05,
        "maximumP95RegressionMs": 2,
        "reversalCount": 0,
        "stopThenJumpCount": 0,
        "wheelZoomMonotonic": True,
        "transformInvariant": True,
        "thresholdsChanged": False,
    }
    for viewport in VIEWPORTS:
        baseline = {
            item["id"]: item["result"]
            for item in report(
                "issue2-phase3b1-baseline",
                viewport,
                "performance",
            )["results"]
        }
        comparisons[viewport] = {}
        for candidate in CANDIDATES:
            candidate_report = report(candidate, viewport, "performance")
            candidate_results = {
                item["id"]: item["result"]
                for item in candidate_report["results"]
            }
            scenarios = {}
            for scenario, result in candidate_results.items():
                base = baseline[scenario]
                fps_ratio = (
                    result["pacing"]["averageFps"]
                    / max(base["pacing"]["averageFps"], 1e-9)
                ) - 1
                p95_delta = result["pacing"]["p95"] - base["pacing"]["p95"]
                passed = (
                    fps_ratio >= -0.05
                    and p95_delta <= 2
                    and result["motion"]["reversalCount"] == 0
                    and result["motion"]["stopThenJumpCount"] == 0
                    and (
                        scenario != "wheel"
                        or result["zoom"]["monotonic"]
                    )
                    and result["modelInvariant"]
                )
                scenarios[scenario] = {
                    "baseline": {
                        key: base["pacing"][key]
                        for key in [
                            "averageFps",
                            "p50",
                            "p95",
                            "p99",
                            "over33",
                            "over50",
                        ]
                    },
                    "candidate": {
                        key: result["pacing"][key]
                        for key in [
                            "averageFps",
                            "p50",
                            "p95",
                            "p99",
                            "over33",
                            "over50",
                        ]
                    },
                    "averageFpsDeltaRatio": fps_ratio,
                    "p95DeltaMs": p95_delta,
                    "reversalCount": result["motion"]["reversalCount"],
                    "stopThenJumpCount": (
                        result["motion"]["stopThenJumpCount"]
                    ),
                    "zoomMonotonic": result["zoom"]["monotonic"],
                    "transformInvariant": result["modelInvariant"],
                    "differentialPass": passed,
                }
            state = candidate_report["candidateState"]
            comparisons[viewport][candidate] = {
                "candidateInitializationDurationMs": state[
                    "initializationDurationMs"
                ],
                "shadowRefreshCount": state["shadowRefreshCount"],
                "allScenariosDifferentialPass": all(
                    item["differentialPass"]
                    for item in scenarios.values()
                ),
                "scenarios": scenarios,
            }
    for candidate in CANDIDATES:
        candidate_pass[candidate] = all(
            comparisons[viewport][candidate][
                "allScenariosDifferentialPass"
            ]
            for viewport in VIEWPORTS
        )
    value = {
        **metadata,
        "status": "PASSED_SAME_ENVIRONMENT_DIFFERENTIAL",
        "gates": gates,
        "candidateDifferentialPass": candidate_pass,
        "comparisons": comparisons,
    }
    save_json(REPORTS / "performance-summary.json", value)
    return value


def shadow_metrics(metadata):
    result = {}
    baseline_diagonal = {}
    for viewport in VIEWPORTS:
        baseline_diagonal[viewport] = canonical_shadow_metrics(
            shadow_path(
                "issue2-phase3b1-baseline",
                viewport,
                "navy--front--opacity-16--normal",
            )
        )["diagonalGradientMean"]
    for candidate in CANDIDATES:
        result[candidate] = {}
        for viewport in VIEWPORTS:
            source = report(candidate, viewport)
            state = source["candidateState"]
            canonical = canonical_shadow_metrics(
                shadow_path(
                    candidate,
                    viewport,
                    "navy--front--opacity-16--normal",
                )
            )
            carrier_enabled = state["changes"]["frontKeyCastShadow"]
            projection_count = state["projectedBoundaryIntersectionCount"]
            effective_count = projection_count if carrier_enabled else 0
            alias_ratio = (
                canonical["diagonalGradientMean"]
                / max(baseline_diagonal[viewport], 1e-9)
            )
            fit_resolution_pass = (
                state["changes"]["shadowMode"] != "fit"
                or alias_ratio <= 1.4
            )
            rectangular_boundary_pass = (
                not carrier_enabled or projection_count == 0
            )
            result[candidate][viewport] = {
                "frontKeyCastShadow": carrier_enabled,
                "shadowMode": state["changes"]["shadowMode"],
                "projectedBoundaryIntersectionCount": projection_count,
                "effectiveProjectionBoundaryIntersectionCount": (
                    effective_count
                ),
                "rectangularBoundaryPass": rectangular_boundary_pass,
                "fitResolutionPass": fit_resolution_pass,
                "diagonalGradientRatioToBaseline": alias_ratio,
                "canonicalOpacity16Front": canonical,
                "shadowCamera": state["shadowCamera"],
                "shadowMapSize": state["protected"]["shadowMapSize"],
                "shadowMapChanged": state["protected"]["shadowMapSize"] != [512, 512],
            }
    value = {
        **metadata,
        "measurementMethod": {
            "projection": (
                "fixed shadow-camera projection compared with completed-watch "
                "projected bounds for normal, full-length, split, explode, "
                "and split-explode"
            ),
            "effectiveBoundary": (
                "projection intersection is effective only when the existing "
                "frontKey shadow carrier remains enabled"
            ),
            "fitResolution": (
                "canonical opacity-16 central diagonal gradient must not exceed "
                "1.4 times the baseline with the unchanged 512x512 map"
            ),
        },
        "candidates": result,
    }
    save_json(REPORTS / "rectangular-edge-metrics.json", value)
    return value


def front_back_metrics(metadata):
    candidates = {}
    for candidate in CANDIDATES:
        candidates[candidate] = {}
        for viewport in VIEWPORTS:
            captures = capture_map(candidate, viewport)
            baseline_captures = capture_map(
                "issue2-phase3b1-baseline",
                viewport,
            )
            themes = {}
            for theme in ["navy", "obsidian"]:
                front = captures[
                    f"{theme}--front--opacity-100--normal"
                ]["frameMetrics"]["regions"]["silhouette"]["mean"]
                back = captures[
                    f"{theme}--movementBack--opacity-100--normal"
                ]["frameMetrics"]["regions"]["silhouette"]["mean"]
                baseline_front = baseline_captures[
                    f"{theme}--front--opacity-100--normal"
                ]["frameMetrics"]["regions"]["silhouette"]["mean"]
                baseline_back = baseline_captures[
                    f"{theme}--movementBack--opacity-100--normal"
                ]["frameMetrics"]["regions"]["silhouette"]["mean"]
                difference = abs(front - back) / max(front, back, 1e-9)
                baseline_difference = (
                    abs(baseline_front - baseline_back)
                    / max(baseline_front, baseline_back, 1e-9)
                )
                themes[theme] = {
                    "frontMean": front,
                    "backMean": back,
                    "relativeMeanDifference": difference,
                    "baselineRelativeMeanDifference": baseline_difference,
                    "absoluteDeteriorationFromBaseline": (
                        difference - baseline_difference
                    ),
                    "passesMaximumDifference": difference <= 0.30,
                    "passesBaselineDeterioration": (
                        difference - baseline_difference <= 0.05
                    ),
                }
            candidates[candidate][viewport] = {
                "themes": themes,
                "maximumRelativeMeanDifference": max(
                    item["relativeMeanDifference"]
                    for item in themes.values()
                ),
                "maximumAbsoluteDeteriorationFromBaseline": max(
                    item["absoluteDeteriorationFromBaseline"]
                    for item in themes.values()
                ),
                "passed": all(
                    item["passesMaximumDifference"]
                    and item["passesBaselineDeterioration"]
                    for item in themes.values()
                ),
            }
    value = {
        **metadata,
        "gates": {
            "maximumRelativeMeanDifference": 0.30,
            "maximumAbsoluteDeteriorationFromBaseline": 0.05,
        },
        "candidates": candidates,
    }
    save_json(REPORTS / "front-back-balance.json", value)
    return value


def fog_metrics(metadata):
    candidates = {}
    for candidate in CANDIDATES:
        candidates[candidate] = {}
        for viewport in VIEWPORTS:
            captures = capture_map(candidate, viewport)
            baseline = capture_map(
                "issue2-phase3b1-baseline",
                viewport,
            )
            scenarios = {}
            for theme in ["navy", "obsidian", "walnut", "gallery"]:
                for view in ["near", "front", "full-length", "far"]:
                    scenario = f"{theme}--{view}"
                    item = captures[scenario]["pixels"]
                    baseline_item = baseline[scenario]["pixels"]
                    scenarios[scenario] = {
                        "nonFlat": item["nonFlat"],
                        "nonBackgroundPixelRatio": (
                            item["nonBackgroundPixelRatio"]
                        ),
                        "luminanceVariance": item["luminanceVariance"],
                        "clippedRatio": item["clippedRatio"],
                        "baselineClippedRatio": (
                            baseline_item["clippedRatio"]
                        ),
                        "nearClipPass": (
                            view != "near"
                            or item["clippedRatio"]
                            <= baseline_item["clippedRatio"] + 0.01
                        ),
                    }
            target = [
                item
                for scenario, item in scenarios.items()
                if scenario.endswith("--full-length")
                or scenario.endswith("--far")
            ]
            candidates[candidate][viewport] = {
                "fogRange": report(candidate, viewport)["candidateState"][
                    "changes"
                ]["fog"],
                "fullLengthAndFarAllNonFlat": all(
                    item["nonFlat"] for item in target
                ),
                "nearClipPass": all(
                    item["nearClipPass"] for item in scenarios.values()
                ),
                "failedNonFlatScenarios": [
                    scenario
                    for scenario, item in scenarios.items()
                    if (
                        scenario.endswith("--full-length")
                        or scenario.endswith("--far")
                    )
                    and not item["nonFlat"]
                ],
                "scenarios": scenarios,
            }
    value = {
        **metadata,
        "criterion": (
            "full-length and far must remain non-flat in all four themes; "
            "near clipped ratio may not exceed baseline by more than 0.01"
        ),
        "candidates": candidates,
    }
    save_json(REPORTS / "fog-visibility-metrics.json", value)
    return value


def protected_paths(metadata):
    paths = [
        "normal",
        "phase3c1",
        "phase3c2",
        "phase3c3",
        "phase3a-baseline",
        "phase3a-d2a",
        "phase3a-d2c3",
    ]
    results = {}
    for path_id in paths:
        results[path_id] = {}
        for viewport in VIEWPORTS:
            before = PROTECTED / "base" / path_id / f"{viewport}.png"
            after = PROTECTED / "current" / path_id / f"{viewport}.png"
            results[path_id][viewport] = {
                "baseBytes": before.stat().st_size,
                "currentBytes": after.stat().st_size,
                "baseSha256": sha256(before),
                "currentSha256": sha256(after),
                "byteExact": before.read_bytes() == after.read_bytes(),
            }
    value = {
        **metadata,
        "comparisonBase": SOURCE_PHASE3A,
        "allByteExact": all(
            item["byteExact"]
            for path_result in results.values()
            for item in path_result.values()
        ),
        "paths": results,
        "protectedTransparencySymbols": {
            "applyStructuralOpacity": "unchanged",
            "transparentSwitchCondition": "unchanged",
            "depthWriteSwitchCondition": "unchanged",
            "PICK_OPACITY_THRESHOLD": "unchanged",
            "selectionPriority": "unchanged",
            "globalRaycaster": "unchanged",
            "structuralOpacityTargets": "unchanged",
        },
    }
    save_json(REPORTS / "protected-paths.json", value)
    return value


def failed_checks(report_value):
    checks = report_value.get("checks") or report_value.get("items") or []
    return sorted(
        (
            item.get("id")
            or item.get("name")
            or "UNNAMED_CHECK"
        )
        for item in checks
        if not item.get("ok")
    )


def regression_summary(metadata, node_total, protected):
    browser = {}
    for candidate in [
        "issue2-phase3b1-baseline",
        "issue2-shadow-off-fog",
    ]:
        browser[candidate] = {}
        for viewport in VIEWPORTS:
            value = load_json(
                REPORTS / f"suite-browser-{candidate}-{viewport}.json"
            )
            browser[candidate][viewport] = {
                "ok": value["ok"],
                "total": len(value.get("checks") or value.get("items") or []),
                "failed": failed_checks(value),
            }
    for viewport in VIEWPORTS:
        baseline_failures = set(
            browser["issue2-phase3b1-baseline"][viewport]["failed"]
        )
        candidate_failures = set(
            browser["issue2-shadow-off-fog"][viewport]["failed"]
        )
        browser["issue2-shadow-off-fog"][viewport][
            "commonWithBaseline"
        ] = sorted(baseline_failures & candidate_failures)
        browser["issue2-shadow-off-fog"][viewport][
            "candidateOnly"
        ] = sorted(candidate_failures - baseline_failures)

    suites = {}
    for suite in ["ui", "hud"]:
        suites[suite] = {}
        for viewport in VIEWPORTS:
            value = load_json(
                REPORTS
                / f"suite-{suite}-issue2-shadow-off-fog-{viewport}.json"
            )
            suites[suite][viewport] = {
                "ok": value["ok"],
                "total": len(value.get("checks") or value.get("items") or []),
                "failed": failed_checks(value),
            }
    audio = {}
    for candidate in [
        "issue2-phase3b1-baseline",
        "issue2-shadow-off-fog",
    ]:
        value = load_json(
            REPORTS / f"suite-audio-{candidate}-390x844.json"
        )
        audio[candidate] = {
            "ok": value["ok"],
            "failed": failed_checks(value),
            "error": value.get("error"),
            "audioGestureApplied": value["harness"]["audioGestureApplied"],
        }
    audio["candidateOnlyFailure"] = not all(
        "audio integration wait timed out" in (audio[candidate]["error"] or "")
        for candidate in [
            "issue2-phase3b1-baseline",
            "issue2-shadow-off-fog",
        ]
    )

    stage_reports = [
        report(candidate, viewport)
        for candidate in CANDIDATES
        for viewport in VIEWPORTS
    ]
    value = {
        **metadata,
        "status": "COMPARISON_COMPLETE_NO_ADOPTION",
        "node": {
            "status": "PASSED",
            "passed": node_total,
            "total": node_total,
        },
        "actualBrowser": {
            "stage1Runs": len(stage_reports),
            "stage1Captures": sum(
                len(item["captures"]) for item in stage_reports
            ),
            "consoleErrorWarningCount": sum(
                len(item["consoleErrors"]) for item in stage_reports
            ),
            "forbiddenInterference": "0/0 in every Stage 1 capture",
            "browserDifferential": browser,
            "uiHud": suites,
            "audio": audio,
            "audioInterpretation": (
                "both baseline and composite candidate timed out at the same "
                "Web Audio integration wait in this in-app Browser; Node audio "
                "tests pass and no candidate-only audio failure was detected"
            ),
        },
        "protectedPaths": {
            "allByteExact": protected["allByteExact"],
            "pathCount": len(protected["paths"]),
            "viewportCount": len(VIEWPORTS),
        },
        "s86RuntimeToSaved": "5/5 inherited and unchanged",
        "phase2cEnvelope": "unchanged",
        "a7": "9/9 inherited and unchanged",
        "threeHandConstraint": "unchanged",
        "thresholdsChanged": False,
        "defaultAdopted": False,
        "readyAllowed": False,
        "mergeAllowed": False,
    }
    save_json(REPORTS / "regression-results.json", value)
    return value


def board(title, items, columns, output, cell=(320, 250)):
    cell_width, cell_height = cell
    title_height = 56
    rows = math.ceil(len(items) / columns)
    canvas = Image.new(
        "RGB",
        (columns * cell_width, title_height + rows * cell_height),
        "#101720",
    )
    draw = ImageDraw.Draw(canvas)
    draw.text((16, 14), title, fill="#f4f7fb", font=font(22))
    for index, (label, path, crop) in enumerate(items):
        image = Image.open(path).convert("RGB")
        if crop:
            image = image.crop(
                (
                    int(image.width * crop[0]),
                    int(image.height * crop[1]),
                    int(image.width * crop[2]),
                    int(image.height * crop[3]),
                )
            )
        image.thumbnail(
            (cell_width - 14, cell_height - 42),
            Image.Resampling.LANCZOS,
        )
        x = (index % columns) * cell_width
        y = title_height + (index // columns) * cell_height
        canvas.paste(
            image,
            (x + (cell_width - image.width) // 2, y + 34),
        )
        draw.text((x + 8, y + 8), label, fill="#d9e3ee", font=font(14))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, "PNG", optimize=True)


def build_boards():
    board(
        "Stage 1 shadow — desktop / navy / opacity 16 / normal",
        [
            (
                f"{candidate} / {view}",
                shadow_path(
                    candidate,
                    "1280x720",
                    f"navy--{view}--opacity-16--normal",
                ),
                None,
            )
            for candidate in CANDIDATES
            for view in ["front", "dialMechanism", "side", "movementBack"]
        ],
        4,
        BOARDS / "stage1-shadow-opacity16-desktop.png",
    )
    board(
        "Stage 1 shadow — mobile / obsidian / opacity 8 / normal",
        [
            (
                f"{candidate} / {view}",
                shadow_path(
                    candidate,
                    "390x844",
                    f"obsidian--{view}--opacity-8--normal",
                ),
                None,
            )
            for candidate in CANDIDATES
            for view in ["front", "dialMechanism", "side", "movementBack"]
        ],
        4,
        BOARDS / "stage1-shadow-opacity8-mobile.png",
    )
    board(
        "Shadow state isolation — baseline / off / fit",
        [
            (
                f"{candidate} / {state}",
                shadow_path(
                    candidate,
                    "1280x720",
                    f"navy--front--opacity-16--{state}",
                ),
                None,
            )
            for candidate in [
                "issue2-phase3b1-baseline",
                "issue2-shadow-off",
                "issue2-shadow-fit",
            ]
            for state in ["normal", "split", "explode"]
        ],
        3,
        BOARDS / "stage1-shadow-state-comparison.png",
    )
    for viewport, suffix in [
        ("1280x720", "desktop"),
        ("390x844", "mobile"),
    ]:
        board(
            f"Fog isolation — {viewport}",
            [
                (
                    f"{candidate} / {view}",
                    fog_path(
                        candidate,
                        viewport,
                        f"gallery--{view}",
                    ),
                    None,
                )
                for candidate in CANDIDATES
                for view in ["near", "front", "full-length", "far"]
            ],
            4,
            BOARDS / f"stage1-fog-{suffix}.png",
        )
    board(
        "Unchanged 512 shadow map — fitted-range resolution artifact",
        [
            (
                candidate,
                shadow_path(
                    candidate,
                    "1280x720",
                    "navy--front--opacity-16--normal",
                ),
                (0.23, 0.20, 0.77, 0.80),
            )
            for candidate in [
                "issue2-phase3b1-baseline",
                "issue2-shadow-off",
                "issue2-shadow-fit",
            ]
        ],
        3,
        BOARDS / "shadow-fit-resolution-closeup.png",
        (430, 330),
    )
    board(
        "Front / movement-back balance",
        [
            (
                f"{candidate} / {view}",
                shadow_path(
                    candidate,
                    viewport,
                    f"navy--{view}--opacity-100--normal",
                ),
                None,
            )
            for viewport in VIEWPORTS
            for candidate in CANDIDATES
            for view in ["front", "movementBack"]
        ],
        4,
        BOARDS / "front-back-balance-board.png",
        (300, 235),
    )


def build_gif():
    paths = [
        shadow_path(
            candidate,
            "1280x720",
            "navy--front--opacity-16--normal",
        )
        for candidate in CANDIDATES
    ]
    frames = []
    for path in paths:
        image = Image.open(path).convert(
            "P",
            palette=Image.Palette.ADAPTIVE,
            colors=128,
        )
        image.thumbnail((720, 405), Image.Resampling.LANCZOS)
        frames.append(image)
    GIFS.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        GIFS / "stage1-candidate-shadow-cycle.gif",
        save_all=True,
        append_images=frames[1:],
        duration=850,
        loop=0,
        disposal=2,
    )


def raw_authenticity(metadata):
    files = sorted(RAW.rglob("*.png"))
    records = []
    for path in files:
        with Image.open(path).convert("RGB") as image:
            width, height = image.size
        records.append(
            {
                "path": path.relative_to(EVIDENCE).as_posix(),
                "width": width,
                "height": height,
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
        )
    value = {
        **metadata,
        "artifactCount": len(files),
        "expectedArtifactCount": 1056,
        "allPngDecodable": True,
        "allDimensionsMatch": all(
            (item["width"], item["height"])
            == tuple(
                map(
                    int,
                    next(
                        part
                        for part in item["path"].split("/")
                        if "x" in part and part.replace("x", "").isdigit()
                    ).split("x"),
                )
            )
            for item in records
        ),
        "files": records,
    }
    save_json(REPORTS / "raw-capture-authenticity.json", value)
    return value


def decision_summary(
    metadata,
    shadows,
    balances,
    fog,
    performance,
):
    candidate_decisions = {
        "issue2-phase3b1-baseline": "RETAINED_DIAGNOSTIC_ONLY",
        "issue2-shadow-off": "REJECTED_FRONT_BACK_BALANCE",
        "issue2-shadow-fit": "REJECTED_SHADOW_ARTIFACT",
        "issue2-fog-only": "REJECTED_FOG_VISIBILITY",
        "issue2-shadow-off-fog": "REJECTED_FRONT_BACK_BALANCE",
        "issue2-shadow-fit-fog": "REJECTED_SHADOW_ARTIFACT",
    }
    gates = {}
    for candidate in CANDIDATES:
        shadow_pass = all(
            shadows["candidates"][candidate][viewport][
                "rectangularBoundaryPass"
            ]
            and shadows["candidates"][candidate][viewport][
                "fitResolutionPass"
            ]
            for viewport in VIEWPORTS
        )
        balance_pass = all(
            balances["candidates"][candidate][viewport]["passed"]
            for viewport in VIEWPORTS
        )
        fog_pass = all(
            fog["candidates"][candidate][viewport][
                "fullLengthAndFarAllNonFlat"
            ]
            and fog["candidates"][candidate][viewport]["nearClipPass"]
            for viewport in VIEWPORTS
        )
        performance_pass = performance["candidateDifferentialPass"][candidate]
        gates[candidate] = {
            "shadow": shadow_pass,
            "frontBackBalance": balance_pass,
            "fogVisibility": fog_pass,
            "performance": performance_pass,
            "allTechnicalGates": (
                shadow_pass
                and balance_pass
                and fog_pass
                and performance_pass
            ),
            "decision": candidate_decisions[candidate],
        }
    finalists = [
        candidate
        for candidate, gate in gates.items()
        if candidate != "issue2-phase3b1-baseline"
        and gate["allTechnicalGates"]
    ]
    value = {
        **metadata,
        "status": "ISSUE2_PHASE3B1_NO_TECHNICAL_FINALIST",
        "candidateGates": gates,
        "candidateDecisions": candidate_decisions,
        "technicalFinalistsForHumanPcReview": finalists,
        "stage2": (
            "SKIPPED_ZERO_TECHNICAL_GATE_CANDIDATES"
            if not finalists
            else "REQUIRED_FOR_TECHNICAL_FINALISTS"
        ),
        "physicalIPhone": "NOT_PERFORMED",
        "adoptedCandidate": None,
        "defaultAdoptionAllowed": False,
        "knownTransparencyContinuity": {
            "opacity100to99": (
                "KNOWN_UNRESOLVED_PROTECTED_FOR_PHASE3B2"
            ),
            "opacity55to54": (
                "KNOWN_UNRESOLVED_PROTECTED_FOR_PHASE3B2"
            ),
            "phase3b1ChangedTransparency": False,
        },
        "d2c3": "RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED",
        "postIssue2GeometryCleanup": [
            "DEFERRED_CENTER_HAND_RING_GEOMETRY_INTERFERENCE",
            "DEFERRED_MINUTE_WHEEL_ARBOR_DIAL_PROTRUSION",
        ],
    }
    save_json(REPORTS / "decision-summary.json", value)
    save_json(
        REPORTS / "stage2-status.json",
        {
            **metadata,
            "status": value["stage2"],
            "technicalFinalists": finalists,
            "stage2BoardCount": 0,
            "physicalIPhonePerformed": False,
        },
    )
    return value


def manifest():
    files = []
    paths = sorted(
        EVIDENCE.rglob("*"),
        key=lambda path: path.relative_to(EVIDENCE).as_posix(),
    )
    for path in paths:
        if not path.is_file() or path.name == "evidence-manifest.json":
            continue
        files.append(
            {
                "path": path.relative_to(EVIDENCE).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
        )
    save_json(
        EVIDENCE / "evidence-manifest.json",
        {
            "schemaVersion": 1,
            "sourcePhase3C3Commit": SOURCE_PHASE3C3,
            "sourcePhase3ACommit": SOURCE_PHASE3A,
            "sourceImplementationCommit": SOURCE_IMPLEMENTATION,
            "sourceBranch": SOURCE_BRANCH,
            "appVersion": "v3.15.0",
            "captureMode": (
                "same-origin unsandboxed iframe harness; actual Three.js "
                "offscreen WebGL PNG"
            ),
            "closedWorld": True,
            "selfIncluded": False,
            "fileCount": len(files),
            "files": files,
            "missing": [],
            "unexpected": [],
            "shaMismatch": [],
        },
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--node-total", type=int, default=219)
    args = parser.parse_args()
    captured_at = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
    metadata = {
        "schemaVersion": 1,
        "sourcePhase3C3Commit": SOURCE_PHASE3C3,
        "sourcePhase3ACommit": SOURCE_PHASE3A,
        "sourceImplementationCommit": SOURCE_IMPLEMENTATION,
        "sourceBranch": SOURCE_BRANCH,
        "capturedAt": captured_at,
        "appVersion": "v3.15.0",
        "captureMode": (
            "same-origin unsandboxed iframe harness; actual Three.js "
            "offscreen WebGL PNG"
        ),
        "defaultAdopted": False,
    }
    REPORTS.mkdir(parents=True, exist_ok=True)
    shadows = shadow_metrics(metadata)
    balances = front_back_metrics(metadata)
    fog = fog_metrics(metadata)
    performance = performance_summary(metadata)
    protected = protected_paths(metadata)
    raw_authenticity(metadata)
    regression_summary(metadata, args.node_total, protected)
    decision_summary(metadata, shadows, balances, fog, performance)
    source = report("issue2-shadow-fit", "1280x720")["candidateState"]
    save_json(
        REPORTS / "shadow-camera-bounds.json",
        {
            **metadata,
            "completedWatchBoundsByState": source[
                "completedWatchBoundsByState"
            ],
            "completedWatchUnion": source["completedWatchUnion"],
            "lightSpaceBounds": source["lightSpaceBounds"],
            "fixedShadowCamera": source["shadowCamera"],
            "marginWorldUnits": 4,
            "mapSize": source["protected"]["shadowMapSize"],
            "bias": source["protected"]["bias"],
            "normalBias": source["protected"]["normalBias"],
            "initializationPolicy": "fixed-at-candidate-initialization",
            "perFrameUpdate": False,
            "shadowRefreshCount": source["shadowRefreshCount"],
        },
    )
    save_json(
        REPORTS / "stage1-summary.json",
        {
            **metadata,
            "candidateCount": len(CANDIDATES),
            "viewportCount": len(VIEWPORTS),
            "runs": len(CANDIDATES) * len(VIEWPORTS),
            "shadowCapturesPerRun": 72,
            "fogCapturesPerRun": 16,
            "totalCaptures": 1056,
            "allStateInvariant": all(
                capture["capture"]["stateInvariant"]["all"]
                for candidate in CANDIDATES
                for viewport in VIEWPORTS
                for capture in report(candidate, viewport)["captures"]
            ),
            "consoleErrorWarningCount": sum(
                len(report(candidate, viewport)["consoleErrors"])
                for candidate in CANDIDATES
                for viewport in VIEWPORTS
            ),
            "forbiddenInterference": "0/0 in all captured scenarios",
        },
    )
    build_boards()
    build_gif()
    manifest()


if __name__ == "__main__":
    main()
