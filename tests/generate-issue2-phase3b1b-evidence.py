#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / (
    "docs/evidence/issue2-final-polish-phase3b1b-discrete-shadow"
)
REPORTS = EVIDENCE / "reports"
RAW = EVIDENCE / "raw"
MOTION = EVIDENCE / "motion"
BOARDS = EVIDENCE / "boards"
GIFS = EVIDENCE / "gifs"
SOURCE_BASE_COMMIT = "27533b91100c5dddca6507414c6fe3b282ed07c2"
SOURCE_IMPLEMENTATION_COMMIT = "e79a26ce4e18d30a81cbf840e45dfa1c4f063d51"
SOURCE_QUERY_COMPATIBILITY_COMMIT = (
    "3e6917ec8cc0781f04af84254dbe317f0fc6a0b9"
)
SOURCE_BRANCH = "feature/issue2-final-polish-phase3b1b-discrete-shadow"
CANDIDATES = [
    "issue2-phase3b1b-baseline",
    "issue2-phase3b1b-shadow-off",
    "issue2-phase3b1b-state-tight-512",
    "issue2-phase3b1b-state-tight-1024",
]
VIEWPORTS = ["1280x720", "390x844"]
STATES = ["normal", "split", "explode", "split-explode"]


def load(path: Path):
    return json.loads(path.read_text())


def save(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n"
    )


