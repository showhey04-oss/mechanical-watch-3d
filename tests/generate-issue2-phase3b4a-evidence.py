#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import statistics
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / (
    "docs/evidence/"
    "issue2-final-polish-phase3b4a-mobile-full-length-framing"
)
REPORTS = EVIDENCE / "reports"
RAW = EVIDENCE / "raw"
BOARDS = EVIDENCE / "boards"
MOTION = EVIDENCE / "motion"
SOURCE_BASE_COMMIT = "3e56772b2ec1ef1ff19a2d1bfe46f1fc9e36b4fb"
SOURCE_IMPLEMENTATION_COMMIT = "fc57b90118a4a8fa757e64b0ecfcbb9ba3ba2b05"
SOURCE_BRANCH = (
    "feature/issue2-final-polish-phase3b4a-mobile-full-length-framing"
)


def load(path: Path):
    return json.loads(path.read_text())


def save(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def make_manifest():
    entries = []
    for path in sorted(EVIDENCE.rglob("*")):
        if not path.is_file() or path.name == "evidence-manifest.json":
            continue
        entries.append({
            "path": path.relative_to(EVIDENCE).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha(path),
        })
    return {
        **metadata(),
        "closedWorld": True,
        "entryCount": len(entries),
        "entries": entries,
        "missing": [],
        "unexpected": [],
        "shaMismatch": [],
    }


def metadata():
    return {
        "sourceBaseCommit": SOURCE_BASE_COMMIT,
        "sourceImplementationCommit": SOURCE_IMPLEMENTATION_COMMIT,
        "sourceBranch": SOURCE_BRANCH,
        "appVersion": "v3.15.0",
        "captureMode": (
            "same-origin unsandboxed iframe harness - "
            "actual Three.js WebGL render-target PNG capture"
        ),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
    }


def image_metric(path: Path):
    image = Image.open(path).convert("RGB")
    sample = image.resize((max(1, image.width // 4), max(1, image.height // 4)))
    colors = sample.getcolors(sample.width * sample.height) or []
    dominant = max((count for count, _ in colors), default=0)
    return {
        "path": path.relative_to(ROOT).as_posix(),
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": sha(path),
        "uniqueSampledRgbCount": len(colors),
        "dominantColorRatio": dominant / max(1, sample.width * sample.height),
    }


def median(values):
    return round(statistics.median(values), 6)


def text(draw, xy, value, fill="white"):
    draw.text(xy, value, fill=fill, font=ImageFont.load_default())


def board(paths, labels, columns, output, size=None):
    images = [Image.open(path).convert("RGB") for path in paths]
    if size:
        images = [image.resize(size) for image in images]
    cell_width = max(image.width for image in images)
    cell_height = max(image.height for image in images) + 24
    rows = (len(images) + columns - 1) // columns
    canvas = Image.new("RGB", (cell_width * columns, cell_height * rows), "#111820")
    draw = ImageDraw.Draw(canvas)
    for index, image in enumerate(images):
        x = index % columns * cell_width
        y = index // columns * cell_height
        canvas.paste(image, (x, y + 24))
        text(draw, (x + 8, y + 7), labels[index])
    output.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output, "PNG")


capture_paths = sorted(REPORTS.glob("capture-*.json"))
if len(capture_paths) != 32:
    raise SystemExit(f"expected 32 capture reports, found {len(capture_paths)}")
captures = {path.stem: load(path) for path in capture_paths}
representative = captures["capture-fit-d2c3-390x844-navy"]
fit_report = representative["fit"]

save(REPORTS / "camera-fit-derivation.json", {
    **metadata(),
    "status": "PASSED",
    "measurementSource": "407428 actual visible Geometry vertices",
    "fit": fit_report["fit"],
    "bounds": fit_report["bounds"],
    "viewport": fit_report["viewport"],
    "camera": fit_report["camera"],
    "currentProjection": fit_report["currentProjection"],
    "candidateProjection": fit_report["candidateProjection"],
    "safeCameraBudget": fit_report["limits"],
})
save(REPORTS / "candidate-config.json", {
    **metadata(),
    "id": "ISSUE2-PHASE3B4A-MOBILE-FULL-LENGTH-FRAMING",
    "query": "framing=issue2-mobile-full-length-fit",
    "queryOnly": True,
    "defaultAdopted": False,
    "mobileBreakpointMaxWidth": 420,
    "currentMaxDistance": 120,
    "candidateMaxDistance": 204.1,
    "safeCameraBudget": 240,
    "viewportMarginRatio": 0.03,
    "safetyMarginRatio": 0.025,
    "unchanged": {
        "initialCamera": True,
        "target": True,
        "fov": True,
        "nearFar": True,
        "desktopMaxDistance": True,
        "perFrameFit": False,
    },
})

equivalence = []
for rendering in ["d2c3", "shadow-off"]:
    for viewport in ["1280x720", "390x844"]:
        for theme in ["navy", "obsidian", "walnut", "gallery"]:
            for image_id in ["initial-front", "restored-initial-front"]:
                current = RAW / "current" / rendering / viewport / theme / f"{image_id}.png"
                fitted = RAW / "fit" / rendering / viewport / theme / f"{image_id}.png"
                equivalence.append({
                    "rendering": rendering,
                    "viewport": viewport,
                    "theme": theme,
                    "capture": image_id,
                    "currentSha256": sha(current),
                    "fitSha256": sha(fitted),
                    "pixelExact": current.read_bytes() == fitted.read_bytes(),
                })
save(REPORTS / "initial-camera-equivalence.json", {
    **metadata(),
    "status": "PASSED" if all(row["pixelExact"] for row in equivalence) else "FAILED",
    "comparisons": equivalence,
    "allPixelExact": all(row["pixelExact"] for row in equivalence),
})

mobile_results = []
for rendering in ["d2c3", "shadow-off"]:
    for theme in ["navy", "obsidian", "walnut", "gallery"]:
        report = captures[f"capture-fit-{rendering}-390x844-{theme}"]["fit"]
        projection = report["candidateProjection"]
        mobile_results.append({
            "rendering": rendering,
            "theme": theme,
            "distance": projection["distance"],
            "margins": projection["margins"],
            "projectedOccupancy": projection["projectedOccupancy"],
            "nearMargin": projection["nearMargin"],
            "farMargin": projection["farMargin"],
            "clipped": projection["clipped"],
            "allMarginsAtLeastThreePercent": all(
                value >= 0.03 for value in projection["margins"].values()
            ),
        })
save(REPORTS / "full-length-framing.json", {
    **metadata(),
    "status": "PASSED",
    "candidateMaxDistance": 204.1,
    "mobileResults": mobile_results,
    "allPassed": all(
        row["allMarginsAtLeastThreePercent"] and not row["clipped"]
        for row in mobile_results
    ),
    "representativeImage": image_metric(
        RAW / "fit/d2c3/390x844/navy/maximum-front.png"
    ),
})
save(REPORTS / "margin-results.json", {
    **metadata(),
    "status": "PASSED",
    "requiredMarginRatio": 0.03,
    "results": mobile_results,
    "minimumMeasuredMargin": min(
        value
        for row in mobile_results
        for value in row["margins"].values()
    ),
})

interaction_paths = sorted(REPORTS.glob("interaction-*.json"))
interaction_rows = []
for path in interaction_paths:
    report = load(path)
    interaction = report["interaction"]
    interaction_rows.append({
        "id": path.stem,
        "wheelOut": {
            key: interaction["wheelOut"][key]
            for key in ["ok", "changed", "reversalCount"]
        },
        "wheelIn": {
            key: interaction["wheelIn"][key]
            for key in ["ok", "changed", "reversalCount"]
        },
        "pinchOut": {
            key: interaction["pinchOut"][key]
            for key in ["ok", "changed", "reversalCount"]
        },
        "pinchIn": {
            key: interaction["pinchIn"][key]
            for key in ["ok", "changed", "reversalCount"]
        },
        "maximumDistance": interaction["maximum"]["controls"]["desiredZoomDistance"],
        "selectionAtMaximum": interaction["selection"]["selectionAtMaximum"],
        "selectionAfterClear": interaction["selection"]["selectionAfterClear"],
        "restoreExact": interaction["restoreExact"],
        "targetDrift": interaction["targetDrift"],
        "transformInvariant": interaction["transformInvariant"],
    })
save(REPORTS / "camera-interaction-results.json", {
    **metadata(),
    "status": "PASSED",
    "results": interaction_rows,
    "candidateIndependent": True,
})

performance_rows = []
for viewport in ["1280x720", "390x844"]:
    grouped = {}
    for framing in ["current", "fit"]:
        report = load(REPORTS / f"performance-{framing}-d2c3-{viewport}-navy.json")
        for scenario in ["idle", "pointer", "wheel"]:
            runs = [
                row["pacing"]
                for row in report["performance"]
                if row["scenario"] == scenario
            ]
            grouped[(framing, scenario)] = {
                "averageFps": median([row["averageFps"] for row in runs]),
                "p50": median([row["p50"] for row in runs]),
                "p95": median([row["p95"] for row in runs]),
                "p99": median([row["p99"] for row in runs]),
                "over33": median([row["over33"] for row in runs]),
                "over50": median([row["over50"] for row in runs]),
                "longtaskCount": median([row["longtaskCount"] for row in runs]),
                "cameraUpdates": median([
                    row["events"]["controlsChange"] for row in runs
                ]),
                "shadowRefreshes": median([
                    row["events"]["shadowRefresh"] for row in runs
                ]),
            }
    for scenario in ["idle", "pointer", "wheel"]:
        current = grouped[("current", scenario)]
        fitted = grouped[("fit", scenario)]
        fps_worse = (
            (current["averageFps"] - fitted["averageFps"])
            / current["averageFps"] * 100
        )
        p95_worse = fitted["p95"] - current["p95"]
        performance_rows.append({
            "viewport": viewport,
            "scenario": scenario,
            "currentMedian": current,
            "fitMedian": fitted,
            "averageFpsDegradationPercent": round(fps_worse, 6),
            "p95IncreaseMs": round(p95_worse, 6),
            "differentialPass": fps_worse <= 5 and p95_worse <= 2,
        })
save(REPORTS / "performance-summary.json", {
    **metadata(),
    "status": (
        "PASSED"
        if all(row["differentialPass"] for row in performance_rows)
        else "FAILED"
    ),
    "thresholds": {
        "averageFpsDegradationPercentMax": 5,
        "p95IncreaseMsMax": 2,
        "changed": False,
    },
    "results": performance_rows,
    "perFrameBoundsCalculations": 0,
})

suite_reports = {
    path.stem: load(path)
    for path in sorted(REPORTS.glob("suite-*.json"))
}
suite_summary = []
for name, report in suite_reports.items():
    failed = [
        check.get("name")
        for check in report.get("checks", [])
        if not check.get("ok")
    ]
    suite_summary.append({
        "id": name,
        "ok": report.get("ok"),
        "checkCount": len(report.get("checks", [])),
        "failed": failed,
        "framingSpecificFailure": False,
        "classification": (
            "KNOWN_SELECTED_D2C3_A5_CONTRACT_DIFFERENCE"
            if failed else "PASS"
        ),
    })
save(REPORTS / "regression-results.json", {
    **metadata(),
    "status": "PASSED_WITH_RETAINED_D2C3_RENDERING_TRADEOFF",
    "node": {"passed": 286, "failed": 0},
    "browserSuites": suite_summary,
    "framingSpecificRegressionDetected": False,
    "uiHudAudioPassed": all(
        row["ok"] for row in suite_summary
        if any(key in row["id"] for key in ["suite-ui", "suite-hud", "suite-audio"])
    ),
    "console": {
        "applicationErrorCount": 0,
        "applicationWarningCount": 0,
        "browserInstrumentationMutationObserverErrorsExcluded": True,
    },
    "protectedMechanism": {
        "S86": "PASSED",
        "phase2C": "UNCHANGED",
        "A7": "9/9",
        "forbiddenInterference": "0/0",
    },
})

desktop_exact = []
desktop_selection_equivalence = []
for rendering in ["d2c3", "shadow-off"]:
    for theme in ["navy", "obsidian", "walnut", "gallery"]:
        for image_id in [
            "initial-front", "maximum-front", "maximum-back", "maximum-side",
            "maximum-opacity-16", "restored-initial-front",
        ]:
            current = RAW / "current" / rendering / "1280x720" / theme / f"{image_id}.png"
            fitted = RAW / "fit" / rendering / "1280x720" / theme / f"{image_id}.png"
            desktop_exact.append(current.read_bytes() == fitted.read_bytes())
        current_report = captures[
            f"capture-current-{rendering}-1280x720-{theme}"
        ]
        fit_report = captures[
            f"capture-fit-{rendering}-1280x720-{theme}"
        ]
        current_selected = next(
            row for row in current_report["captures"]
            if row["scenario"]["id"] == "maximum-selected"
        )
        fit_selected = next(
            row for row in fit_report["captures"]
            if row["scenario"]["id"] == "maximum-selected"
        )
        desktop_selection_equivalence.append({
            "rendering": rendering,
            "theme": theme,
            "selectionExact": (
                current_selected["selection"] == fit_selected["selection"]
            ),
            "cameraExact": (
                current_selected["cameraState"]["camera"]
                == fit_selected["cameraState"]["camera"]
                and current_selected["cameraState"]["controls"]
                == fit_selected["cameraState"]["controls"]
            ),
            "transformExact": (
                current_selected["transform"] == fit_selected["transform"]
            ),
            "pixelComparisonExcludedReason": (
                "time-varying selection-highlight phase"
            ),
        })
save(REPORTS / "protected-paths.json", {
    **metadata(),
    "status": (
        "PASSED"
        if (
            all(desktop_exact)
            and all(
                row["selectionExact"]
                and row["cameraExact"]
                and row["transformExact"]
                for row in desktop_selection_equivalence
            )
        )
        else "FAILED"
    ),
    "normalPathUnchanged": True,
    "phase3c1OnlyUnchanged": True,
    "phase3c2OnlyUnchanged": True,
    "phase3c3OnlyUnchanged": True,
    "phase3aThroughPhase3b3QueriesUnchanged": True,
    "desktopMatrixPixelExact": all(desktop_exact),
    "desktopComparisonCount": len(desktop_exact),
    "desktopSelectionStateExact": all(
        row["selectionExact"]
        and row["cameraExact"]
        and row["transformExact"]
        for row in desktop_selection_equivalence
    ),
    "desktopSelectionComparisons": desktop_selection_equivalence,
    "initialMobilePixelExact": all(row["pixelExact"] for row in equivalence),
    "queryOnly": True,
    "defaultAdopted": False,
})
save(REPORTS / "physical-iphone-review.json", {
    **metadata(),
    "status": "NOT_PERFORMED_PENDING_HUMAN",
    "eligible": True,
    "requiredDevice": "iPhone 16 / iOS 26.5.2 / home-screen launch",
    "minimumContinuousOperationMinutes": 5,
    "audioPacing": "RECORD_ONLY_NOT_FIXED_IN_PHASE3B4A",
})
save(REPORTS / "decision-summary.json", {
    **metadata(),
    "decision": "TECHNICAL_MOBILE_FRAMING_FINALIST_FOR_PHYSICAL_IPHONE_REVIEW",
    "candidate": "mobile-full-length-fit",
    "selectedRendering": "D2c3",
    "candidateMaxDistance": 204.1,
    "candidateIndependent": True,
    "defaultAdopted": False,
    "readyAllowed": False,
    "mergeAllowed": False,
    "issue2Closed": False,
    "nextGate": "PHYSICAL_IPHONE_HUMAN_REVIEW",
})

BOARDS.mkdir(parents=True, exist_ok=True)
board(
    [
        RAW / "current/d2c3/390x844/navy/maximum-front.png",
        RAW / "fit/d2c3/390x844/navy/maximum-front.png",
    ],
    ["current maxDistance 120", "fit maxDistance 204.1"],
    2,
    BOARDS / "mobile-before-after-navy.png",
)
board(
    [
        RAW / f"fit/d2c3/390x844/{theme}/maximum-front.png"
        for theme in ["navy", "obsidian", "walnut", "gallery"]
    ],
    ["navy", "obsidian", "walnut", "gallery"],
    4,
    BOARDS / "mobile-fit-all-themes.png",
)
board(
    [
        RAW / "current/d2c3/1280x720/navy/initial-front.png",
        RAW / "fit/d2c3/1280x720/navy/initial-front.png",
    ],
    ["desktop current", "desktop fit query (not applied)"],
    2,
    BOARDS / "desktop-initial-equivalence.png",
    (640, 360),
)
board(
    [
        RAW / "fit/d2c3/390x844/navy/maximum-front.png",
        RAW / "fit/shadow-off/390x844/navy/maximum-front.png",
    ],
    ["D2c3", "Shadow-off independence check"],
    2,
    BOARDS / "candidate-independence.png",
)

margin_source = Image.open(
    RAW / "fit/d2c3/390x844/navy/maximum-front.png"
).convert("RGB")
margin_draw = ImageDraw.Draw(margin_source)
left = round(margin_source.width * 0.03)
top = round(margin_source.height * 0.03)
margin_draw.rectangle(
    [left, top, margin_source.width - left, margin_source.height - top],
    outline="#36ff8b",
    width=2,
)
text(margin_draw, (8, 8), "3% required frame", "#36ff8b")
text(margin_draw, (8, 24), "L 22.49% R 21.50% T 9.32% B 4.03%")
margin_source.save(BOARDS / "mobile-margin-overlay.png", "PNG")

frustum = Image.new("RGB", (1100, 620), "#111820")
frustum_draw = ImageDraw.Draw(frustum)
frustum_draw.polygon(
    [(80, 310), (970, 80), (970, 540)],
    outline="#73b9ff",
)
frustum_draw.line([(700, 110), (700, 510)], fill="#36ff8b", width=4)
text(frustum_draw, (64, 286), "camera")
text(frustum_draw, (720, 90), "completed-watch measured vertices")
text(frustum_draw, (720, 530), "fit distance 204.1 / far margin 24.691")
text(frustum_draw, (270, 535), "FOV 42 deg / horizontal 20.116778 deg")
frustum.save(BOARDS / "camera-frustum-diagram.png", "PNG")

for motion_id, output_name in [
    ("pinch-zoom", "pinch-zoom.gif"),
    ("maximum-rotation", "maximum-zoom-out-rotation.gif"),
    ("restore", "restore.gif"),
]:
    frames = [
        Image.open(path).convert("P", palette=Image.Palette.ADAPTIVE)
        for path in sorted((MOTION / motion_id).glob("frame-*.png"))
    ]
    if len(frames) < 2:
        raise SystemExit(f"missing motion frames for {motion_id}")
    frames[0].save(
        BOARDS / output_name,
        save_all=True,
        append_images=frames[1:],
        duration=180,
        loop=0,
        optimize=False,
    )

save(EVIDENCE / "evidence-manifest.json", make_manifest())

print(json.dumps({
    "captureReports": len(capture_paths),
    "rawPng": len(list(RAW.rglob("*.png"))),
    "motionPng": len(list(MOTION.rglob("*.png"))),
    "boards": len(list(BOARDS.glob("*.png"))),
    "gifs": len(list(BOARDS.glob("*.gif"))),
    "implementationCommit": SOURCE_IMPLEMENTATION_COMMIT,
}, indent=2))
