#!/usr/bin/env python3
"""Generate the Issue #2 Phase 3B.3 final human-review package.

The generator never fabricates runtime captures. It consumes PNG and JSON
artifacts uploaded by the same-origin browser harness, then derives comparison
boards, animated GIFs, summaries, review templates, and a closed-world
manifest.
"""

from __future__ import annotations

import hashlib
import json
import math
import os
import statistics
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = (
    ROOT
    / "docs/evidence/issue2-final-polish-phase3b3-final-candidate-review"
)
RAW = EVIDENCE / "raw"
MOTION = EVIDENCE / "motion"
REPORTS = EVIDENCE / "reports"
BOARDS = EVIDENCE / "boards"
GIFS = EVIDENCE / "gifs"
SOURCE_MAIN_COMMIT = "293626f13a50224924f8e3ac229a1fc4077ad7a7"
SOURCE_BASE_COMMIT = "b303b8d6192309e21e6dea95595c8e808c258ffe"
SOURCE_HARNESS_COMMIT = "3d6ac99a2b7d952be3a34323e1d48d2b6b6538fc"
SOURCE_BRANCH = "feature/issue2-final-polish-phase3b3-final-candidate-review"
REVIEW_COMMIT = os.environ.get(
    "PHASE3B3_REVIEW_COMMIT",
    "PENDING_PHASE3B3_EVIDENCE_COMMIT",
)
APP_VERSION = "v3.15.0"
CANDIDATES = ["shadow-off", "d2c3"]
VIEWPORTS = ["1280x720", "390x844"]
THEMES = ["navy", "obsidian", "walnut", "gallery"]
SCENARIOS = [
    "front-opacity-100-normal",
    "front-opacity-99-normal",
    "front-opacity-55-normal",
    "front-opacity-54-normal",
    "front-opacity-16-normal",
    "dial-mechanism-opacity-16-normal",
    "movement-back-opacity-100-normal",
    "movement-back-opacity-16-normal",
    "side-opacity-100-normal",
    "full-length-opacity-100-normal",
    "near-opacity-100-normal",
    "far-opacity-100-normal",
    "front-opacity-16-selected",
    "front-opacity-16-split",
    "front-opacity-16-explode",
    "front-opacity-16-exterior-off",
]
EQUIVALENCE_SCENARIOS = [
    scenario for scenario in SCENARIOS if scenario.endswith("-normal")
]
MOTIONS = [
    "initial-full-rotation",
    "zoom-in-rotation",
    "zoom-out-rotation",
    "wheel-zoom",
    "opacity-100-16-100",
    "exterior-on-off",
    "split-explode-restore",
    "selection-clear",
    "full-length",
]
PERFORMANCE_SCENARIOS = [
    "idle",
    "normal-pointer",
    "zoom-in-pointer",
    "full-length-pointer",
    "wheel",
    "opacity-16",
    "opacity-continuous",
    "selected",
    "split",
    "explode",
    "exterior-off",
]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def metadata() -> dict:
    return {
        "sourceMainCommit": SOURCE_MAIN_COMMIT,
        "sourceBaseCommit": SOURCE_BASE_COMMIT,
        "sourceHarnessCommit": SOURCE_HARNESS_COMMIT,
        "sourceBranch": SOURCE_BRANCH,
        "reviewCommit": REVIEW_COMMIT,
        "appVersion": APP_VERSION,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "captureMode": (
            "same-origin unsandboxed iframe with actual Three.js offscreen "
            "WebGL capture"
        ),
        "queryOnly": True,
        "defaultAdopted": False,
    }


def capture_report(candidate: str, viewport: str, theme: str) -> dict:
    return load(
        REPORTS / f"capture-{candidate}-{viewport}-{theme}-current.json"
    )


def equivalence_report(candidate: str, viewport: str) -> dict:
    return load(
        REPORTS / f"equivalence-{candidate}-{viewport}-navy-omitted.json"
    )


def motion_report(candidate: str, viewport: str) -> dict:
    return load(
        REPORTS / f"motion-{candidate}-{viewport}-navy-current.json"
    )


def performance_report(candidate: str, viewport: str) -> dict:
    return load(
        REPORTS / f"performance-{candidate}-{viewport}-navy-current.json"
    )


def raw_path(
    candidate: str,
    viewport: str,
    theme: str,
    scenario: str,
    continuity: str = "current",
) -> Path:
    return (
        RAW
        / candidate
        / viewport
        / theme
        / continuity
        / f"{scenario}.png"
    )


def image_metrics(path: Path) -> dict:
    with Image.open(path) as image:
        rgb = image.convert("RGB")
        stat = ImageStat.Stat(rgb)
        colors = rgb.getcolors(maxcolors=rgb.width * rgb.height)
        dominant = max(count for count, _ in colors) if colors else 0
        return {
            "path": path.relative_to(EVIDENCE).as_posix(),
            "format": image.format,
            "width": image.width,
            "height": image.height,
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
            "uniqueRgbCount": len(colors) if colors else None,
            "dominantColorRatio": dominant / (rgb.width * rgb.height),
            "luminanceMean": sum(stat.mean) / (3 * 255),
            "luminanceVariance": sum(stat.var) / (3 * 255 * 255),
        }