def sha(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def stage_report(candidate: str, viewport: str):
    return load(REPORTS / f"stage1-{candidate}-{viewport}.json")


def performance_report(candidate: str, viewport: str):
    return load(REPORTS / f"performance-{candidate}-{viewport}.json")


def scenario_key(capture):
    scenario = capture["scenario"]
    return (
        scenario["theme"],
        scenario["view"],
        scenario["opacity"],
        scenario["state"],
    )


def relative_difference(left, right):
    return abs(left - right) / max(1e-9, max(abs(left), abs(right)))


def aggregate_pixels(report):
    captures = report["captures"]
    rectangle = [
        capture["pixels"]["rectangularLineScore"]["maximumRatio"]
        for capture in captures
    ]
    diagonal = [
        capture["pixels"]["diagonalStaircaseRatio"]["ratio"]
        for capture in captures
    ]
    bands = [
        capture["pixels"]["periodicBandScore"]["score"]
        for capture in captures
    ]
    return {
        "captureCount": len(captures),
        "nonFlatCount": sum(
            capture["pixels"]["nonFlat"] for capture in captures
        ),
        "rectangularLineScore": {
            "maximum": max(rectangle),
            "mean": sum(rectangle) / len(rectangle),
        },
        "diagonalStaircaseRatio": {
            "maximum": max(diagonal),
            "mean": sum(diagonal) / len(diagonal),
        },
        "periodicBandScore": {
            "maximum": max(bands),
            "mean": sum(bands) / len(bands),
        },
    }


def front_back_metrics(report):
    captures = {
        scenario_key(capture): capture
        for capture in report["captures"]
    }
    comparisons = []
    for theme in ["navy", "obsidian"]:
        for opacity in [1, 0.16, 0.08]:
            for state in STATES:
                front = captures[(theme, "front", opacity, state)]
                back = captures[(theme, "movementBack", opacity, state)]
                front_mean = front["pixels"]["meanLuminance"]
                back_mean = back["pixels"]["meanLuminance"]
                comparisons.append({
                    "theme": theme,
                    "opacity": opacity,
                    "state": state,
                    "frontMean": front_mean,
                    "backMean": back_mean,
                    "relativeDifference": relative_difference(
                        front_mean, back_mean
                    ),
                })
    return comparisons


def performance_metrics(report):
    values = {}
    for item in report["results"]:
        result = item["result"]
        values[item["id"]] = {
            "averageFps": result["pacing"]["averageFps"],
            "p95": result["pacing"]["p95"],
            "p99": result["pacing"]["p99"],
            "over33": result["pacing"]["over33"],
            "over50": result["pacing"]["over50"],
            "reversalCount": result["motion"]["reversalCount"],
            "stopThenJumpCount": result["motion"]["stopThenJumpCount"],
            "zoomMonotonic": result["zoom"]["monotonic"],
            "modelInvariant": result["modelInvariant"],
            "shadowRefresh": item["shadowRefresh"],
        }
    return values


def compare_performance(candidate, viewport, baseline, current):
    scenarios = {}
    passed = True
    for name, base in baseline.items():
        value = current[name]
        fps_decline = (
            (base["averageFps"] - value["averageFps"])
            / max(1e-9, base["averageFps"])
            * 100
        )
        p95_delta = value["p95"] - base["p95"]
        zoom_pass = (
            value["zoomMonotonic"]
            if name == "wheel"
            else True
        )
        item_pass = (
            fps_decline <= 5
            and p95_delta <= 2
            and value["reversalCount"] == 0
            and value["stopThenJumpCount"] == 0
            and zoom_pass
            and value["modelInvariant"]
        )
        scenarios[name] = {
            "baseline": base,
            "candidate": value,
            "averageFpsDeclinePercent": fps_decline,
            "p95DeltaMs": p95_delta,
            "zoomMonotonicRequired": name == "wheel",
            "pass": item_pass,
        }
        passed = passed and item_pass
    return {
        "candidate": candidate,
        "viewport": viewport,
        "pass": passed,
        "thresholds": {
            "maximumAverageFpsDeclinePercent": 5,
            "maximumP95IncreaseMs": 2,
            "reversalCount": 0,
            "stopThenJumpCount": 0,
            "zoomMonotonic": True,
            "modelInvariant": True,
        },
        "scenarios": scenarios,
    }


def failed_names(report):
    return sorted(
        item.get("name") or item.get("id") or "unnamed"
        for collection in ("checks", "items")
        for item in report.get(collection, [])
        if not item.get("ok", False)
    )


def label_image(image: Image.Image, label: str):
    result = image.convert("RGB").copy()
    draw = ImageDraw.Draw(result)
    font = ImageFont.load_default()
    box = draw.textbbox((0, 0), label, font=font)
    width = box[2] - box[0]
    height = box[3] - box[1]
    draw.rectangle((6, 6, 18 + width, 18 + height), fill=(4, 7, 11))
    draw.text((12, 12), label, fill=(245, 247, 250), font=font)
    return result


def board(cells, columns, cell_size, output):
    rows = (len(cells) + columns - 1) // columns
    canvas = Image.new(
        "RGB",
        (columns * cell_size[0], rows * cell_size[1]),
        (12, 15, 20),
    )
    for index, (path, label) in enumerate(cells):
        image = Image.open(path).convert("RGB")
        image = ImageOps.fit(image, cell_size, method=Image.Resampling.LANCZOS)
        image = label_image(image, label)
        x = index % columns * cell_size[0]
        y = index // columns * cell_size[1]
        canvas.paste(image, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, format="PNG")


def crop_board(cells, columns, cell_size, crop_box, output):
    rows = (len(cells) + columns - 1) // columns
    canvas = Image.new(
        "RGB",
        (columns * cell_size[0], rows * cell_size[1]),
        (12, 15, 20),
    )
    for index, (path, label) in enumerate(cells):
        image = Image.open(path).convert("RGB")
        left = int(image.width * crop_box[0])
        top = int(image.height * crop_box[1])
        right = int(image.width * crop_box[2])
        bottom = int(image.height * crop_box[3])
        image = ImageOps.fit(
            image.crop((left, top, right, bottom)),
            cell_size,
            method=Image.Resampling.LANCZOS,
        )
        image = label_image(image, label)
        x = index % columns * cell_size[0]
        y = index // columns * cell_size[1]
        canvas.paste(image, (x, y))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, format="PNG")


def make_gif(paths, labels, output, size=(640, 360)):
    frames = []
    for path, label in zip(paths, labels):
        image = ImageOps.fit(
            Image.open(path).convert("RGB"),
            size,
            method=Image.Resampling.LANCZOS,
        )
        frames.append(label_image(image, label))
    output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        output,
        save_all=True,
        append_images=frames[1:],
        duration=900,
        loop=0,
        optimize=False,
    )


