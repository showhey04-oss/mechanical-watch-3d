#!/usr/bin/env python3
"""Build deterministic comparison images and metrics for Issue #2 Phase 1."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/issue2-rendering-quality-phase1"
OUTPUT = EVIDENCE / "comparisons"
OUTPUT.mkdir(parents=True, exist_ok=True)


def font(size: int) -> ImageFont.ImageFont:
    try:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


TITLE_FONT = font(26)
LABEL_FONT = font(20)


def labeled(path: Path, label: str, width: int | None = None) -> Image.Image:
    image = Image.open(path).convert("RGB")
    if width and image.width != width:
        height = round(image.height * width / image.width)
        image = image.resize((width, height), Image.Resampling.LANCZOS)
    bar = 40
    canvas = Image.new("RGB", (image.width, image.height + bar), "#10141b")
    canvas.paste(image, (0, bar))
    draw = ImageDraw.Draw(canvas)
    draw.text((12, 8), label, font=LABEL_FONT, fill="#f2f5f9")
    return canvas


def grid(title: str, rows: list[list[tuple[Path, str]]], target: Path, width: int | None = None) -> None:
    rendered = [[labeled(path, label, width) for path, label in row] for row in rows]
    column_widths = [max(row[index].width for row in rendered if index < len(row)) for index in range(max(map(len, rendered)))]
    row_heights = [max(image.height for image in row) for row in rendered]
    title_height = 54
    canvas = Image.new("RGB", (sum(column_widths), title_height + sum(row_heights)), "#080b10")
    draw = ImageDraw.Draw(canvas)
    draw.text((14, 12), title, font=TITLE_FONT, fill="#f2f5f9")
    y = title_height
    for row_index, row in enumerate(rendered):
        x = 0
        for column_index, image in enumerate(row):
            canvas.paste(image, (x, y))
            x += column_widths[column_index]
        y += row_heights[row_index]
    canvas.save(target, optimize=True)


def animation(paths: list[Path], labels: list[str], target: Path, width: int | None = None) -> None:
    frames = [labeled(path, label, width) for path, label in zip(paths, labels, strict=True)]
    frames[0].save(target, save_all=True, append_images=frames[1:], duration=650, loop=0, optimize=False)


def mean_luminance(path: Path) -> float:
    image = Image.open(path).convert("RGB")
    return sum(ImageStat.Stat(image).mean) / (3 * 255)


def diff_metrics(left: Path, right: Path) -> dict[str, float]:
    first = Image.open(left).convert("RGB")
    second = Image.open(right).convert("RGB")
    difference = ImageChops.difference(first, second)
    channels = difference.tobytes()
    values = sorted(sum(channels[index:index + 3]) / (3 * 255) for index in range(0, len(channels), 3))
    return {
        "mean": sum(values) / len(values),
        "p95": values[round((len(values) - 1) * 0.95)],
        "max": values[-1],
    }


def transparency_path(candidate: str, viewport: str, view: str, opacity: int) -> Path:
    return EVIDENCE / candidate / "transparency" / viewport / view / f"opacity-{opacity:03d}.jpg"


baseline = "baseline"
shadow = "candidate-a-shadow"
transparent = "candidate-b-transparency"
lighting = "candidate-c-lighting"

for viewport, cell_width in (("1280x720", 640), ("390x844", 300)):
    shadow_rows: list[list[tuple[Path, str]]] = []
    for view in ("front", "back", "oblique"):
        shadow_rows.append([
            (transparency_path(baseline, viewport, view, 16), f"Baseline | {view} | 16%"),
            (transparency_path(shadow, viewport, view, 16), f"Candidate A | {view} | 16%"),
        ])
    grid(
        f"Shadow Candidate A - identical capture conditions - {viewport}",
        shadow_rows,
        OUTPUT / f"shadow-candidate-a-before-after-{viewport}.png",
        cell_width,
    )

    transition_rows = []
    for candidate, label in ((baseline, "Baseline"), (transparent, "Candidate B")):
        transition_rows.append([
            (transparency_path(candidate, viewport, "front", opacity), f"{label} | {opacity}%")
            for opacity in (100, 99, 55, 54)
        ])
    grid(
        f"Transparency state boundaries - front - {viewport}",
        transition_rows,
        OUTPUT / f"transparency-candidate-b-boundaries-{viewport}.png",
        320 if viewport == "1280x720" else 195,
    )

    opacity_values = (100, 99, 75, 56, 55, 54, 53, 50, 25, 16, 8)
    for candidate, label in ((baseline, "Baseline"), (transparent, "Candidate B")):
        animation(
            [transparency_path(candidate, viewport, "front", opacity) for opacity in opacity_values],
            [f"{label} | front | opacity {opacity}% | {viewport}" for opacity in opacity_values],
            OUTPUT / f"transparency-{candidate}-front-{viewport}.gif",
            640 if viewport == "1280x720" else 300,
        )

for viewport, cell_width in (("1280x720", 640), ("390x844", 300)):
    lighting_rows = []
    for candidate, label in ((baseline, "Baseline"), (lighting, "Candidate C (fill 0.02)")):
        lighting_rows.append([
            (EVIDENCE / candidate / "lighting" / viewport / "navy" / f"{view}.jpg", f"{label} | {view}")
            for view in ("front", "back", "side")
        ])
    grid(
        f"Lighting Candidate C - navy - identical conditions - {viewport}",
        lighting_rows,
        OUTPUT / f"lighting-candidate-c-before-after-{viewport}.png",
        cell_width if viewport == "390x844" else 426,
    )
    animation(
        [EVIDENCE / lighting / "lighting" / viewport / "navy" / f"{view}.jpg" for view in ("front", "back", "side")],
        [f"Candidate C | navy | {view} | {viewport}" for view in ("front", "back", "side")],
        OUTPUT / f"lighting-candidate-c-views-{viewport}.gif",
        640 if viewport == "1280x720" else 300,
    )

report: dict[str, object] = {
    "schemaVersion": 1,
    "capturePolicy": "identical browser JPEG capture inputs; RGB absolute pixel difference; raw framebuffer diagnostics remain authoritative for threshold continuity",
    "candidateA": {},
    "candidateB": {},
    "candidateC": {},
}
for viewport in ("1280x720", "390x844"):
    report["candidateA"][viewport] = {
        view: diff_metrics(
            transparency_path(baseline, viewport, view, 16),
            transparency_path(shadow, viewport, view, 16),
        )
        for view in ("front", "back", "oblique")
    }
    report["candidateB"][viewport] = {
        f"baseline-{left}-{right}": diff_metrics(
            transparency_path(baseline, viewport, "front", left),
            transparency_path(baseline, viewport, "front", right),
        )
        for left, right in ((100, 99), (55, 54), (54, 53))
    } | {
        f"candidate-{left}-{right}": diff_metrics(
            transparency_path(transparent, viewport, "front", left),
            transparency_path(transparent, viewport, "front", right),
        )
        for left, right in ((100, 99), (55, 54), (54, 53))
    }
    report["candidateC"][viewport] = {
        view: {
            "baselineMeanLuminance": mean_luminance(EVIDENCE / baseline / "lighting" / viewport / "navy" / f"{view}.jpg"),
            "candidateMeanLuminance": mean_luminance(EVIDENCE / lighting / "lighting" / viewport / "navy" / f"{view}.jpg"),
            "pixelDifference": diff_metrics(
                EVIDENCE / baseline / "lighting" / viewport / "navy" / f"{view}.jpg",
                EVIDENCE / lighting / "lighting" / viewport / "navy" / f"{view}.jpg",
            ),
        }
        for view in ("front", "back", "side")
    }

(OUTPUT / "comparison-report.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")


def performance_summary(candidate: str, viewport: str, scenario: str) -> dict[str, object]:
    source = EVIDENCE / candidate / "performance" / viewport / f"{scenario}.json"
    result = json.loads(source.read_text(encoding="utf-8"))
    pacing = result["report"]["pacing"]
    return {
        "status": result["status"],
        "averageFps": pacing["averageFps"],
        "p50Ms": pacing["p50"],
        "p95Ms": pacing["p95"],
        "p99Ms": pacing["p99"],
        "over33Count": pacing["over33"],
        "over50Count": pacing["over50"],
        "callbackCount": pacing["callbackCount"],
        "longtaskCount": pacing["longtaskCount"],
        "renderPixelRatio": pacing["renderPixelRatio"],
    }


performance_candidates = (baseline, shadow, transparent, lighting)
performance_viewports = ("1280x720", "390x844")
performance_scenarios = ("pointer-rotate", "wheel-zoom", "opacity-idle")
performance_report = {
    "schemaVersion": 1,
    "durationMsRequested": 10000,
    "thresholds": {
        "desktop": {"minimumAverageFps": 55, "maximumP50Ms": 18, "maximumP95Ms": 25, "maximumP99Ms": 40},
        "mobile": {"minimumAverageFps": 45, "maximumP95Ms": 33.3, "maximumOver50Ratio": 0.02},
    },
    "results": {
        candidate: {
            viewport: {
                scenario: performance_summary(candidate, viewport, scenario)
                for scenario in performance_scenarios
            }
            for viewport in performance_viewports
        }
        for candidate in performance_candidates
    },
}
all_performance_rows = [
    row
    for candidate in performance_report["results"].values()
    for viewport in candidate.values()
    for row in viewport.values()
]
performance_report["worstObserved"] = {
    "minimumAverageFps": min(row["averageFps"] for row in all_performance_rows),
    "maximumP50Ms": max(row["p50Ms"] for row in all_performance_rows),
    "maximumP95Ms": max(row["p95Ms"] for row in all_performance_rows),
    "maximumP99Ms": max(row["p99Ms"] for row in all_performance_rows),
    "totalOver33Count": sum(row["over33Count"] for row in all_performance_rows),
    "totalOver50Count": sum(row["over50Count"] for row in all_performance_rows),
    "totalLongtaskCount": sum(row["longtaskCount"] for row in all_performance_rows),
}
performance_dir = EVIDENCE / "performance"
performance_dir.mkdir(parents=True, exist_ok=True)
(performance_dir / "summary.json").write_text(json.dumps(performance_report, indent=2) + "\n", encoding="utf-8")


def compact_browser_entries(value: object) -> None:
    if isinstance(value, dict):
        details = value.pop("details", None)
        if isinstance(details, dict):
            value["checks"] = [
                {"name": check.get("name"), "ok": check.get("ok")}
                for check in details.get("checks", [])
            ]
            value["measurementKeys"] = sorted(details.get("measurements", {}).keys())
        for child in value.values():
            compact_browser_entries(child)
    elif isinstance(value, list):
        for child in value:
            compact_browser_entries(child)


browser_report_path = EVIDENCE / "browser-report.json"
if browser_report_path.exists():
    browser_report = json.loads(browser_report_path.read_text(encoding="utf-8"))
    compact_browser_entries(browser_report)
    browser_report_path.write_text(json.dumps(browser_report, indent=2) + "\n", encoding="utf-8")

manifest_path = EVIDENCE / "evidence-manifest.json"
manifest_entries = []
for evidence_file in sorted(path for path in EVIDENCE.rglob("*") if path.is_file() and path != manifest_path):
    payload = evidence_file.read_bytes()
    manifest_entries.append({
        "path": evidence_file.relative_to(EVIDENCE).as_posix(),
        "bytes": len(payload),
        "sha256": hashlib.sha256(payload).hexdigest(),
    })
manifest_path.write_text(
    json.dumps({"schemaVersion": 1, "fileCount": len(manifest_entries), "files": manifest_entries}, indent=2) + "\n",
    encoding="utf-8",
)