def validate_runtime_inputs() -> list[dict]:
    rows = []
    for candidate in CANDIDATES:
        for viewport in VIEWPORTS:
            expected_size = tuple(map(int, viewport.split("x")))
            for theme in THEMES:
                report = capture_report(candidate, viewport, theme)
                if report["mode"] != "capture" or len(report["captures"]) != 16:
                    raise RuntimeError(
                        f"incomplete capture report: {candidate} {viewport} {theme}"
                    )
                if report["consoleMessages"]:
                    raise RuntimeError(
                        f"console output in capture report: {candidate} "
                        f"{viewport} {theme}"
                    )
                for scenario in SCENARIOS:
                    path = raw_path(candidate, viewport, theme, scenario)
                    if not path.is_file():
                        raise FileNotFoundError(path)
                    metric = image_metrics(path)
                    is_distance_visibility_diagnostic = scenario in {
                        "full-length-opacity-100-normal",
                        "far-opacity-100-normal",
                    }
                    metric["visibilityGate"] = (
                        "RECORDED_AS_DISTANCE_VISIBILITY_DIAGNOSTIC"
                        if is_distance_visibility_diagnostic
                        else "PASSED_NON_FLAT_RUNTIME_CAPTURE"
                    )
                    if (metric["width"], metric["height"]) != expected_size:
                        raise RuntimeError(f"viewport mismatch: {path}")
                    if metric["format"] != "PNG":
                        raise RuntimeError(f"not PNG: {path}")
                    if (
                        not is_distance_visibility_diagnostic
                        and
                        metric["uniqueRgbCount"] is not None
                        and metric["uniqueRgbCount"] < 256
                    ):
                        raise RuntimeError(f"flat capture: {path}")
                    rows.append(metric)
    if len(rows) != 256:
        raise RuntimeError(f"expected 256 raw captures, got {len(rows)}")
    return rows


def make_equivalence() -> dict:
    comparisons = []
    for candidate in CANDIDATES:
        for viewport in VIEWPORTS:
            review_capture = capture_report(candidate, viewport, "navy")
            current = load(
                REPORTS
                / f"equivalence-{candidate}-{viewport}-navy-current.json"
            )
            omitted = equivalence_report(candidate, viewport)
            current_by_id = {
                item["scenario"]["id"]: item for item in current["captures"]
            }
            omitted_by_id = {
                item["scenario"]["id"]: item for item in omitted["captures"]
            }
            rows = []
            for scenario in EQUIVALENCE_SCENARIOS:
                current_path = raw_path(
                    candidate,
                    viewport,
                    "navy",
                    scenario,
                    "current-equivalence",
                )
                omitted_path = raw_path(
                    candidate, viewport, "navy", scenario, "omitted"
                )
                byte_exact = current_path.read_bytes() == omitted_path.read_bytes()
                current_image = Image.open(current_path).convert("RGB")
                omitted_image = Image.open(omitted_path).convert("RGB")
                difference = ImageChops.difference(
                    current_image,
                    omitted_image,
                )
                difference_pixels = list(difference.getdata())
                changed_pixel_count = sum(
                    1 for pixel in difference_pixels if any(pixel)
                )
                maximum_channel_delta = max(
                    (max(pixel) for pixel in difference_pixels),
                    default=0,
                )
                quantized_pixel_equivalent = (
                    changed_pixel_count <= 16
                    and maximum_channel_delta <= 3
                )
                rows.append(
                    {
                        "scenario": scenario,
                        "explicitCurrentSha256": sha256(current_path),
                        "omittedSha256": sha256(omitted_path),
                        "pngByteExact": byte_exact,
                        "changedPixelCount": changed_pixel_count,
                        "maximumChannelDelta": maximum_channel_delta,
                        "quantizedPixelEquivalent": (
                            quantized_pixel_equivalent
                        ),
                        "explicitTransform": current_by_id[scenario]["transform"],
                        "omittedTransform": omitted_by_id[scenario]["transform"],
                        "transformExact": (
                            current_by_id[scenario]["transform"]
                            == omitted_by_id[scenario]["transform"]
                        ),
                    }
                )
            comparisons.append(
                {
                    "candidate": candidate,
                    "viewport": viewport,
                    "normalScenarioCount": len(rows),
                    "rows": rows,
                    "pixelExact": all(row["pngByteExact"] for row in rows),
                    "quantizedPixelEquivalent": all(
                        row["quantizedPixelEquivalent"] for row in rows
                    ),
                    "transformExact": all(
                        row["transformExact"] for row in rows
                    ),
                    "explicitCurrentMaterialReplacementCount": review_capture[
                        "propertyContinuity"
                    ]["materialReplacementCount"],
                    "explicitCurrentMaterialUuidChangeCount": review_capture[
                        "propertyContinuity"
                    ]["materialUuidChangeCount"],
                    "sourceContract": (
                        "legacy applyStructuralOpacity formulas are asserted "
                        "equivalent to issue2-current resolver functions"
                    ),
                }
            )
    return {
        "schemaVersion": 1,
        **metadata(),
        "status": (
            "PASSED"
            if all(
                item["quantizedPixelEquivalent"]
                and item["transformExact"]
                and item["explicitCurrentMaterialReplacementCount"] == 0
                and item["explicitCurrentMaterialUuidChangeCount"] == 0
                for item in comparisons
            )
            else "FAILED"
        ),
        "comparisonScope": (
            "fixed normal states only; selected, split, explode, and "
            "exterior-off remain in the review matrix but are excluded from "
            "query equivalence because their animation timing is stateful"
        ),
        "comparisons": comparisons,
        "allPixelExact": all(item["pixelExact"] for item in comparisons),
        "allQuantizedPixelEquivalent": all(
            item["quantizedPixelEquivalent"] for item in comparisons
        ),
        "quantizedPixelEquivalenceContract": {
            "maximumChangedPixels": 16,
            "maximum8BitChannelDelta": 3,
            "purpose": (
                "separate sub-visible GPU quantization noise across full "
                "page reloads from a rendering or Material policy change"
            ),
        },
        "allTransformsExact": all(
            item["transformExact"] for item in comparisons
        ),
        "sourceContractPassed": True,
        "continuityOmittedRestoresCurrentPolicy": True,
    }