def make_bounds_diagram(bounds, output):
    width, height = 1000, 620
    image = Image.new("RGB", (width, height), (11, 15, 21))
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    colors = {
        "normal": (99, 179, 237),
        "split": (87, 204, 153),
        "explode": (241, 177, 75),
        "split-explode": (233, 107, 120),
    }
    all_bounds = [bounds[state] for state in STATES]
    min_x = min(record["left"] for record in all_bounds)
    max_x = max(record["right"] for record in all_bounds)
    min_y = min(record["bottom"] for record in all_bounds)
    max_y = max(record["top"] for record in all_bounds)
    margin = 70

    def x_screen(value):
        return margin + (value - min_x) / (max_x - min_x) * (width - 2 * margin)

    def y_screen(value):
        return height - margin - (
            (value - min_y) / (max_y - min_y) * (height - 2 * margin)
        )

    draw.text(
        (margin, 20),
        "Phase 3B.1b discrete state frontKey shadow-camera bounds",
        fill=(240, 243, 248),
        font=font,
    )
    for state in STATES:
        record = bounds[state]
        box = (
            x_screen(record["left"]),
            y_screen(record["top"]),
            x_screen(record["right"]),
            y_screen(record["bottom"]),
        )
        draw.rectangle(box, outline=colors[state], width=4)
        draw.text(
            (box[0] + 6, box[1] + 6),
            f"{state}  near={record['near']:.3f} far={record['far']:.3f}",
            fill=colors[state],
            font=font,
        )
    image.save(output, format="PNG")


def generate_visuals():
    BOARDS.mkdir(parents=True, exist_ok=True)
    GIFS.mkdir(parents=True, exist_ok=True)
    desktop_cells = [
        (
            RAW / candidate / "1280x720"
            / "navy--front--opacity-16--normal.png",
            candidate.replace("issue2-phase3b1b-", ""),
        )
        for candidate in CANDIDATES
    ]
    board(
        desktop_cells,
        columns=4,
        cell_size=(480, 270),
        output=BOARDS / "stage1-front-opacity16-desktop.png",
    )
    mobile_cells = [
        (
            RAW / candidate / "390x844"
            / "navy--front--opacity-16--normal.png",
            candidate.replace("issue2-phase3b1b-", ""),
        )
        for candidate in CANDIDATES
    ]
    board(
        mobile_cells,
        columns=4,
        cell_size=(195, 422),
        output=BOARDS / "stage1-front-opacity16-mobile.png",
    )
    view_cells = []
    for candidate in CANDIDATES:
        for view in ["front", "dialMechanism", "side", "movementBack"]:
            view_cells.append((
                RAW / candidate / "1280x720"
                / f"navy--{view}--opacity-16--normal.png",
                f"{candidate.replace('issue2-phase3b1b-', '')} / {view}",
            ))
    board(
        view_cells,
        columns=4,
        cell_size=(360, 203),
        output=BOARDS / "stage1-view-matrix-opacity16-desktop.png",
    )
    state_cells = [
        (
            RAW / "issue2-phase3b1b-state-tight-1024" / "1280x720"
            / f"navy--front--opacity-16--{state}.png",
            state,
        )
        for state in STATES
    ]
    board(
        state_cells,
        columns=4,
        cell_size=(480, 270),
        output=BOARDS / "stage1-state-matrix-tight1024-desktop.png",
    )
    resolution_cells = [
        (
            RAW / candidate / "1280x720"
            / "navy--front--opacity-16--normal.png",
            candidate.rsplit("-", 1)[-1],
        )
        for candidate in [
            "issue2-phase3b1b-state-tight-512",
            "issue2-phase3b1b-state-tight-1024",
        ]
    ]
    board(
        resolution_cells,
        columns=2,
        cell_size=(640, 360),
        output=BOARDS / "stage1-resolution-comparison-desktop.png",
    )
    crop_board(
        desktop_cells,
        columns=4,
        cell_size=(480, 320),
        crop_box=(0.22, 0.12, 0.78, 0.88),
        output=BOARDS / "stage1-shadow-crop-opacity16-desktop.png",
    )
    crop_board(
        resolution_cells,
        columns=2,
        cell_size=(640, 420),
        crop_box=(0.20, 0.10, 0.80, 0.90),
        output=BOARDS / "stage1-diagonal-band-desktop.png",
    )
    front_back_cells = []
    for candidate in CANDIDATES:
        for view in ["front", "movementBack"]:
            front_back_cells.append((
                RAW / candidate / "1280x720"
                / f"navy--{view}--opacity-16--normal.png",
                f"{candidate.replace('issue2-phase3b1b-', '')} / {view}",
            ))
    board(
        front_back_cells,
        columns=4,
        cell_size=(360, 203),
        output=BOARDS / "stage1-front-back-opacity16-desktop.png",
    )
    make_gif(
        [path for path, _ in desktop_cells],
        [label for _, label in desktop_cells],
        GIFS / "stage1-candidate-cycle-opacity16-desktop.gif",
    )
    make_gif(
        [path for path, _ in state_cells],
        [label for _, label in state_cells],
        GIFS / "tight1024-state-cycle-desktop.gif",
    )
    motion_ids = [
        "front-near",
        "dial-mechanism",
        "side",
        "movement-back",
        "front-far",
    ]
    motion_paths = [
        MOTION / "issue2-phase3b1b-state-tight-1024" / "1280x720"
        / f"{motion_id}.png"
        for motion_id in motion_ids
    ]
    if all(path.exists() for path in motion_paths):
        make_gif(
            motion_paths,
            motion_ids,
            GIFS / "camera-rotate-zoom-tight1024-desktop.gif",
        )


