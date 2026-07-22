#!/usr/bin/env python3
"""Build and verify the Issue #2 Phase 2A evidence package.

Raw browser screenshots and machine reports are written to /tmp by the in-app
browser harness. This script converts the screenshots to review-sized JPEGs,
builds fixed-condition comparison boards/crops, and produces a hash manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import mimetypes
import shutil
from itertools import product
from pathlib import Path
from statistics import mean
from urllib.parse import parse_qs, urlparse
from xml.etree import ElementTree

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
TEMP = Path("/tmp/issue2-rendering-quality-phase2a")
EVIDENCE = ROOT / "docs/evidence/issue2-rendering-quality-phase2a"
CAPTURES = EVIDENCE / "captures"
COMPARISONS = EVIDENCE / "comparisons"
CROPS = EVIDENCE / "crops"
MANIFEST = EVIDENCE / "evidence-manifest.json"
REPORTS = EVIDENCE / "reports"

CANDIDATES = ("baseline", "c", "d1", "d2", "d3")
THEMES = ("navy", "obsidian", "walnut", "gallery")
VIEWS = ("front", "back", "side", "winding", "motion-works")
VIEWPORTS = ("1280x720", "1440x900", "390x844", "393x852")
CANDIDATE_QUERIES = {
    "baseline": "baseline",
    "c": "lighting",
    "d1": "studio-d1",
    "d2": "studio-d2",
    "d3": "studio-d3",
}
VIEW_CAMERAS = {
    "front": "reset",
    "back": "movementBack",
    "side": "side",
    "winding": "winding",
    "motion-works": "dial",
}
REQUIRED_REPORTS = (
    REPORTS / "browser-report.json",
    REPORTS / "lighting/all-lights.json",
    REPORTS / "point-light/diagnostics.json",
    REPORTS / "framebuffer/summary.json",
    REPORTS / "performance/summary.json",
)
REQUIRED_STATIC_ARTIFACTS = (
    EVIDENCE / "README.md",
    EVIDENCE / "studio-lighting-layout.svg",
)

CROP_SPECS = (
    ("highlight", "gallery", "side", (0.42, 0.12, 0.78, 0.50)),
    ("brass", "navy", "winding", (0.30, 0.24, 0.68, 0.68)),
    ("steel", "gallery", "back", (0.27, 0.16, 0.73, 0.64)),
    ("ruby", "obsidian", "back", (0.25, 0.24, 0.75, 0.76)),
    ("dial", "navy", "front", (0.27, 0.12, 0.76, 0.58)),
    ("hands", "navy", "front", (0.36, 0.25, 0.68, 0.61)),
    ("hand-dial-contact", "navy", "front", (0.40, 0.33, 0.63, 0.60)),
    ("gear-bridge-contact", "navy", "back", (0.28, 0.26, 0.74, 0.74)),
)


def capture_name(candidate: str, theme: str, view: str, viewport: str, suffix: str) -> str:
    return f"{candidate}-{theme}-{view}-{viewport}.{suffix}"


def load_capture_matrix() -> dict:
    path = TEMP / "capture-matrix.json"
    if not path.exists():
        raise SystemExit(f"missing browser capture matrix: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def label_bar(image: Image.Image, label: str, width: int) -> Image.Image:
    try:
        font = ImageFont.load_default(size=18)
    except TypeError:
        font = ImageFont.load_default()
    bar_height = 40
    canvas = Image.new("RGB", (width, image.height + bar_height), "#11151b")
    canvas.paste(image, (0, bar_height))
    draw = ImageDraw.Draw(canvas)
    draw.text((10, 10), label, fill="#f5f7fa", font=font)
    return canvas


def scaled(image: Image.Image, max_width: int) -> Image.Image:
    if image.width <= max_width:
        return image.copy()
    height = round(image.height * max_width / image.width)
    return image.resize((max_width, height), Image.Resampling.LANCZOS)


def vectors_close(left: tuple, right: tuple, tolerance: float = 2e-4) -> bool:
    return len(left) == len(right) and all(abs(a - b) <= tolerance for a, b in zip(left, right))


def make_board(images: list[tuple[str, Image.Image]], output: Path, max_width: int = 420) -> None:
    cells = [label_bar(scaled(image, max_width), label, min(image.width, max_width)) for label, image in images]
    height = max(cell.height for cell in cells)
    width = sum(cell.width for cell in cells)
    board = Image.new("RGB", (width, height), "#0d1015")
    x = 0
    for cell in cells:
        board.paste(cell, (x, 0))
        x += cell.width
    output.parent.mkdir(parents=True, exist_ok=True)
    board.save(output, "JPEG", quality=88, optimize=True, progressive=True)


def convert_captures(matrix: dict) -> list[dict]:
    entries = matrix.get("entries", [])
    expected = set(product(CANDIDATES, THEMES, VIEWS, VIEWPORTS))
    actual = {(entry["candidate"], entry["theme"], entry["view"], entry["viewport"]) for entry in entries}
    if len(entries) != 400 or actual != expected:
        missing = sorted(expected - actual)[:10]
        duplicate_count = len(entries) - len(actual)
        raise SystemExit(f"capture matrix mismatch: entries={len(entries)} unique={len(actual)} duplicates={duplicate_count} missing={missing}")

    conditions = matrix.get("conditions", {})
    required_conditions = {
        "time": "10:10:30",
        "paused": True,
        "structuralOpacity": 1,
        "exploded": False,
        "split": False,
        "panel": "closed",
    }
    for key, expected_value in required_conditions.items():
        if conditions.get(key) != expected_value:
            raise SystemExit(f"capture condition mismatch {key}: {conditions.get(key)!r}, expected {expected_value!r}")

    converted = []
    raw_paths: set[str] = set()
    urls: set[str] = set()
    comparison_conditions: dict[tuple[str, str, str], tuple] = {}
    for entry in entries:
        candidate, theme, view, viewport = (entry[key] for key in ("candidate", "theme", "view", "viewport"))
        expected_query = CANDIDATE_QUERIES[candidate]
        expected_camera = VIEW_CAMERAS[view]
        if entry.get("queryCandidate") != expected_query or entry.get("cameraPreset") != expected_camera:
            raise SystemExit(f"candidate/camera mapping mismatch: {candidate}/{view}/{viewport}")
        raw_path = entry["rawPath"]
        if raw_path in raw_paths or Path(raw_path).is_absolute() or ".." in Path(raw_path).parts:
            raise SystemExit(f"unsafe or duplicate rawPath: {raw_path}")
        raw_paths.add(raw_path)
        source = (TEMP / raw_path).resolve()
        try:
            source.relative_to(TEMP.resolve())
        except ValueError as error:
            raise SystemExit(f"rawPath escapes temp root: {raw_path}") from error
        if not source.exists():
            raise SystemExit(f"missing raw screenshot: {source}")

        url = entry.get("url", "")
        if url in urls:
            raise SystemExit(f"duplicate capture URL: {url}")
        urls.add(url)
        query = parse_qs(urlparse(url).query)
        expected_query_values = {
            "issue2Candidate": expected_query,
            "theme": theme,
            "camera": expected_camera,
            "time": "10:10:30",
            "paused": "1",
            "opacity": "1",
            "panel": "collapsed",
            "issue2Report": "framebuffer",
        }
        for key, expected_value in expected_query_values.items():
            if query.get(key) != [expected_value]:
                raise SystemExit(f"capture URL mismatch {key}: {candidate}/{theme}/{view}/{viewport}")

        report = entry.get("report", {})
        report_viewport = report.get("viewport", {})
        if (
            report.get("candidate") != expected_query
            or report.get("theme") != theme
            or report.get("view") != expected_camera
            or report.get("camera", {}).get("preset") != expected_camera
            or report_viewport.get("width") != entry.get("width")
            or report_viewport.get("height") != entry.get("height")
            or report_viewport.get("panelOpen") is not False
            or report_viewport.get("panelCollapsed") is not (entry.get("width", 0) >= 900)
            or report.get("statistics", {}).get("method") != "model-silhouette-mask-pass"
        ):
            raise SystemExit(f"framebuffer report metadata mismatch: {candidate}/{theme}/{view}/{viewport}")
        condition_key = (theme, view, viewport)
        condition_value = {
            "devicePixelRatio": report_viewport.get("devicePixelRatio"),
            "renderPixelRatio": report_viewport.get("renderPixelRatio"),
            "position": tuple(report.get("camera", {}).get("position", [])),
            "quaternion": tuple(report.get("camera", {}).get("quaternion", [])),
            "target": tuple(report.get("camera", {}).get("target", [])),
        }
        if condition_key in comparison_conditions:
            reference = comparison_conditions[condition_key]
            same_dpr = reference["devicePixelRatio"] == condition_value["devicePixelRatio"]
            same_render_dpr = reference["renderPixelRatio"] == condition_value["renderPixelRatio"]
            same_camera = all(vectors_close(reference[key], condition_value[key]) for key in ("position", "quaternion", "target"))
            if not (same_dpr and same_render_dpr and same_camera):
                raise SystemExit(f"DPR or camera differs across candidates: {condition_key}")
        comparison_conditions[condition_key] = condition_value

        output = CAPTURES / candidate / viewport / theme / capture_name(candidate, theme, view, viewport, "jpg")
        output.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            expected_size = tuple(int(value) for value in viewport.split("x"))
            if image.size != expected_size:
                raise SystemExit(f"unexpected screenshot size {source}: {image.size}, expected {expected_size}")
            image.convert("RGB").save(output, "JPEG", quality=92, optimize=True, progressive=True)
        committed_entry = {key: value for key, value in entry.items() if key != "rawPath"}
        converted.append({**committed_entry, "image": str(output.relative_to(ROOT)), "rawSource": "temporary-browser-png-not-committed"})
    return converted


def build_comparisons() -> None:
    for viewport, theme, view in product(VIEWPORTS, THEMES, VIEWS):
        images = []
        for candidate in CANDIDATES:
            path = CAPTURES / candidate / viewport / theme / capture_name(candidate, theme, view, viewport, "jpg")
            images.append((candidate.upper(), Image.open(path).convert("RGB")))
        output = COMPARISONS / viewport / theme / f"five-candidate-{theme}-{view}-{viewport}.jpg"
        make_board(images, output)
        for _, image in images:
            image.close()


def build_crops(matrix: dict) -> None:
    entry_map = {
        (entry["candidate"], entry["theme"], entry["view"], entry["viewport"]): entry
        for entry in matrix["entries"]
    }
    for viewport, (name, theme, view, box) in product(VIEWPORTS, CROP_SPECS):
        images = []
        for candidate in CANDIDATES:
            path = TEMP / entry_map[(candidate, theme, view, viewport)]["rawPath"]
            with Image.open(path) as image:
                left, top, right, bottom = (
                    round(box[0] * image.width),
                    round(box[1] * image.height),
                    round(box[2] * image.width),
                    round(box[3] * image.height),
                )
                crop = image.convert("RGB").crop((left, top, right, bottom))
            images.append((candidate.upper(), crop))
        output = CROPS / viewport / f"five-candidate-{name}-{theme}-{view}-{viewport}.jpg"
        make_board(images, output, max_width=300)
        for _, image in images:
            image.close()


def copy_machine_reports() -> None:
    source = TEMP / "reports"
    if not source.exists():
        raise SystemExit(f"missing machine report directory: {source}")
    shutil.copytree(source, REPORTS, dirs_exist_ok=True)


def write_framebuffer_summary(matrix: dict) -> None:
    rows = []
    for entry in matrix["entries"]:
        report = entry["report"]
        viewport = report["viewport"]
        rows.append({
            "candidate": entry["candidate"],
            "queryCandidate": entry["queryCandidate"],
            "theme": entry["theme"],
            "view": entry["view"],
            "viewport": entry["viewport"],
            "devicePixelRatio": viewport["devicePixelRatio"],
            "renderPixelRatio": viewport["renderPixelRatio"],
            **report["statistics"],
        })
    aggregates = {}
    for candidate in CANDIDATES:
        candidate_rows = [row for row in rows if row["candidate"] == candidate]
        aggregates[candidate] = {
            "samples": len(candidate_rows),
            "averageLuminance": mean(row["averageLuminance"] for row in candidate_rows),
            "darkRatio": mean(row["darkRatio"] for row in candidate_rows),
            "clippedRatio": mean(row["clippedRatio"] for row in candidate_rows),
            "maxClippedRatio": max(row["clippedRatio"] for row in candidate_rows),
        }
    output = REPORTS / "framebuffer/summary.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps({"schema": "issue2-phase2a-framebuffer-v1", "rows": rows, "aggregates": aggregates}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def validate_required_reports() -> None:
    for path in REQUIRED_REPORTS:
        if not path.exists():
            raise SystemExit(f"missing required machine report: {path}")
        json.loads(path.read_text(encoding="utf-8"))
    lighting = json.loads((REPORTS / "lighting/all-lights.json").read_text(encoding="utf-8"))
    point = json.loads((REPORTS / "point-light/diagnostics.json").read_text(encoding="utf-8"))
    framebuffer = json.loads((REPORTS / "framebuffer/summary.json").read_text(encoding="utf-8"))
    performance = json.loads((REPORTS / "performance/summary.json").read_text(encoding="utf-8"))
    browser = json.loads((REPORTS / "browser-report.json").read_text(encoding="utf-8"))
    if len(lighting.get("entries", [])) != 5:
        raise SystemExit("all-lights report must contain five candidate entries")
    if len(point.get("entries", [])) != 20:
        raise SystemExit("PointLight report must contain five views at four viewports")
    if len(framebuffer.get("rows", [])) != 400:
        raise SystemExit("framebuffer summary must contain 400 rows")
    if len(performance.get("runs", [])) < 36:
        raise SystemExit("performance summary must contain 30 fixed-matrix runs and six running-D3 shadow-refresh runs")
    if browser.get("node", {}).get("passed") != 33 or len(browser.get("runs", [])) < 45:
        raise SystemExit("browser report is missing the Node result or full regression matrix")


def validate_required_static_artifacts() -> None:
    for path in REQUIRED_STATIC_ARTIFACTS:
        if not path.exists():
            raise SystemExit(f"missing required evidence artifact: {path}")


def file_record(path: Path) -> dict:
    data = path.read_bytes()
    mime = mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    record = {
        "path": str(path.relative_to(ROOT)),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "mime": mime,
    }
    if path.suffix.lower() in {".jpg", ".jpeg", ".png"}:
        with Image.open(path) as image:
            record["dimensions"] = list(image.size)
    return record


def write_manifest() -> dict:
    files = sorted(path for path in EVIDENCE.rglob("*") if path.is_file() and path != MANIFEST)
    manifest = {
        "schema": "issue2-phase2a-evidence-v1",
        "root": str(EVIDENCE.relative_to(ROOT)),
        "expectedCaptureCount": 400,
        "expectedComparisonCount": 80,
        "expectedCropCount": 32,
        "fileCount": len(files),
        "files": [file_record(path) for path in files],
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def check_manifest() -> None:
    if not MANIFEST.exists():
        raise SystemExit(f"missing manifest: {MANIFEST}")
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("schema") != "issue2-phase2a-evidence-v1" or manifest.get("root") != str(EVIDENCE.relative_to(ROOT)):
        raise SystemExit("unexpected evidence manifest schema or root")
    records = manifest.get("files", [])
    record_paths = [record.get("path") for record in records]
    if manifest.get("fileCount") != len(records) or len(record_paths) != len(set(record_paths)):
        raise SystemExit("manifest fileCount mismatch or duplicate paths")
    actual_paths = {
        str(path.relative_to(ROOT)) for path in EVIDENCE.rglob("*") if path.is_file() and path != MANIFEST
    }
    if set(record_paths) != actual_paths:
        missing = sorted(actual_paths - set(record_paths))[:10]
        stale = sorted(set(record_paths) - actual_paths)[:10]
        raise SystemExit(f"manifest is not closed-world: unlisted={missing} stale={stale}")
    for record in records:
        path = ROOT / record["path"]
        if not path.exists():
            raise SystemExit(f"manifest path missing: {path}")
        current = file_record(path)
        for key in ("bytes", "sha256", "mime", "dimensions"):
            if key not in record and key not in current:
                continue
            if current[key] != record[key]:
                raise SystemExit(f"manifest mismatch {key}: {path}")
        if path.suffix.lower() in {".jpg", ".jpeg"} and path.read_bytes()[:2] != b"\xff\xd8":
            raise SystemExit(f"JPEG magic mismatch: {path}")
        if path.suffix.lower() == ".json":
            json.loads(path.read_text(encoding="utf-8"))
        if path.suffix.lower() == ".svg":
            ElementTree.parse(path)

    captures = sorted(CAPTURES.rglob("*.jpg"))
    if len(captures) != 400:
        raise SystemExit(f"expected 400 master JPEG captures, found {len(captures)}")
    if len(list(COMPARISONS.rglob("*.jpg"))) != 80 or len(list(CROPS.rglob("*.jpg"))) != 32:
        raise SystemExit("expected 80 comparison boards and 32 crop boards")
    matrix_path = EVIDENCE / "capture-matrix.json"
    matrix = json.loads(matrix_path.read_text(encoding="utf-8"))
    if len(matrix.get("entries", [])) != 400:
        raise SystemExit("final capture matrix does not contain 400 entries")
    validate_required_reports()
    validate_required_static_artifacts()
    print(json.dumps({"ok": True, "files": manifest["fileCount"], "captures": len(captures)}, ensure_ascii=False))


def generate() -> None:
    matrix = load_capture_matrix()
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    for generated in (CAPTURES, COMPARISONS, CROPS, REPORTS):
        if generated.exists():
            shutil.rmtree(generated)
    converted = convert_captures(matrix)
    final_matrix = {**matrix, "entries": converted}
    (EVIDENCE / "capture-matrix.json").write_text(
        json.dumps(final_matrix, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    copy_machine_reports()
    write_framebuffer_summary(matrix)
    build_comparisons()
    build_crops(matrix)
    validate_required_reports()
    validate_required_static_artifacts()
    manifest = write_manifest()
    print(json.dumps({"generated": True, "files": manifest["fileCount"], "captures": len(converted)}, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check_manifest()
    else:
        generate()


if __name__ == "__main__":
    main()