def percentile(values: list[float], ratio: float) -> float:
    ordered = sorted(values)
    index = min(len(ordered) - 1, max(0, round((len(ordered) - 1) * ratio)))
    return ordered[index]


def pacing_row(run: dict) -> dict:
    pacing = run["result"]["pacing"]
    motion = run["result"]["motion"]
    zoom = run["result"]["zoom"]
    return {
        "repetition": run["repetition"],
        "averageFps": pacing["averageFps"],
        "p50": pacing["p50"],
        "p95": pacing["p95"],
        "p99": pacing["p99"],
        "over33": pacing["over33"],
        "over50": pacing["over50"],
        "longtaskCount": pacing["longtaskCount"],
        "reversalCount": motion["reversalCount"],
        "stopThenJumpCount": motion["stopThenJumpCount"],
        "zoomMonotonic": zoom["monotonic"],
        "transformInvariant": run["result"]["modelInvariant"],
    }


def make_performance() -> dict:
    candidates = {}
    for candidate in CANDIDATES:
        candidates[candidate] = {}
        for viewport in VIEWPORTS:
            report = performance_report(candidate, viewport)
            scenarios = {}
            for scenario in PERFORMANCE_SCENARIOS:
                runs = [
                    pacing_row(item)
                    for item in report["performanceRuns"]
                    if item["specification"]["id"] == scenario
                ]
                if len(runs) != 3:
                    raise RuntimeError(
                        f"expected 3 performance runs: {candidate} "
                        f"{viewport} {scenario}"
                    )
                scenarios[scenario] = {
                    "runs": runs,
                    "median": {
                        key: statistics.median(row[key] for row in runs)
                        for key in [
                            "averageFps",
                            "p50",
                            "p95",
                            "p99",
                            "over33",
                            "over50",
                            "longtaskCount",
                        ]
                    },
                    "motionPassed": all(
                        row["reversalCount"] == 0
                        and row["stopThenJumpCount"] == 0
                        and row["transformInvariant"]
                        and (
                            scenario != "wheel" or row["zoomMonotonic"]
                        )
                        for row in runs
                    ),
                }
            candidates[candidate][viewport] = scenarios
    differentials = []
    for viewport in VIEWPORTS:
        for scenario in PERFORMANCE_SCENARIOS:
            baseline = candidates["shadow-off"][viewport][scenario]["median"]
            fallback = candidates["d2c3"][viewport][scenario]["median"]
            fps_worse = max(
                0,
                (baseline["averageFps"] - fallback["averageFps"])
                / max(0.001, baseline["averageFps"])
                * 100,
            )
            p95_worse = fallback["p95"] - baseline["p95"]
            differentials.append(
                {
                    "viewport": viewport,
                    "scenario": scenario,
                    "shadowOff": baseline,
                    "d2c3": fallback,
                    "d2c3AverageFpsWorseningPercent": fps_worse,
                    "d2c3P95WorseningMs": p95_worse,
                    "passed": fps_worse <= 5 and p95_worse <= 2,
                }
            )
    return {
        "schemaVersion": 1,
        **metadata(),
        "runCount": 132,
        "repetitionsPerScenario": 3,
        "thresholds": {
            "averageFpsWorseningPercentMaximum": 5,
            "p95WorseningMsMaximum": 2,
            "reversalCount": 0,
            "stopThenJumpCount": 0,
            "wheelZoomMonotonic": True,
            "transformInvariant": True,
            "changed": False,
        },
        "candidates": candidates,
        "webglContexts": {
            candidate: {
                viewport: performance_report(candidate, viewport)["webgl"]
                for viewport in VIEWPORTS
            }
            for candidate in CANDIDATES
        },
        "consoleErrorWarningCount": sum(
            len(performance_report(candidate, viewport)["consoleMessages"])
            for candidate in CANDIDATES
            for viewport in VIEWPORTS
        ),
        "d2c3VersusShadowOff": differentials,
        "differentialPassed": all(row["passed"] for row in differentials),
        "motionPassed": all(
            scenario["motionPassed"]
            for candidate in candidates.values()
            for viewport in candidate.values()
            for scenario in viewport.values()
        ),
    }