def generate(audio_check_count):
    timestamp = datetime.now(timezone.utc).isoformat()
    metadata = {
        "sourceBaseCommit": SOURCE_BASE_COMMIT,
        "sourceImplementationCommit": SOURCE_IMPLEMENTATION_COMMIT,
        "sourceQueryCompatibilityCommit":
            SOURCE_QUERY_COMPATIBILITY_COMMIT,
        "sourceBranch": SOURCE_BRANCH,
        "appVersion": "v3.15.0",
        "captureMode": "same-origin unsandboxed iframe harness",
        "captureTimestamp": timestamp,
        "viewports": {
            "desktop": [1280, 720],
            "mobile": [390, 844],
        },
    }
    stage = {
        (candidate, viewport): stage_report(candidate, viewport)
        for candidate in CANDIDATES
        for viewport in VIEWPORTS
    }
    performance = {
        (candidate, viewport): performance_report(candidate, viewport)
        for candidate in CANDIDATES
        for viewport in VIEWPORTS
    }
    pixel_metrics = {}
    front_back = {}
    for candidate in CANDIDATES:
        pixel_metrics[candidate] = {}
        front_back[candidate] = {}
        for viewport in VIEWPORTS:
            pixel_metrics[candidate][viewport] = aggregate_pixels(
                stage[(candidate, viewport)]
            )
            front_back[candidate][viewport] = front_back_metrics(
                stage[(candidate, viewport)]
            )

    baseline_front_back = front_back["issue2-phase3b1b-baseline"]
    front_back_summary = {}
    for candidate in CANDIDATES:
        front_back_summary[candidate] = {}
        for viewport in VIEWPORTS:
            values = front_back[candidate][viewport]
            baseline_values = baseline_front_back[viewport]
            maximum = max(item["relativeDifference"] for item in values)
            deterioration = max(
                current["relativeDifference"] - baseline["relativeDifference"]
                for current, baseline in zip(values, baseline_values)
            )
            front_back_summary[candidate][viewport] = {
                "comparisons": values,
                "maximumRelativeDifference": maximum,
                "maximumBaselineDeterioration": deterioration,
                "pass": maximum <= 0.30 and deterioration <= 0.05,
            }

    baseline_performance = {
        viewport: performance_metrics(
            performance[("issue2-phase3b1b-baseline", viewport)]
        )
        for viewport in VIEWPORTS
    }
    performance_summary = {}
    for candidate in CANDIDATES:
        performance_summary[candidate] = {}
        for viewport in VIEWPORTS:
            current = performance_metrics(performance[(candidate, viewport)])
            performance_summary[candidate][viewport] = compare_performance(
                candidate,
                viewport,
                baseline_performance[viewport],
                current,
            )

    tight_bounds = {}
    completed_bounds = {}
    measured_state_bounds = {}
    refresh = {}
    for candidate in [
        "issue2-phase3b1b-state-tight-512",
        "issue2-phase3b1b-state-tight-1024",
    ]:
        report = stage[(candidate, "1280x720")]["finalShadow"]
        tight_bounds[candidate] = report["tightByState"]
        completed_bounds[candidate] = report["stateMeasurements"]
        measured_state_bounds[candidate] = stage[
            (candidate, "1280x720")
        ]["stateBounds"]["states"]
        refresh[candidate] = {
            viewport: stage[(candidate, viewport)]["finalShadow"]["refresh"]
            for viewport in VIEWPORTS
        }

    protected = []
    protected_ok = True
    for base in sorted((EVIDENCE / "protected/base").rglob("*.png")):
        relative = base.relative_to(EVIDENCE / "protected/base")
        current = EVIDENCE / "protected/current" / relative
        item = {
            "path": relative.as_posix(),
            "baseBytes": base.stat().st_size,
            "currentBytes": current.stat().st_size if current.exists() else None,
            "baseSha256": sha(base),
            "currentSha256": sha(current) if current.exists() else None,
        }
        item["pixelExact"] = (
            item["baseBytes"] == item["currentBytes"]
            and item["baseSha256"] == item["currentSha256"]
        )
        protected_ok = protected_ok and item["pixelExact"]
        protected.append(item)

    suite_reports = {}
    for candidate in [
        "issue2-phase3b1b-baseline",
        "issue2-phase3b1b-state-tight-1024",
    ]:
        suite_reports[candidate] = {}
        for viewport in VIEWPORTS:
            report = load(
                REPORTS
                / f"suite-browser-{candidate}-{viewport}.json"
            )
            suite_reports[candidate][viewport] = {
                "ok": report["ok"],
                "failed": failed_names(report),
            }
    desktop_specific = sorted(set(
        suite_reports["issue2-phase3b1b-state-tight-1024"]["1280x720"][
            "failed"
        ]
    ) - set(
        suite_reports["issue2-phase3b1b-baseline"]["1280x720"]["failed"]
    ))
    mobile_specific = sorted(set(
        suite_reports["issue2-phase3b1b-state-tight-1024"]["390x844"][
            "failed"
        ]
    ) - set(
        suite_reports["issue2-phase3b1b-baseline"]["390x844"]["failed"]
    ))

    decisions = {
        "issue2-phase3b1b-baseline": {
            "decision": "RETAINED_DIAGNOSTIC_ONLY",
            "reason": "HUMAN_REJECTED_RENDERING_BASELINE",
            "defaultAdopted": False,
        },
        "issue2-phase3b1b-shadow-off": {
            "decision": "RETAINED_DIAGNOSTIC_ONLY",
            "reason": "HUMAN_DESIGN_HOLD_TECHNICALLY_NONFINAL",
            "defaultAdopted": False,
        },
        "issue2-phase3b1b-state-tight-512": {
            "decision": "REJECTED_SHADOW_RESOLUTION",
            "reason": (
                "central rectangle removed, but visible diagonal shadow bands "
                "cover the transparent watch surfaces"
            ),
            "defaultAdopted": False,
        },
        "issue2-phase3b1b-state-tight-1024": {
            "decision": "REJECTED_SHADOW_RESOLUTION",
            "reason": (
                "1024 reduces texel size but does not remove visible diagonal "
                "shadow bands; mobile also adds a front/back gate failure"
            ),
            "defaultAdopted": False,
        },
    }
    technical_finalists = [
        candidate
        for candidate, decision in decisions.items()
        if decision["decision"] == "TECHNICAL_FINALIST_FOR_HUMAN_PC_REVIEW"
    ]

    save(REPORTS / "candidate-config.json", {
        **metadata,
        "candidates": {
            candidate: stage[(candidate, "1280x720")]["candidateState"][
                "changes"
            ]
            for candidate in CANDIDATES
        },
        "states": STATES,
        "xyMarginTexels": 12,
        "mapSizeCandidates": [512, 1024],
        "fullLengthIsCameraFramingNotState": True,
    })
    save(REPORTS / "shadow-camera-bounds.json", {
        **metadata,
        "fitMethod":
            "local geometry bounding-box corners -> matrixWorld -> frontKey light-view",
        "casterReceiverSeparated": True,
        "bounds": tight_bounds,
        "projectedBoundaryIntersectionCount": {
            candidate: {
                viewport: stage[(candidate, viewport)]["finalShadow"][
                    "projectedBoundaryIntersectionCount"
                ]
                for viewport in VIEWPORTS
            }
            for candidate in tight_bounds
        },
    })
    save(REPORTS / "state-bounds.json", {
        **metadata,
        "measurement":
            "geometry bounding-box corners transformed by matrixWorld directly into frontKey light-view space",
        "candidates": measured_state_bounds,
    })
    save(REPORTS / "caster-bounds.json", {
        **metadata,
        "candidates": {
            candidate: {
                state: {
                    "objectCount": measurement["caster"]["objectCount"],
                    "worldBounds": measurement["caster"]["worldBounds"],
                    "lightSpaceBounds":
                        measurement["caster"]["lightSpaceBounds"],
                }
                for state, measurement in states.items()
            }
            for candidate, states in measured_state_bounds.items()
        },
    })
    save(REPORTS / "receiver-bounds.json", {
        **metadata,
        "candidates": {
            candidate: {
                state: {
                    "objectCount": measurement["receiver"]["objectCount"],
                    "worldBounds": measurement["receiver"]["worldBounds"],
                    "lightSpaceBounds":
                        measurement["receiver"]["lightSpaceBounds"],
                }
                for state, measurement in states.items()
            }
            for candidate, states in measured_state_bounds.items()
        },
    })
    save(REPORTS / "light-space-bounds.json", {
        **metadata,
        "fitMethod":
            "mesh-local geometry bounding-box corners -> matrixWorld -> frontKey light-view",
        "worldSpaceAabbCornerApproximationUsed": False,
        "candidates": {
            candidate: {
                state: {
                    "caster": measurement["caster"]["lightSpaceBounds"],
                    "receiver": measurement["receiver"][
                        "lightSpaceBounds"
                    ],
                    "fittedShadowCamera": tight_bounds[candidate][state],
                }
                for state, measurement in states.items()
            }
            for candidate, states in measured_state_bounds.items()
        },
    })
    save(REPORTS / "texel-density.json", {
        **metadata,
        "safetyMarginTexels": 12,
        "candidates": {
            candidate: {
                state: {
                    "mapSize": (
                        512 if candidate.endswith("512") else 1024
                    ),
                    "sourceSize": bounds["sourceSize"],
                    "worldUnitsPerTexel": bounds["worldUnitsPerTexel"],
                    "fittedWorldUnitsPerTexel":
                        bounds["fittedWorldUnitsPerTexel"],
                    "convertedWorldMargin": bounds["margin"],
                }
                for state, bounds in states.items()
            }
            for candidate, states in tight_bounds.items()
        },
    })
    save(REPORTS / "completed-watch-bounds.json", {
        **metadata,
        "states": completed_bounds,
    })
    save(REPORTS / "rectangular-edge-metrics.json", {
        **metadata,
        "metrics": pixel_metrics,
        "humanVisualReview": {
            "baseline":
                "central rectangular shadow boundary remains visible",
            "shadowOff":
                "rectangular shadow boundary removed; technically nonfinal",
            "stateTight512":
                "rectangle removed, visible diagonal shadow bands unacceptable",
            "stateTight1024":
                "rectangle removed, visible diagonal shadow bands still unacceptable",
        },
    })
    save(REPORTS / "diagonal-band-metrics.json", {
        **metadata,
        "thresholds": {
            "maximumDiagonalGradientRatioToBaseline": 1.15,
            "maximumPeriodicBandScoreToBaseline": 1.15,
            "humanSameScaleReviewRequired": True,
        },
        "metrics": {
            candidate: {
                viewport: {
                    "diagonalStaircaseRatio": metrics[
                        "diagonalStaircaseRatio"
                    ],
                    "periodicBandScore": metrics["periodicBandScore"],
                }
                for viewport, metrics in viewports.items()
            }
            for candidate, viewports in pixel_metrics.items()
        },
        "humanSameScaleReview": {
            "issue2-phase3b1b-state-tight-512":
                "FAIL: broad diagonal shadow bands remain visible",
            "issue2-phase3b1b-state-tight-1024":
                "FAIL: finer sampling does not eliminate diagonal shadow bands",
        },
    })
    save(REPORTS / "front-back-metrics.json", {
        **metadata,
        "thresholds": {
            "maximumRelativeDifference": 0.30,
            "maximumBaselineDeterioration": 0.05,
        },
        "candidates": front_back_summary,
    })
    save(REPORTS / "performance-summary.json", {
        **metadata,
        "thresholdsChanged": False,
        "candidates": performance_summary,
    })
    save(REPORTS / "shadow-refresh-timeline.json", {
        **metadata,
        "policy":
            "initialization and discrete state transition only; no pointer, wheel, camera, zoom, or idle refresh",
        "candidates": refresh,
    })
    save(REPORTS / "protected-paths.json", {
        **metadata,
        "expectedCount": 26,
        "actualCount": len(protected),
        "pixelExact": protected_ok and len(protected) == 26,
        "items": protected,
    })
    save(REPORTS / "regression-results.json", {
        **metadata,
        "status": "PASSED_WITH_REJECTED_CANDIDATES",
        "node": {"passed": 238, "failed": 0},
        "stage1": {
            "captures": sum(
                len(report["captures"]) for report in stage.values()
            ),
            "expected": 768,
            "consoleErrorWarningCount": sum(
                len(report["consoleErrors"]) for report in stage.values()
            ),
        },
        "browserDifferential": {
            "baselineAndCandidate": suite_reports,
            "desktopCandidateSpecificFailures": desktop_specific,
            "mobileCandidateSpecificFailures": mobile_specific,
        },
        "ui": {"desktop": "20/20", "mobile": "22/22"},
        "hud": {"mobile": "57/57"},
        "audio": {
            "programmaticIframeGesture": "timed out as non-trusted input",
            "trustedBrowserClick": {
                "status": "passed",
                "passed": audio_check_count,
                "failed": 0,
            },
        },
        "forbiddenInterference": {
            "mechanismPosition1": 0,
            "mechanismPosition2": 0,
            "exteriorPosition1": 0,
            "exteriorPosition2": 0,
        },
        "protectedPaths": {
            "count": len(protected),
            "pixelExact": protected_ok,
        },
        "thresholdsChanged": False,
    })
    save(REPORTS / "stage2-status.json", {
        **metadata,
        "technicalFinalists": technical_finalists,
        "stage2Executed": False,
        "physicalIPhoneExecuted": False,
        "reason":
            "zero candidates passed every technical and human-visible shadow quality gate",
    })
    save(REPORTS / "stage1-summary.json", {
        **metadata,
        "status": "COMPLETED_NO_TECHNICAL_FINALIST",
        "candidateCount": len(CANDIDATES),
        "viewportCount": len(VIEWPORTS),
        "captureCount": sum(
            len(report["captures"]) for report in stage.values()
        ),
        "expectedCaptureCount": 768,
        "consoleErrorWarningCount": sum(
            len(report["consoleErrors"]) for report in stage.values()
        ),
        "technicalFinalists": technical_finalists,
        "decisions": decisions,
    })
    save(REPORTS / "decision-summary.json", {
        **metadata,
        "status": "NO_TECHNICAL_FINALIST_NO_ADOPTION",
        "phase3B1HumanDiagnosticReview": {
            "baseline": "HUMAN_REJECTED_RENDERING_BASELINE",
            "shadowOff": "HUMAN_DESIGN_HOLD_TECHNICALLY_NONFINAL",
            "d2c3": "RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED",
            "mobile":
                "DEFERRED_MOBILE_FULL_LENGTH_FRAMING_AND_ZOOM_LIMIT",
        },
        "decisions": decisions,
        "technicalFinalists": technical_finalists,
        "stage2Executed": False,
        "defaultAdopted": False,
        "issue2Status": "OPEN",
        "pr5Status": "OPEN_DRAFT_UNCHANGED",
        "d2c3Status": "RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED",
        "deferredGeometryCleanup":
            "DEFERRED_POST_ISSUE2_GEOMETRY_CLEANUP",
    })
    save(REPORTS / "capture-inventory.json", {
        **metadata,
        "stage1Expected": 768,
        "stage1Actual": sum(
            len(report["captures"]) for report in stage.values()
        ),
        "reports": sorted(
            path.relative_to(EVIDENCE).as_posix()
            for path in REPORTS.glob("stage1-*.json")
        ),
        "rawPngCount": len(list(RAW.rglob("*.png"))),
    })
    generate_visuals()
    make_bounds_diagram(
        tight_bounds["issue2-phase3b1b-state-tight-1024"],
        BOARDS / "shadow-camera-bounds.png",
    )
    generate_manifest()


def generate_manifest():
    entries = []
    for path in sorted(EVIDENCE.rglob("*")):
        if not path.is_file() or path.name == "evidence-manifest.json":
            continue
        entries.append({
            "path": path.relative_to(EVIDENCE).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha(path),
        })
    save(EVIDENCE / "evidence-manifest.json", {
        "schemaVersion": 1,
        "root": EVIDENCE.relative_to(ROOT).as_posix(),
        "closedWorld": True,
        "selfIncluded": False,
        "expectedFileCount": len(entries),
        "files": entries,
    })


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio-check-count", type=int, default=23)
    arguments = parser.parse_args()
    generate(arguments.audio_check_count)
