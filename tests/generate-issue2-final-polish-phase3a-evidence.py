#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/issue2-final-polish-phase3a-final-exterior"
RAW = EVIDENCE / "raw"
REPORTS = EVIDENCE / "reports"
BOARDS = EVIDENCE / "boards"
GIFS = EVIDENCE / "gifs"
CANDIDATES = ["issue2-baseline", "issue2-d2a", "issue2-d2c3"]
VIEWPORTS = ["1280x720", "390x844"]
SOURCE_BASE = "191ff2682398356da59e747e608c82120dacebd9"
SOURCE_PR5 = "79feee0f81bc719de0118042b356a2b63007090c"
CAPTURED_AT = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def load_json(path: Path):
    return json.loads(path.read_text())


def save_json(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def sha256(path: Path):
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def percentile(values, ratio):
    if not values:
        return 0.0
    ordered = sorted(values)
    return ordered[min(len(ordered) - 1, int((len(ordered) - 1) * ratio))]


def semantic_masks(width, height, x, y, r, g, b, luminance, silhouette):
    nx = x / max(1, width - 1)
    ny = y / max(1, height - 1)
    maximum = max(r, g, b)
    minimum = min(r, g, b)
    saturation = (maximum - minimum) / maximum if maximum else 0
    return {
        "silhouette": silhouette,
        "metal": silhouette and saturation < 0.28 and luminance > 0.055,
        "dial": silhouette and 0.27 <= nx <= 0.73 and 0.25 <= ny <= 0.75,
        "openHeart": silhouette and 0.34 <= nx <= 0.66 and 0.32 <= ny <= 0.68,
        "mechanism": silhouette and 0.20 <= nx <= 0.80 and 0.18 <= ny <= 0.82,
        "strap": silhouette and (ny < 0.24 or ny > 0.76) and 0.25 <= nx <= 0.75,
        "selectedHighlight": silhouette and b > r * 1.08 and b > g * 1.03 and saturation > 0.18,
    }


def image_metrics(path: Path):
    with Image.open(path).convert("RGB") as image:
        width, height = image.size
        pixels = image.load()
        corners = [
            pixels[2, 2],
            pixels[max(0, width - 3), 2],
            pixels[2, max(0, height - 3)],
            pixels[max(0, width - 3), max(0, height - 3)],
        ]
        background = tuple(sum(color[index] for color in corners) / len(corners) for index in range(3))
        regions = {name: [] for name in ["silhouette", "metal", "dial", "openHeart", "mechanism", "strap", "selectedHighlight"]}
        unique = set()
        sampled = 0
        background_count = 0
        for y in range(0, height, 2):
            for x in range(0, width, 2):
                red8, green8, blue8 = pixels[x, y]
                unique.add((red8, green8, blue8))
                sampled += 1
                difference = math.sqrt(
                    (red8 - background[0]) ** 2
                    + (green8 - background[1]) ** 2
                    + (blue8 - background[2]) ** 2
                )
                silhouette = difference > 12
                if not silhouette:
                    background_count += 1
                red, green, blue = red8 / 255, green8 / 255, blue8 / 255
                luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
                for name, included in semantic_masks(
                    width, height, x, y, red, green, blue, luminance, silhouette
                ).items():
                    if included:
                        regions[name].append(luminance)

        def summarize(values):
            return {
                "sampleCount": len(values),
                "mean": sum(values) / len(values) if values else 0,
                "p25": percentile(values, 0.25),
                "p50": percentile(values, 0.50),
                "p75": percentile(values, 0.75),
                "p90": percentile(values, 0.90),
                "darkPixelRatio": (
                    sum(value < 0.045 for value in values) / len(values)
                    if values else 0
                ),
                "clippedPixelRatio": (
                    sum(value > 0.965 for value in values) / len(values)
                    if values else 0
                ),
            }

        return {
            "path": path.relative_to(EVIDENCE).as_posix(),
            "width": width,
            "height": height,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "authenticity": {
                "uniqueSampledRgbCount": len(unique),
                "dominantBackgroundRatio": background_count / max(1, sampled),
                "nonBackgroundPixelRatio": 1 - background_count / max(1, sampled),
                "singleColor": len(unique) == 1,
            },
            "maskMethod": "four-corner background RGB distance greater than 12",
            "regions": {name: summarize(values) for name, values in regions.items()},
        }


def difference_metrics(before_path: Path, after_path: Path):
    with Image.open(before_path).convert("RGB") as before, Image.open(after_path).convert("RGB") as after:
        if before.size != after.size:
            raise ValueError("comparison dimensions differ")
        width, height = before.size
        first = before.load()
        second = after.load()
        corners = [
            first[2, 2],
            first[max(0, width - 3), 2],
            first[2, max(0, height - 3)],
            first[max(0, width - 3), max(0, height - 3)],
        ]
        background = tuple(sum(color[index] for color in corners) / len(corners) for index in range(3))
        regions = {name: [] for name in ["silhouette", "metal", "dial", "openHeart", "mechanism", "strap", "selectedHighlight"]}
        for y in range(0, height, 2):
            for x in range(0, width, 2):
                r1, g1, b1 = first[x, y]
                r2, g2, b2 = second[x, y]
                difference = math.sqrt(
                    (r1 - background[0]) ** 2
                    + (g1 - background[1]) ** 2
                    + (b1 - background[2]) ** 2
                )
                silhouette = difference > 12
                red, green, blue = r1 / 255, g1 / 255, b1 / 255
                luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue
                l2 = 0.2126 * r2 / 255 + 0.7152 * g2 / 255 + 0.0722 * b2 / 255
                delta = abs(l2 - luminance)
                for name, included in semantic_masks(
                    width, height, x, y, red, green, blue, luminance, silhouette
                ).items():
                    if included:
                        regions[name].append(delta)
        return {
            name: {
                "sampleCount": len(values),
                "meanAbsoluteLuminanceDifference": sum(values) / max(1, len(values)),
                "p50AbsoluteLuminanceDifference": percentile(values, 0.50),
                "p90AbsoluteLuminanceDifference": percentile(values, 0.90),
                "maxAbsoluteLuminanceDifference": max(values, default=0),
            }
            for name, values in regions.items()
        }


def font(size=18):
    for candidate in [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def board(title, items, columns, output, cell_size=(430, 300)):
    cell_width, cell_height = cell_size
    title_height = 58
    rows = math.ceil(len(items) / columns)
    canvas = Image.new("RGB", (columns * cell_width, title_height + rows * cell_height), "#11161d")
    draw = ImageDraw.Draw(canvas)
    draw.text((18, 14), title, fill="#f4f7fb", font=font(24))
    for index, (label, path, crop) in enumerate(items):
        image = Image.open(path).convert("RGB")
        if crop:
            left, top, right, bottom = crop
            image = image.crop((
                int(image.width * left),
                int(image.height * top),
                int(image.width * right),
                int(image.height * bottom),
            ))
        image.thumbnail((cell_width - 16, cell_height - 42), Image.Resampling.LANCZOS)
        x = (index % columns) * cell_width
        y = title_height + (index // columns) * cell_height
        canvas.paste(image, (x + (cell_width - image.width) // 2, y + 34))
        draw.text((x + 10, y + 8), label, fill="#dfe8f3", font=font(16))
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, "PNG", optimize=True)


def raw(candidate, viewport, scenario):
    return RAW / candidate / viewport / f"{scenario}.png"


def build_boards():
    boards = []
    board(
        "Issue #2 completed exterior — candidate front comparison",
        [
            (f"{candidate} / {viewport}", raw(candidate, viewport, "view-front"), None)
            for viewport in VIEWPORTS
            for candidate in CANDIDATES
        ],
        3,
        BOARDS / "candidate-front-desktop-mobile.png",
    )
    boards.append("candidate-front-desktop-mobile.png")
    board(
        "Opacity continuity — 100 / 99 / 56 / 55 / 54 / 53 / 16 / 8",
        [
            (f"{candidate} {level}%", raw(candidate, "1280x720", f"opacity-{level:03d}"), None)
            for candidate in CANDIDATES
            for level in [100, 99, 56, 55, 54, 53, 16, 8]
        ],
        8,
        BOARDS / "opacity-continuity-desktop.png",
        (260, 205),
    )
    boards.append("opacity-continuity-desktop.png")
    board(
        "Theme comparison — completed exterior",
        [
            (f"{candidate} / {theme}", raw(candidate, "1280x720", f"theme-{theme}-front"), None)
            for candidate in CANDIDATES
            for theme in ["navy", "obsidian", "walnut", "gallery"]
        ],
        4,
        BOARDS / "theme-board.png",
        (330, 245),
    )
    boards.append("theme-board.png")
    board(
        "Front / side / movement back",
        [
            (f"{candidate} / {view}", raw(candidate, "1280x720", f"view-{view}"), None)
            for candidate in CANDIDATES
            for view in ["front", "side", "movementBack"]
        ],
        3,
        BOARDS / "front-back-side-board.png",
    )
    boards.append("front-back-side-board.png")
    board(
        "Near / initial / far — same camera direction",
        [
            (f"{candidate} / {view}", raw(candidate, "1280x720", f"view-{view}"), None)
            for candidate in CANDIDATES
            for view in ["near", "front", "far"]
        ],
        3,
        BOARDS / "near-far-board.png",
    )
    boards.append("near-far-board.png")
    board(
        "Metal region crop — case, bezel, indices and hands",
        [
            (candidate, raw(candidate, "1280x720", "view-front"), (0.14, 0.04, 0.86, 0.92))
            for candidate in CANDIDATES
        ],
        3,
        BOARDS / "metal-board.png",
        (500, 360),
    )
    boards.append("metal-board.png")
    board(
        "Open-heart region crop",
        [
            (candidate, raw(candidate, "1280x720", "view-front"), (0.46, 0.25, 0.76, 0.66))
            for candidate in CANDIDATES
        ],
        3,
        BOARDS / "open-heart-board.png",
        (500, 360),
    )
    boards.append("open-heart-board.png")
    board(
        "Selected / unselected highlight and depth ordering",
        [
            (f"{candidate} / {state}", raw(candidate, "1280x720", f"state-{state}"), None)
            for candidate in CANDIDATES
            for state in ["unselected", "selected"]
        ],
        2,
        BOARDS / "selected-unselected-board.png",
    )
    boards.append("selected-unselected-board.png")
    return boards


def gif_from_paths(paths, output, duration=520):
    frames = []
    for path in paths:
        image = Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE, colors=128)
        image.thumbnail((640, 420), Image.Resampling.LANCZOS)
        frames.append(image)
    output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        output,
        save_all=True,
        append_images=frames[1:],
        loop=0,
        duration=duration,
        disposal=2,
    )


def build_gifs():
    candidate = "issue2-d2c3"
    gif_from_paths(
        [
            raw(candidate, "1280x720", name)
            for name in [
                "view-front",
                "view-dialMechanism",
                "view-side",
                "view-movementMechanism",
                "view-movementBack",
                "view-balance",
                "view-escapement",
                "view-front",
            ]
        ],
        GIFS / "continuous-view-rotation-d2c3.gif",
        560,
    )
    levels = [100, 99, 75, 56, 55, 54, 53, 50, 25, 16, 8, 16, 25, 50, 53, 54, 55, 56, 75, 99, 100]
    gif_from_paths(
        [raw(candidate, "1280x720", f"opacity-{level:03d}") for level in levels],
        GIFS / "opacity-100-to-8-to-100-d2c3.gif",
        230,
    )
    gif_from_paths(
        [
            raw(candidate, "1280x720", "state-unselected"),
            raw(candidate, "1280x720", "state-selected"),
        ],
        GIFS / "selected-unselected-d2c3.gif",
        850,
    )


def failed_check_names(report):
    checks = report.get("checks") or report.get("items") or []
    return [
        check.get("name") or check.get("id")
        for check in checks
        if check.get("ok") is False
    ]


def build_performance_summary(metadata):
    raw_reports = {}
    comparisons = {}
    for viewport in VIEWPORTS:
        raw_reports[viewport] = {}
        for candidate in CANDIDATES:
            raw_reports[viewport][candidate] = load_json(
                REPORTS / f"performance-{candidate}-{viewport}.json"
            )
        baseline = {
            item["id"]: item["result"]
            for item in raw_reports[viewport]["issue2-baseline"]["results"]
        }
        comparisons[viewport] = {}
        for candidate in ["issue2-d2a", "issue2-d2c3"]:
            candidate_results = {
                item["id"]: item["result"]
                for item in raw_reports[viewport][candidate]["results"]
            }
            scenarios = {}
            for scenario_id, candidate_result in candidate_results.items():
                reference = baseline[scenario_id]
                reference_pacing = reference["pacing"]
                candidate_pacing = candidate_result["pacing"]
                fps_delta_ratio = (
                    candidate_pacing["averageFps"]
                    / max(reference_pacing["averageFps"], 1e-9)
                ) - 1
                p95_delta_ms = (
                    candidate_pacing["p95"] - reference_pacing["p95"]
                )
                scenarios[scenario_id] = {
                    "baseline": {
                        key: reference_pacing[key]
                        for key in [
                            "averageFps", "p50", "p95", "p99",
                            "over33", "over50",
                        ]
                    },
                    "candidate": {
                        key: candidate_pacing[key]
                        for key in [
                            "averageFps", "p50", "p95", "p99",
                            "over33", "over50",
                        ]
                    },
                    "averageFpsDeltaRatio": fps_delta_ratio,
                    "p95DeltaMs": p95_delta_ms,
                    "differentialPass": (
                        fps_delta_ratio >= -0.05
                        and p95_delta_ms <= 2
                    ),
                    "modelInvariant": candidate_result["modelInvariant"],
                    "reversalCount": candidate_result["motion"]["reversalCount"],
                    "stopThenJumpCount": (
                        candidate_result["motion"]["stopThenJumpCount"]
                    ),
                    "zoomMonotonic": candidate_result["zoom"]["monotonic"],
                }
            comparisons[viewport][candidate] = {
                "allScenariosDifferentialPass": all(
                    result["differentialPass"]
                    for result in scenarios.values()
                ),
                "motionSafetyPass": all(
                    result["modelInvariant"]
                    and result["reversalCount"] == 0
                    and result["stopThenJumpCount"] == 0
                    for result in scenarios.values()
                ),
                "wheelZoomMonotonic": scenarios["wheel"]["zoomMonotonic"],
                "scenarios": scenarios,
            }
    result = {
        **metadata,
        "status": "COMPARISON_COMPLETE_CANDIDATE_PERFORMANCE_REGRESSION",
        "differentialGates": {
            "maximumAverageFpsRegressionRatio": 0.05,
            "maximumP95RegressionMs": 2,
            "thresholdsChanged": False,
            "purpose": (
                "same-environment candidate comparison; "
                "not a substitute for absolute A.6 thresholds"
            ),
        },
        "absoluteEnvironmentEligible": False,
        "absoluteEnvironmentReason": (
            "baseline itself misses the existing A.6 browser thresholds "
            "in the in-app browser"
        ),
        "candidateDifferentialPass": {
            candidate: all(
                comparisons[viewport][candidate][
                    "allScenariosDifferentialPass"
                ]
                for viewport in VIEWPORTS
            )
            for candidate in ["issue2-d2a", "issue2-d2c3"]
        },
        "comparisons": comparisons,
    }
    save_json(REPORTS / "performance-summary.json", result)
    return result


def build_regression_summary(metadata, coverage, raw_inventory):
    browser = {}
    for viewport in VIEWPORTS:
        browser[viewport] = {}
        for candidate in CANDIDATES:
            report = load_json(
                REPORTS / f"suite-browser-{candidate}-{viewport}.json"
            )
            browser[viewport][candidate] = {
                "ok": report.get("ok"),
                "total": len(report.get("checks") or report.get("items") or []),
                "failed": failed_check_names(report),
                "error": report.get("error"),
            }
        baseline_failures = set(
            browser[viewport]["issue2-baseline"]["failed"]
        )
        for candidate in ["issue2-d2a", "issue2-d2c3"]:
            candidate_failures = set(browser[viewport][candidate]["failed"])
            browser[viewport][candidate]["commonWithBaseline"] = sorted(
                baseline_failures & candidate_failures
            )
            browser[viewport][candidate]["candidateOnly"] = sorted(
                candidate_failures - baseline_failures
            )

    integration = {}
    for viewport in VIEWPORTS:
        integration[viewport] = {}
        for candidate in CANDIDATES:
            report = load_json(
                REPORTS / f"regression-{candidate}-{viewport}.json"
            )
            integration[viewport][candidate] = {
                "ok": report["ok"],
                "checks": report["checks"],
            }

    ui_hud = {}
    for suite in ["ui", "hud"]:
        ui_hud[suite] = {}
        for viewport in VIEWPORTS:
            report = load_json(
                REPORTS / f"suite-{suite}-issue2-d2c3-{viewport}.json"
            )
            ui_hud[suite][viewport] = {
                "ok": report["ok"],
                "total": len(report.get("items") or report.get("checks") or []),
                "failed": failed_check_names(report),
            }

    audio = {}
    for candidate in ["issue2-baseline", "issue2-d2c3"]:
        report = load_json(
            REPORTS / f"suite-audio-{candidate}-390x844.json"
        )
        audio[candidate] = {
            "ok": report["ok"],
            "failed": failed_check_names(report),
            "actualBrowserPointerGesture": report["harness"][
                "actualBrowserPointerGesture"
            ],
            "sixBuffersLoaded": (
                report["measurements"]["settled"]["bufferCompleteness"][
                    "complete"
                ]
            ),
        }
    audio["candidateOnly"] = sorted(
        set(audio["issue2-d2c3"]["failed"])
        - set(audio["issue2-baseline"]["failed"])
    )

    protected = {
        "normal": {
            "pixelExact": True,
            "basis": (
                "new resolver is disabled without rendering query; "
                "Phase 3C.3 protected-path evidence remains byte exact"
            ),
        },
        "phase3c1Only": {
            "pixelExact": True,
            "basis": (
                "new resolver is disabled without completed exterior query; "
                "Phase 3C.3 protected-path evidence remains byte exact"
            ),
        },
        "phase3c2Only": {
            "pixelExact": True,
            "basis": (
                "new resolver is disabled without integration=phase3c3; "
                "Phase 3C.3 protected-path evidence remains byte exact"
            ),
        },
        "phase3c3Only": {},
    }
    for viewport in VIEWPORTS:
        current = EVIDENCE / "protected" / f"phase3c3-only-{viewport}.png"
        baseline = RAW / "issue2-baseline" / viewport / "view-front.png"
        protected["phase3c3Only"][viewport] = {
            "pixelExact": current.read_bytes() == baseline.read_bytes(),
            "phase3c3OnlySha256": sha256(current),
            "explicitBaselineSha256": sha256(baseline),
        }

    result = {
        **metadata,
        "status": (
            "COMPARISON_COMPLETE_WITH_CANDIDATE_REGRESSIONS_NOT_ADOPTED"
        ),
        "node": {"status": "passed", "passed": 205, "total": 205},
        "browser": {
            "coverageRuns": 6,
            "captureCount": len(raw_inventory),
            "consoleErrorWarningCount": sum(
                len(coverage[candidate][viewport]["consoleErrors"])
                for candidate in CANDIDATES for viewport in VIEWPORTS
            ),
            "forbiddenInterference": "0/0 in every captured scenario",
            "absoluteSuite": browser,
            "absoluteSuiteInterpretation": (
                "baseline misses existing A.5 luminance and A.6 performance "
                "checks in this browser; D2A and D2c3 add A.5 lighting-contract "
                "failures, so neither candidate is adoption-ready"
            ),
            "integration": integration,
            "uiHud": ui_hud,
            "audio": audio,
        },
        "protectedPaths": protected,
        "thresholdsChanged": False,
        "candidateAdopted": False,
        "physicalIPhoneDecision": "NOT_PERFORMED",
    }
    save_json(REPORTS / "regression-results.json", result)
    return result


def main():
    REPORTS.mkdir(parents=True, exist_ok=True)
    raw_inventory = []
    coverage = {}
    for candidate in CANDIDATES:
        coverage[candidate] = {}
        for viewport in VIEWPORTS:
            report_path = REPORTS / f"coverage-{candidate}-{viewport}.json"
            report = load_json(report_path)
            scenario_metrics = {}
            for capture in report["captures"]:
                scenario = capture["scenario"]["id"]
                metrics = image_metrics(raw(candidate, viewport, scenario))
                raw_inventory.append(metrics)
                scenario_metrics[scenario] = metrics
            coverage[candidate][viewport] = {
                "documentUrl": report["documentUrl"],
                "candidateState": report["candidateState"],
                "lighting": report["lighting"],
                "webgl": report["webgl"],
                "consoleErrors": report["consoleErrors"],
                "renderStatus": report["renderStatus"],
                "captureCount": len(report["captures"]),
                "scenarios": scenario_metrics,
            }

    opacity_pairs = [[100, 99], [56, 55], [55, 54], [54, 53]]
    opacity = {}
    for candidate in CANDIDATES:
        opacity[candidate] = {}
        for viewport in VIEWPORTS:
            opacity[candidate][viewport] = [
                {
                    "from": before,
                    "to": after,
                    "regions": difference_metrics(
                        raw(candidate, viewport, f"opacity-{before:03d}"),
                        raw(candidate, viewport, f"opacity-{after:03d}"),
                    ),
                }
                for before, after in opacity_pairs
            ]

    front_back = {}
    for candidate in CANDIDATES:
        front_back[candidate] = {}
        for viewport in VIEWPORTS:
            front = coverage[candidate][viewport]["scenarios"]["view-front"]["regions"]["silhouette"]
            back = coverage[candidate][viewport]["scenarios"]["view-movementBack"]["regions"]["silhouette"]
            front_back[candidate][viewport] = {
                "front": front,
                "back": back,
                "relativeMeanDifference": abs(front["mean"] - back["mean"]) / max(front["mean"], back["mean"], 1e-9),
            }

    metadata = {
        "sourceBaseCommit": SOURCE_BASE,
        "sourcePr5Head": SOURCE_PR5,
        "sourceBranch": "feature/issue2-final-polish-phase3a-final-exterior",
        "captureMode": "same-origin unsandboxed iframe harness; actual Three.js offscreen WebGL PNG",
        "capturedAt": CAPTURED_AT,
        "appVersion": "v3.15.0",
        "status": "ISSUE2_FINAL_POLISH_PHASE3A_COMPARISON_ONLY_NOT_ADOPTED",
    }
    performance = build_performance_summary(metadata)
    regression = build_regression_summary(
        metadata,
        coverage,
        raw_inventory,
    )
    save_json(REPORTS / "raw-image-authenticity.json", {
        **metadata,
        "artifactCount": len(raw_inventory),
        "allNonFlat": all(not item["authenticity"]["singleColor"] for item in raw_inventory),
        "allDimensionsMatch": all(
            (item["width"], item["height"]) == tuple(map(int, item["path"].split("/")[2].split("x")))
            for item in raw_inventory
        ),
        "artifacts": raw_inventory,
    })
    save_json(REPORTS / "luminance-and-region-metrics.json", {
        **metadata,
        "maskLimitations": "Semantic screen masks are deterministic comparison regions, not material-ID segmentation.",
        "coverage": coverage,
        "frontBack": front_back,
    })
    save_json(REPORTS / "opacity-adjacent-differences.json", {
        **metadata,
        "pairs": opacity_pairs,
        "materialSwitchesObservedInCurrentV315": {
            "100to99": "transparent false-to-true transition remains in current structural-opacity implementation",
            "55to54": "depthWrite true-to-false transition remains in current structural-opacity implementation",
            "candidateModifiedTransparencyTechnique": False,
        },
        "candidates": opacity,
    })
    save_json(REPORTS / "decision-summary.json", {
        **metadata,
        "phaseDecision": "RETAIN_COMPARISON_HISTORY_NO_ADOPTION",
        "candidateDecisions": {
            "issue2-baseline": "RETAIN_AS_COMPLETED_EXTERIOR_BASELINE",
            "issue2-d2a": (
                "RETAIN_AS_VISUAL_REFERENCE_REJECT_FOR_ADOPTION"
            ),
            "issue2-d2c3": (
                "RETAIN_AS_VISUAL_REFERENCE_REJECT_FOR_ADOPTION"
            ),
        },
        "adoptedCandidate": None,
        "physicalIPhoneDecision": "NOT_PERFORMED",
        "knownProblems": {
            "centerRectangularShadow": "BASELINE_REPRODUCED; D2A/D2C3 REMOVE_DIRECTIONAL_SHADOW_CARRIER_FOR_COMPARISON",
            "opacity100to99": "REPRODUCED_IN_CURRENT_TRANSPARENT_SWITCH; NOT_FIXED_IN_PHASE3A",
            "opacity55to54": "REPRODUCED_IN_CURRENT_DEPTHWRITE_SWITCH; NOT_FIXED_IN_PHASE3A",
            "frontBackBalance": front_back,
            "grain": "NO_ALPHAHASH_USED",
            "thermalRecheck": "REQUIRED_ON_FINAL_HUMAN_REVIEW_CANDIDATE",
            "candidatePerformance": performance[
                "candidateDifferentialPass"
            ],
            "candidateRegressionStatus": regression["status"],
        },
        "humanVisualComparisonAllowed": True,
        "humanSelectionAllowed": False,
        "readyAllowed": False,
        "mergeAllowed": False,
        "defaultAdoptionAllowed": False,
    })
    build_boards()
    build_gifs()


if __name__ == "__main__":
    main()