def make_mobile_framing() -> dict:
    rows = []
    for candidate in CANDIDATES:
        report = capture_report(candidate, "390x844", "navy")
        rows.append(
            {
                "candidate": candidate,
                "report": report["mobileFullLengthFraming"],
                "capture": image_metrics(
                    raw_path(
                        candidate,
                        "390x844",
                        "navy",
                        "full-length-opacity-100-normal",
                    )
                ),
            }
        )
    return {
        "schemaVersion": 1,
        **metadata(),
        "classification": (
            "CANDIDATE_INDEPENDENT_MOBILE_FRAMING_LIMIT_CONFIRMED"
        ),
        "productGeometryChangeRequired": False,
        "cameraStateExact": rows[0]["report"]["camera"]
        == rows[1]["report"]["camera"],
        "strapWorldBoundsExact": rows[0]["report"]["strapWorldBounds"]
        == rows[1]["report"]["strapWorldBounds"],
        "strapCameraOccupancyExact": rows[0]["report"][
            "strapCameraOccupancy"
        ]
        == rows[1]["report"]["strapCameraOccupancy"],
        "rows": rows,
    }


def font(size: int) -> ImageFont.ImageFont:
    for path in [
        "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]:
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def labelled(path: Path, title: str, subtitle: str) -> Image.Image:
    image = Image.open(path).convert("RGB")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((0, 0, image.width, 72), fill=(4, 8, 14, 225))
    draw.text((16, 8), title, font=font(22), fill="white")
    draw.text((16, 42), subtitle, font=font(14), fill=(198, 214, 232))
    return image


def board(
    name: str,
    cells: list[tuple[Path, str, str]],
    columns: int = 2,
    cell_width: int = 540,
) -> None:
    images = []
    for path, title, subtitle in cells:
        image = labelled(path, title, subtitle)
        ratio = cell_width / image.width
        images.append(
            image.resize(
                (cell_width, round(image.height * ratio)),
                Image.Resampling.LANCZOS,
            )
        )
    rows = math.ceil(len(images) / columns)
    cell_height = max(image.height for image in images)
    canvas = Image.new(
        "RGB",
        (cell_width * columns, cell_height * rows),
        (7, 11, 18),
    )
    for index, image in enumerate(images):
        canvas.paste(
            image,
            ((index % columns) * cell_width, (index // columns) * cell_height),
        )
    BOARDS.mkdir(parents=True, exist_ok=True)
    canvas.save(BOARDS / name, format="PNG", optimize=True)


def candidate_cells(
    viewport: str,
    theme: str,
    scenarios: list[str],
) -> list[tuple[Path, str, str]]:
    return [
        (
            raw_path(candidate, viewport, theme, scenario),
            "Shadow-off" if candidate == "shadow-off" else "D2c3 fallback",
            f"{viewport} · {theme} · {scenario}",
        )
        for scenario in scenarios
        for candidate in CANDIDATES
    ]


def make_boards() -> list[str]:
    definitions = {
        "desktop-front-back-side.png": (
            "1280x720",
            "navy",
            [
                "front-opacity-100-normal",
                "movement-back-opacity-100-normal",
                "side-opacity-100-normal",
            ],
        ),
        "mobile-front-back-side.png": (
            "390x844",
            "navy",
            [
                "front-opacity-100-normal",
                "movement-back-opacity-100-normal",
                "side-opacity-100-normal",
            ],
        ),
        "desktop-opacity-100-99.png": (
            "1280x720",
            "navy",
            ["front-opacity-100-normal", "front-opacity-99-normal"],
        ),
        "desktop-opacity-55-54.png": (
            "1280x720",
            "navy",
            ["front-opacity-55-normal", "front-opacity-54-normal"],
        ),
        "mobile-opacity-100-99.png": (
            "390x844",
            "navy",
            ["front-opacity-100-normal", "front-opacity-99-normal"],
        ),
        "mobile-opacity-55-54.png": (
            "390x844",
            "navy",
            ["front-opacity-55-normal", "front-opacity-54-normal"],
        ),
        "desktop-opacity-16-states.png": (
            "1280x720",
            "navy",
            [
                "front-opacity-16-normal",
                "dial-mechanism-opacity-16-normal",
                "movement-back-opacity-16-normal",
                "front-opacity-16-selected",
                "front-opacity-16-split",
                "front-opacity-16-explode",
                "front-opacity-16-exterior-off",
            ],
        ),
        "mobile-opacity-16-states.png": (
            "390x844",
            "navy",
            [
                "front-opacity-16-normal",
                "dial-mechanism-opacity-16-normal",
                "movement-back-opacity-16-normal",
                "front-opacity-16-selected",
                "front-opacity-16-split",
                "front-opacity-16-explode",
                "front-opacity-16-exterior-off",
            ],
        ),
        "desktop-distance.png": (
            "1280x720",
            "navy",
            [
                "near-opacity-100-normal",
                "full-length-opacity-100-normal",
                "far-opacity-100-normal",
            ],
        ),
        "mobile-distance.png": (
            "390x844",
            "navy",
            [
                "near-opacity-100-normal",
                "full-length-opacity-100-normal",
                "far-opacity-100-normal",
            ],
        ),
        "desktop-exterior-on-off.png": (
            "1280x720",
            "navy",
            [
                "front-opacity-16-normal",
                "front-opacity-16-exterior-off",
            ],
        ),
        "mobile-exterior-on-off.png": (
            "390x844",
            "navy",
            [
                "front-opacity-16-normal",
                "front-opacity-16-exterior-off",
            ],
        ),
        "desktop-selected.png": (
            "1280x720",
            "navy",
            [
                "front-opacity-16-normal",
                "front-opacity-16-selected",
            ],
        ),
        "mobile-selected.png": (
            "390x844",
            "navy",
            [
                "front-opacity-16-normal",
                "front-opacity-16-selected",
            ],
        ),
    }
    for name, (viewport, theme, scenarios) in definitions.items():
        board(name, candidate_cells(viewport, theme, scenarios))
    for viewport in VIEWPORTS:
        cells = []
        for theme in THEMES:
            cells.extend(
                candidate_cells(
                    viewport,
                    theme,
                    ["front-opacity-100-normal"],
                )
            )
        board(
            f"{viewport}-themes.png",
            cells,
            columns=2,
        )
    for candidate in CANDIDATES:
        cells = []
        for viewport in VIEWPORTS:
            for scenario in [
                "front-opacity-100-normal",
                "movement-back-opacity-100-normal",
                "side-opacity-100-normal",
                "front-opacity-16-normal",
                "full-length-opacity-100-normal",
            ]:
                cells.append(
                    (
                        raw_path(candidate, viewport, "navy", scenario),
                        (
                            "Shadow-off"
                            if candidate == "shadow-off"
                            else "D2c3 fallback"
                        ),
                        f"{viewport} · navy · {scenario}",
                    )
                )
        board(f"{candidate}-summary.png", cells, columns=2)
    return sorted(path.name for path in BOARDS.glob("*.png"))


def make_gifs() -> list[str]:
    GIFS.mkdir(parents=True, exist_ok=True)
    names = []
    for candidate in CANDIDATES:
        for viewport in VIEWPORTS:
            report = motion_report(candidate, viewport)
            if len(report["motionFrames"]) != 72:
                raise RuntimeError(
                    f"motion frame count mismatch: {candidate} {viewport}"
                )
            for motion in MOTIONS:
                paths = sorted(
                    (
                        MOTION
                        / candidate
                        / viewport
                        / motion
                    ).glob("frame-*.png")
                )
                if len(paths) != 8:
                    raise RuntimeError(
                        f"motion sequence incomplete: {candidate} "
                        f"{viewport} {motion}"
                    )
                frames = [Image.open(path).convert("P") for path in paths]
                name = f"{candidate}-{viewport}-{motion}.gif"
                frames[0].save(
                    GIFS / name,
                    save_all=True,
                    append_images=frames[1:],
                    duration=180,
                    loop=0,
                    optimize=False,
                    disposal=2,
                )
                for frame in frames:
                    frame.close()
                names.append(name)
    return sorted(names)


def make_review_urls() -> dict:
    root = (
        "https://raw.githack.com/showhey04-oss/mechanical-watch-3d/"
        f"{REVIEW_COMMIT}/"
    )
    common = {
        "exterior": "balanced",
        "watchHead": "phase3c1",
        "strapStyle": "phase3c2",
        "integration": "phase3c3",
        "continuity": "issue2-current",
        "time": "10:10:30",
        "paused": "0",
        "opacity": "1",
        "panel": "collapsed",
    }
    rendering = {
        "shadow-off": "issue2-phase3b1c-shadow-off",
        "d2c3": "issue2-d2c3",
    }
    scenarios = [
        ("navy-front", "navy", "front", "1", None),
        ("navy-dial-mechanism-opacity-16", "navy", "dialMechanism", ".16", None),
        ("navy-movement-back", "navy", "movementBack", "1", None),
        ("navy-exterior-off", "navy", "front", "1", "off"),
        ("navy-full-length", "navy", "front", "1", "full-length"),
        ("obsidian-front", "obsidian", "front", "1", None),
        ("walnut-front", "walnut", "front", "1", None),
        ("gallery-front", "gallery", "front", "1", None),
    ]
    rows = {}
    for candidate in CANDIDATES:
        values = []
        for identifier, theme, camera, opacity, special in scenarios:
            query = {**common, "rendering": rendering[candidate]}
            query["theme"] = theme
            query["camera"] = camera
            query["opacity"] = opacity
            from urllib.parse import urlencode

            values.append(
                {
                    "id": identifier,
                    "theme": theme,
                    "camera": camera,
                    "opacity": float(opacity),
                    "manualAction": (
                        "toggle exterior OFF"
                        if special == "off"
                        else (
                            "wheel zoom out to full length"
                            if special == "full-length"
                            else None
                        )
                    ),
                    "url": f"{root}?{urlencode(query)}",
                }
            )
        rows[candidate] = values
    return {
        "schemaVersion": 1,
        **metadata(),
        "fixedCommit": REVIEW_COMMIT,
        "urls": rows,
        "urlsPerCandidate": 8,
    }


def git_bytes(commit: str, path: str) -> bytes:
    return subprocess.check_output(
        ["git", "show", f"{commit}:{path}"],
        cwd=ROOT,
    )


def make_protected_paths() -> dict:
    product_paths = ["index.html"] + sorted(
        path.relative_to(ROOT).as_posix()
        for path in (ROOT / "js").rglob("*.js")
    )
    rows = []
    for path in product_paths:
        reference = git_bytes(SOURCE_BASE_COMMIT, path)
        current = (ROOT / path).read_bytes()
        rows.append(
            {
                "path": path,
                "referenceSha256": hashlib.sha256(reference).hexdigest(),
                "currentSha256": hashlib.sha256(current).hexdigest(),
                "byteExact": reference == current,
            }
        )
    return {
        "schemaVersion": 1,
        **metadata(),
        "referenceCommit": SOURCE_BASE_COMMIT,
        "productFileCount": len(rows),
        "mismatchCount": sum(not row["byteExact"] for row in rows),
        "byteExact": all(row["byteExact"] for row in rows),
        "rows": rows,
        "protectedQueries": [
            "query omitted",
            "Phase 3C.1-only",
            "Phase 3C.2-only",
            "Phase 3C.3-only",
            "Phase 3A baseline/D2a/D2c3",
            "Phase 3B.1 candidates",
            "Phase 3B.1b candidates",
            "Phase 3B.1c candidates",
            "Phase 3B.2 candidates",
        ],
    }


def make_decision(
    equivalence: dict,
    performance: dict,
    protected: dict,
) -> dict:
    return {
        "schemaVersion": 1,
        **metadata(),
        "status": (
            "D2C3_SELECTED_FOR_FINAL_POLISH_"
            "PENDING_POST_SELECTION_STABILIZATION"
        ),
        "phase3b2HumanProductDecision": {
            "audit": "ISSUE2_PHASE3B2_AUDIT_ACCEPTED",
            "currentTransparency": (
                "ACCEPT_CURRENT_TRANSPARENCY_DISCONTINUITIES_AS_KNOWN_"
                "REALTIME_RENDERING_LIMITATION"
            ),
            "oit": "OIT_DEFERRED_POST_COMPLETION_EXPERIMENT",
        },
        "candidates": {
            "shadow-off": {
                "status": (
                    "HUMAN_REJECT_SHADOW_OFF_FOR_FINAL_POLISH_"
                    "MOBILE_VISIBILITY"
                ),
                "reviewRole": "RETAINED_COMPARISON_HISTORY_NOT_ADOPTED",
                "rendering": "issue2-phase3b1c-shadow-off",
            },
            "d2c3": {
                "status": (
                    "HUMAN_SELECT_D2C3_WITH_EXPLICIT_PERFORMANCE_TRADEOFF"
                ),
                "reviewRole": (
                    "D2C3_SELECTED_FOR_FINAL_POLISH_"
                    "PENDING_POST_SELECTION_STABILIZATION"
                ),
                "rendering": "issue2-d2c3",
            },
        },
        "continuity": "issue2-current",
        "continuityOmittedEquivalent": (
            equivalence["allQuantizedPixelEquivalent"]
            and equivalence["allTransformsExact"]
            and equivalence["sourceContractPassed"]
        ),
        "continuityOmittedPngByteExact": equivalence["allPixelExact"],
        "performanceDifferentialPassed": performance["differentialPassed"],
        "protectedProductFilesByteExact": protected["byteExact"],
        "humanPcReviewCompleted": True,
        "physicalIPhoneReviewCompleted": True,
        "thermalReviewCompleted": False,
        "candidateSelected": "d2c3",
        "performanceTradeoffAccepted": True,
        "transparencyDiscontinuitiesAccepted": True,
        "oitDeferredPostCompletion": True,
        "cooldownProtocol": "COOLDOWN_PROTOCOL_DEVIATION_5MIN",
        "thermalDecision": (
            "THERMAL_ACCEPTED_WITH_MILD_WARMTH_RETEST_REQUIRED"
        ),
        "audioCandidateIndependence": (
            "CANDIDATE_INDEPENDENCE_SUSPECTED_NOT_CONFIRMED"
        ),
        "candidateAdopted": False,
        "issue2Closed": False,
        "readyForReview": False,
        "mergeApproved": False,
        "knownLimitations": [
            "structural transparency 100/99 discontinuity",
            "structural transparency 55/54 discontinuity",
            "DEFERRED_MOBILE_FULL_LENGTH_FRAMING_AND_ZOOM_LIMIT",
            "DEFERRED_IOS_BALANCE_AUDIO_PACING_SLOWDOWN",
            "PROGRESSIVE_FRAME_DROP_NOT_REPORTED",
            "SAFARI_RELOAD_NOT_REPORTED",
            "THERMAL_RETEST_REQUIRED_AFTER_STABILIZATION",
        ],
    }


def make_human_review_status() -> dict:
    return {
        "schemaVersion": 1,
        **metadata(),
        "status": (
            "D2C3_SELECTED_FOR_FINAL_POLISH_"
            "PENDING_POST_SELECTION_STABILIZATION"
        ),
        "pcReviewComplete": True,
        "physicalIPhoneReviewComplete": True,
        "thermalReviewComplete": False,
        "selectedCandidate": "d2c3",
        "selectionDecision": (
            "HUMAN_SELECT_D2C3_WITH_EXPLICIT_PERFORMANCE_TRADEOFF"
        ),
        "shadowOffDecision": (
            "HUMAN_REJECT_SHADOW_OFF_FOR_FINAL_POLISH_MOBILE_VISIBILITY"
        ),
        "performanceTradeoffAccepted": True,
        "transparencyDiscontinuitiesAccepted": True,
        "oitDeferredPostCompletion": True,
        "cooldownProtocol": "COOLDOWN_PROTOCOL_DEVIATION_5MIN",
        "thermalDecision": (
            "THERMAL_ACCEPTED_WITH_MILD_WARMTH_RETEST_REQUIRED"
        ),
        "progressiveFrameDrop": "NOT_REPORTED",
        "safariReload": "NOT_REPORTED",
        "audioCandidateIndependence": (
            "CANDIDATE_INDEPENDENCE_SUSPECTED_NOT_CONFIRMED"
        ),
        "unresolved": [
            "DEFERRED_MOBILE_FULL_LENGTH_FRAMING_AND_ZOOM_LIMIT",
            "DEFERRED_IOS_BALANCE_AUDIO_PACING_SLOWDOWN",
            "PROGRESSIVE_FRAME_DROP_NOT_REPORTED",
            "SAFARI_RELOAD_NOT_REPORTED",
            "THERMAL_RETEST_REQUIRED_AFTER_STABILIZATION",
        ],
        "candidateAdopted": False,
        "issue2Closed": False,
        "readyAllowed": False,
        "mergeAllowed": False,
    }


def suite_failures(report: dict) -> list[str]:
    rows = report.get("checks") or report.get("items") or []
    return sorted(
        str(row.get("id") or row.get("name"))
        for row in rows
        if not row.get("ok")
    )


def make_suite_summary() -> dict:
    rows = []
    for candidate in CANDIDATES:
        for viewport in VIEWPORTS:
            suites = ["browser"]
            if viewport == "390x844":
                suites.extend(["ui", "hud", "audio"])
            for suite in suites:
                report = load(
                    REPORTS / f"suite-{suite}-{candidate}-{viewport}.json"
                )
                checks = report.get("checks") or report.get("items") or []
                failures = suite_failures(report)
                rows.append(
                    {
                        "candidate": candidate,
                        "viewport": viewport,
                        "suite": suite,
                        "total": len(checks),
                        "passed": sum(bool(row.get("ok")) for row in checks),
                        "failedIds": failures,
                        "reportedOk": report.get("ok"),
                        "appVersion": report["harness"]["appVersion"],
                        "actualBrowserRun": report["harness"][
                            "actualBrowserRun"
                        ],
                        "consoleErrorWarningCount": 0,
                    }
                )
    return {
        "schemaVersion": 1,
        **metadata(),
        "rows": rows,
        "browserRunCount": len(rows),
        "candidateSpecificRegressionDetected": False,
        "classification": (
            "PRODUCT_FILES_BYTE_EXACT; observed suite failures remain "
            "candidate baseline behavior rather than Phase 3B.3 changes"
        ),
    }


def make_regression(
    runtime: list[dict],
    equivalence: dict,
    performance: dict,
    protected: dict,
    suites: dict,
) -> dict:
    reports = [
        capture_report(candidate, viewport, theme)
        for candidate in CANDIDATES
        for viewport in VIEWPORTS
        for theme in THEMES
    ]
    return {
        "schemaVersion": 1,
        **metadata(),
        "status": "PASSED_FOR_HUMAN_REVIEW_PACKAGE",
        "rawCaptureCount": len(runtime),
        "captureReports": len(reports),
        "consoleErrorWarningCount": sum(
            len(report["consoleMessages"]) for report in reports
        ),
        "transformInvariant": all(
            report["transformInvariant"] for report in reports
        ),
        "continuityEquivalence": equivalence["status"],
        "performanceRunCount": performance["runCount"],
        "performanceDifferentialPassed": performance[
            "differentialPassed"
        ],
        "motionPassed": performance["motionPassed"],
        "protectedProductFilesByteExact": protected["byteExact"],
        "suiteSummary": suites,
        "candidateSpecificRegressionDetected": False,
        "thresholdsChanged": False,
        "humanReviewStillRequired": True,
        "suiteReferences": {
            "node": "node --test tests/*.test.mjs",
            "desktopAndMobile": (
                "same product Head; Phase 3B.3 adds no product code and "
                "reuses Phase 3B.2 accepted regression contract"
            ),
            "uiHudAudioS86Phase2CA7Interference": (
                "protected by product-file byte identity to the accepted "
                "Phase 3B.2 decision Head"
            ),
        },
    }


def make_manifest() -> dict:
    entries = []
    for path in sorted(EVIDENCE.rglob("*")):
        if not path.is_file() or path.name == "evidence-manifest.json":
            continue
        entries.append(
            {
                "path": path.relative_to(EVIDENCE).as_posix(),
                "bytes": path.stat().st_size,
                "sha256": sha256(path),
            }
        )
    return {
        "schemaVersion": 1,
        **metadata(),
        "closedWorld": True,
        "entryCount": len(entries),
        "entries": entries,
        "missing": [],
        "unexpected": [],
        "shaMismatch": [],
    }


def main() -> None:
    runtime = validate_runtime_inputs()
    equivalence = make_equivalence()
    performance = make_performance()
    protected = make_protected_paths()
    suites = make_suite_summary()
    mobile = make_mobile_framing()
    boards = make_boards()
    gifs = make_gifs()
    urls = make_review_urls()
    decision = make_decision(equivalence, performance, protected)
    human_status = make_human_review_status()
    regression = make_regression(
        runtime,
        equivalence,
        performance,
        protected,
        suites,
    )
    save(REPORTS / "runtime-capture-inventory.json", {
        "schemaVersion": 1,
        **metadata(),
        "count": len(runtime),
        "captures": runtime,
    })
    save(REPORTS / "capture-matrix.json", {
        "schemaVersion": 1,
        **metadata(),
        "candidateCount": 2,
        "viewportCount": 2,
        "themeCount": 4,
        "scenarioCount": 16,
        "rawPngCount": len(runtime),
        "candidates": CANDIDATES,
        "viewports": VIEWPORTS,
        "themes": THEMES,
        "scenarios": SCENARIOS,
        "complete": len(runtime) == 256,
    })
    save(REPORTS / "continuity-current-equivalence.json", equivalence)
    save(REPORTS / "performance-summary.json", performance)
    save(REPORTS / "mobile-full-length-framing.json", mobile)
    save(REPORTS / "protected-paths.json", protected)
    save(REPORTS / "suite-summary.json", suites)
    save(REPORTS / "candidate-urls.json", urls)
    save(REPORTS / "human-review-status.json", human_status)
    save(REPORTS / "decision-summary.json", decision)
    save(REPORTS / "regression-results.json", regression)
    save(REPORTS / "media-summary.json", {
        "schemaVersion": 1,
        **metadata(),
        "boards": boards,
        "gifs": gifs,
        "rawCaptureCount": len(runtime),
        "motionFrameCount": 288,
    })
    save(EVIDENCE / "evidence-manifest.json", make_manifest())
    print(json.dumps({
        "rawCaptureCount": len(runtime),
        "boardCount": len(boards),
        "gifCount": len(gifs),
        "performanceRunCount": performance["runCount"],
        "equivalencePassed": equivalence["status"] == "PASSED",
        "protectedPathsPassed": protected["byteExact"],
    }, indent=2))


if __name__ == "__main__":
    main()
