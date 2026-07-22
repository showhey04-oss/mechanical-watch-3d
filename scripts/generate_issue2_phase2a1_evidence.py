#!/usr/bin/env python3
"""Build and audit the Issue #2 Phase 2A.1 zoom-lighting evidence.

The in-app browser capture harness writes viewport-sized JPEG masters and machine reports to
``/tmp/issue2-rendering-quality-phase2a1``.  This script validates the complete
capture matrix before committing review-sized JPEG masters, builds one 3 x 3
candidate/distance board for every viewport/theme/view condition, copies the
machine reports and generated light-layout SVGs, and closes the evidence folder
with a SHA-256 manifest.

Phase 2A remains an immutable historical package.  This script reads and writes
only the Phase 2A.1 temporary and evidence roots declared below.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import mimetypes
import shutil
from collections.abc import Iterable, Mapping, Sequence
from itertools import product
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from xml.etree import ElementTree

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
TEMP = Path("/tmp/issue2-rendering-quality-phase2a1")
EVIDENCE = ROOT / "docs/evidence/issue2-rendering-quality-phase2a1"
CAPTURES = EVIDENCE / "captures"
COMPARISONS = EVIDENCE / "comparisons"
REPORTS = EVIDENCE / "reports"
LIGHT_LAYOUTS = EVIDENCE / "light-layouts"
MATRIX = EVIDENCE / "capture-matrix.json"
MANIFEST = EVIDENCE / "evidence-manifest.json"

CANDIDATES = ("d2", "d2a", "d2b")
DIAGNOSTIC_CANDIDATES = (*CANDIDATES, "d3")
CANDIDATE_QUERIES = {
    "d2": "studio-d2",
    "d2a": "studio-d2a",
    "d2b": "studio-d2b",
}
THEMES = ("navy", "obsidian", "walnut", "gallery")
VIEWS = ("front", "back", "side")
VIEW_CAMERAS = {
    "front": "reset",
    "back": "movementBack",
    "side": "side",
}
VIEWPORTS = ("1280x720", "390x844", "393x852")
DISTANCES = ("near", "initial", "far")
REGIONS = ("dial", "hands", "brassTrain", "steelTrain")

EXPECTED_CAPTURE_COUNT = len(CANDIDATES) * len(VIEWPORTS) * len(THEMES) * len(VIEWS) * len(DISTANCES)
EXPECTED_COMPARISON_COUNT = len(VIEWPORTS) * len(THEMES) * len(VIEWS)
EXPECTED_LIGHT_LAYOUT_COUNT = len(CANDIDATES) * len(VIEWS) * len(DISTANCES)
LUMINANCE_TOLERANCE = 0.15
VECTOR_TOLERANCE = 2e-4

REQUIRED_CONDITIONS = {
    "time": "10:10:30",
    "paused": True,
    "structuralOpacity": 1,
    "exploded": False,
    "split": False,
    "panel": "closed",
}

REQUIRED_REPORTS = (
    REPORTS / "startup/timelines.json",
    REPORTS / "zoom/camera-light-distances.json",
    REPORTS / "zoom/luminance-comparison.json",
    REPORTS / "lighting/layouts.json",
    REPORTS / "browser-report.json",
    REPORTS / "performance/summary.json",
)

REGION_ALIASES = {
    "dial": ("dial", "dialFace", "dial-face"),
    "hands": ("hands", "watchHands", "watch-hands"),
    "brassTrain": ("brassTrain", "brass-train", "brass"),
    "steelTrain": ("steelTrain", "steel-train", "steel"),
}


def fail(message: str) -> None:
    raise SystemExit(message)


def is_number(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


def finite_number(value: object, label: str) -> float:
    if not is_number(value):
        fail(f"{label} must be a finite number, got {value!r}")
    return float(value)


def finite_vector(value: object, length: int, label: str) -> tuple[float, ...]:
    if not isinstance(value, Sequence) or isinstance(value, (str, bytes)) or len(value) != length:
        fail(f"{label} must be a {length}-value vector, got {value!r}")
    return tuple(finite_number(item, f"{label}[{index}]") for index, item in enumerate(value))


def vectors_close(left: Sequence[float], right: Sequence[float], tolerance: float = VECTOR_TOLERANCE) -> bool:
    return len(left) == len(right) and all(abs(float(a) - float(b)) <= tolerance for a, b in zip(left, right))


def nested(mapping: Mapping[str, object], *paths: Sequence[str]) -> object | None:
    for path in paths:
        value: object = mapping
        for key in path:
            if not isinstance(value, Mapping) or key not in value:
                break
            value = value[key]
        else:
            return value
    return None


def expected_capture_keys() -> set[tuple[str, str, str, str, str]]:
    return set(product(CANDIDATES, VIEWPORTS, THEMES, VIEWS, DISTANCES))


def expected_layout_names() -> set[str]:
    return {
        f"{candidate}-{view}-{distance}.svg"
        for candidate, view, distance in product(CANDIDATES, VIEWS, DISTANCES)
    }


def capture_filename(candidate: str, theme: str, view: str, distance: str, viewport: str) -> str:
    return f"{candidate}-{theme}-{view}-{distance}-{viewport}.jpg"


def comparison_filename(theme: str, view: str, viewport: str) -> str:
    return f"d2-zoom-grid-{theme}-{view}-{viewport}.jpg"


def load_json(path: Path, label: str | None = None) -> dict:
    if not path.exists():
        fail(f"missing {label or 'JSON file'}: {path}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        fail(f"invalid JSON in {path}: {error}")
    if not isinstance(value, dict):
        fail(f"{path} must contain a JSON object")
    return value


def load_capture_matrix(path: Path) -> dict:
    matrix = load_json(path, "browser capture matrix")
    entries = matrix.get("entries")
    if not isinstance(entries, list):
        fail(f"capture matrix entries must be an array: {path}")
    return matrix


def validate_conditions(matrix: Mapping[str, object]) -> None:
    conditions = matrix.get("conditions")
    if not isinstance(conditions, Mapping):
        fail("capture matrix must contain a conditions object")
    for key, expected in REQUIRED_CONDITIONS.items():
        actual = conditions.get(key)
        if actual != expected:
            fail(f"capture condition mismatch {key}: {actual!r}, expected {expected!r}")


def normalize_report_candidate(value: object) -> str | None:
    if value in {"d3", "studio-d3"}:
        return "d3"
    if value in CANDIDATES:
        return str(value)
    for candidate, query in CANDIDATE_QUERIES.items():
        if value == query:
            return candidate
    return None


def report_distance_id(report: Mapping[str, object]) -> str | None:
    value = report.get("distanceId", report.get("distance"))
    if isinstance(value, Mapping):
        value = value.get("id", value.get("name"))
    return str(value) if value in DISTANCES else None


def extract_camera(report: Mapping[str, object], label: str) -> dict:
    value = nested(report, ("camera",), ("zoom", "camera"), ("lighting", "camera"))
    if not isinstance(value, Mapping):
        fail(f"{label}.camera is missing")
    position = finite_vector(value.get("position"), 3, f"{label}.camera.position")
    quaternion = finite_vector(value.get("quaternion"), 4, f"{label}.camera.quaternion")
    target = finite_vector(value.get("target"), 3, f"{label}.camera.target")
    distance = finite_number(value.get("distance"), f"{label}.camera.distance")
    if distance <= 0:
        fail(f"{label}.camera.distance must be positive")
    return {
        "position": position,
        "quaternion": quaternion,
        "target": target,
        "distance": distance,
    }


def extract_viewport(report: Mapping[str, object], label: str) -> dict:
    value = nested(report, ("viewport",), ("pipeline", "viewport"), ("zoom", "viewport"))
    if not isinstance(value, Mapping):
        fail(f"{label}.viewport is missing")
    width = int(finite_number(value.get("width"), f"{label}.viewport.width"))
    height = int(finite_number(value.get("height"), f"{label}.viewport.height"))
    device_pixel_ratio = finite_number(value.get("devicePixelRatio"), f"{label}.viewport.devicePixelRatio")
    render_pixel_ratio = finite_number(value.get("renderPixelRatio"), f"{label}.viewport.renderPixelRatio")
    if min(width, height) <= 0 or min(device_pixel_ratio, render_pixel_ratio) <= 0:
        fail(f"{label}.viewport dimensions and DPR values must be positive")
    return {
        "width": width,
        "height": height,
        "devicePixelRatio": device_pixel_ratio,
        "renderPixelRatio": render_pixel_ratio,
    }


def extract_model_center(report: Mapping[str, object], label: str) -> tuple[float, ...]:
    value = nested(
        report,
        ("modelCenter",),
        ("distances", "modelCenter"),
        ("zoom", "modelCenter"),
        ("studio", "modelCenter"),
    )
    return finite_vector(value, 3, f"{label}.modelCenter")


def light_collection(report: Mapping[str, object]) -> object | None:
    return nested(
        report,
        ("rectLights",),
        ("lights", "rectLights"),
        ("studio", "rectLights"),
        ("lighting", "studio", "rectLights"),
        ("zoom", "rectLights"),
    )


def normalize_light(light: Mapping[str, object], label: str) -> dict:
    name = light.get("name")
    if not isinstance(name, str) or not name:
        fail(f"{label}.name must be a non-empty string")
    size_value = light.get("size")
    if size_value is None and is_number(light.get("width")) and is_number(light.get("height")):
        size_value = [light["width"], light["height"]]
    distance_value = light.get("distanceToModel", light.get("modelDistance"))
    if distance_value is None and isinstance(light.get("distances"), Mapping):
        distance_value = light["distances"].get("model")
    parent = light.get("parent")
    if not isinstance(parent, str) or not parent:
        fail(f"{label}.parent must identify the Object3D parent")
    if "camera" in parent.lower():
        fail(f"{label} is camera-parented; RectAreaLight must remain model/world based")
    visible = light.get("visible")
    if not isinstance(visible, bool):
        fail(f"{label}.visible must be a boolean")
    color = light.get("color")
    if not isinstance(color, str) or not color:
        fail(f"{label}.color must be a string")
    result = {
        "name": name,
        "position": finite_vector(light.get("position"), 3, f"{label}.position"),
        "quaternion": finite_vector(light.get("quaternion"), 4, f"{label}.quaternion"),
        "size": finite_vector(size_value, 2, f"{label}.size"),
        "intensity": finite_number(light.get("intensity"), f"{label}.intensity"),
        "color": color.lower(),
        "distanceToModel": finite_number(distance_value, f"{label}.distanceToModel"),
        "parent": parent,
        "visible": visible,
    }
    if min(result["size"]) <= 0 or result["intensity"] < 0 or result["distanceToModel"] <= 0:
        fail(f"{label} has invalid size, intensity, or model distance")
    return result


def extract_rect_lights(report: Mapping[str, object], label: str) -> dict[str, dict]:
    value = light_collection(report)
    if isinstance(value, Mapping):
        lights = list(value.values())
    elif isinstance(value, list):
        lights = value
    else:
        fail(f"{label}.rectLights is missing")
    normalized: dict[str, dict] = {}
    for index, item in enumerate(lights):
        if not isinstance(item, Mapping):
            fail(f"{label}.rectLights[{index}] must be an object")
        light = normalize_light(item, f"{label}.rectLights[{index}]")
        if light["name"] in normalized:
            fail(f"{label} contains duplicate RectAreaLight {light['name']!r}")
        normalized[light["name"]] = light
    if len(normalized) != 2:
        fail(f"{label} must describe exactly two RectAreaLights, found {len(normalized)}")
    return dict(sorted(normalized.items()))


def extract_statistics(report: Mapping[str, object], label: str) -> dict:
    value = nested(
        report,
        ("statistics",),
        ("framebuffer", "statistics"),
        ("phase2Framebuffer", "statistics"),
        ("zoom", "statistics"),
    )
    if not isinstance(value, Mapping):
        fail(f"{label}.statistics is missing")
    average = finite_number(value.get("averageLuminance"), f"{label}.statistics.averageLuminance")
    dark = finite_number(value.get("darkRatio"), f"{label}.statistics.darkRatio")
    clipped = finite_number(value.get("clippedRatio"), f"{label}.statistics.clippedRatio")
    samples = int(finite_number(value.get("sampleCount"), f"{label}.statistics.sampleCount"))
    if average < 0 or not 0 <= dark <= 1 or not 0 <= clipped <= 1 or samples <= 0:
        fail(f"{label}.statistics contains an invalid luminance value or empty mask")
    return {
        "averageLuminance": average,
        "darkRatio": dark,
        "clippedRatio": clipped,
        "sampleCount": samples,
    }


def region_collection(report: Mapping[str, object]) -> object | None:
    return nested(
        report,
        ("regions",),
        ("luminance", "regions"),
        ("zoom", "regions"),
        ("regionalLuminance",),
    )


def extract_regions(report: Mapping[str, object], label: str) -> dict[str, dict]:
    value = region_collection(report)
    if isinstance(value, list):
        by_name = {
            str(item.get("name", item.get("id"))): item
            for item in value
            if isinstance(item, Mapping) and item.get("name", item.get("id")) is not None
        }
    elif isinstance(value, Mapping):
        by_name = dict(value)
    else:
        fail(f"{label}.regions is missing")
    normalized: dict[str, dict] = {}
    for region in REGIONS:
        item = next((by_name[alias] for alias in REGION_ALIASES[region] if alias in by_name), None)
        if not isinstance(item, Mapping):
            fail(f"{label}.regions is missing required object-mask region {region!r}")
        average = item.get("averageLuminance", item.get("meanLuminance", item.get("average")))
        sample_count = item.get("sampleCount", item.get("samples"))
        normalized[region] = {
            "averageLuminance": finite_number(average, f"{label}.regions.{region}.averageLuminance"),
            "sampleCount": int(finite_number(sample_count, f"{label}.regions.{region}.sampleCount")),
        }
        if normalized[region]["averageLuminance"] < 0 or normalized[region]["sampleCount"] <= 0:
            fail(f"{label}.regions.{region} has an invalid luminance value or empty mask")
        for field in ("darkRatio", "clippedRatio"):
            if field in item:
                ratio = finite_number(item[field], f"{label}.regions.{region}.{field}")
                if not 0 <= ratio <= 1:
                    fail(f"{label}.regions.{region}.{field} must be between zero and one")
                normalized[region][field] = ratio
    return normalized


def validate_url(entry: Mapping[str, object], conditions: Mapping[str, object], label: str) -> None:
    url = entry.get("url")
    if not isinstance(url, str) or not url:
        fail(f"{label}.url must be a non-empty direct-launch URL")
    query = parse_qs(urlparse(url).query)
    candidate = str(entry["candidate"])
    distance_parameter = str(conditions.get("distanceQueryParameter", "issue2Distance"))
    report_mode = str(conditions.get("reportMode", "zoom"))
    expected = {
        "issue2Candidate": CANDIDATE_QUERIES[candidate],
        "theme": str(entry["theme"]),
        "camera": VIEW_CAMERAS[str(entry["view"])],
        distance_parameter: str(entry["distance"]),
        "time": str(conditions["time"]),
        "paused": "1",
        "opacity": "1",
        "panel": "collapsed",
        "issue2Report": report_mode,
    }
    for key, expected_value in expected.items():
        if query.get(key) != [expected_value]:
            fail(f"{label}.url query mismatch for {key}: {query.get(key)!r}, expected {[expected_value]!r}")


def validate_report_metadata(entry: Mapping[str, object], report: Mapping[str, object], label: str) -> None:
    candidate = str(entry["candidate"])
    if normalize_report_candidate(report.get("candidate", report.get("resolvedCandidate"))) != candidate:
        fail(f"{label}.report candidate does not match {candidate}")
    if report.get("theme") != entry["theme"]:
        fail(f"{label}.report theme does not match {entry['theme']}")
    report_view = report.get("view", report.get("cameraPreset"))
    if report_view not in {entry["view"], VIEW_CAMERAS[str(entry["view"])]}:
        fail(f"{label}.report view does not match {entry['view']}")
    if report_distance_id(report) != entry["distance"]:
        fail(f"{label}.report distance does not match {entry['distance']}")


def normalize_entries(matrix: Mapping[str, object], *, require_raw: bool) -> dict[tuple[str, str, str, str, str], dict]:
    validate_conditions(matrix)
    conditions = matrix["conditions"]
    assert isinstance(conditions, Mapping)
    entries = matrix.get("entries")
    if not isinstance(entries, list):
        fail("capture matrix entries must be an array")
    expected = expected_capture_keys()
    actual: set[tuple[str, str, str, str, str]] = set()
    normalized: dict[tuple[str, str, str, str, str], dict] = {}
    raw_paths: set[str] = set()
    image_paths: set[str] = set()
    urls: set[str] = set()

    for index, entry in enumerate(entries):
        label = f"entries[{index}]"
        if not isinstance(entry, Mapping):
            fail(f"{label} must be an object")
        try:
            key = tuple(str(entry[field]) for field in ("candidate", "viewport", "theme", "view", "distance"))
        except KeyError as error:
            fail(f"{label} is missing field {error.args[0]!r}")
        if key not in expected:
            fail(f"{label} has an unexpected capture key: {key}")
        if key in actual:
            fail(f"duplicate capture condition: {key}")
        actual.add(key)
        candidate, viewport_name, theme, view, distance = key
        if entry.get("queryCandidate") != CANDIDATE_QUERIES[candidate]:
            fail(f"{label}.queryCandidate does not match {candidate}")
        if entry.get("cameraPreset") != VIEW_CAMERAS[view]:
            fail(f"{label}.cameraPreset does not match {view}")
        expected_width, expected_height = (int(value) for value in viewport_name.split("x"))
        if entry.get("width") != expected_width or entry.get("height") != expected_height:
            fail(f"{label} dimensions do not match viewport label {viewport_name}")
        url = entry.get("url")
        if url in urls:
            fail(f"duplicate capture URL: {url}")
        urls.add(str(url))
        validate_url(entry, conditions, label)

        report = entry.get("report")
        if not isinstance(report, Mapping):
            fail(f"{label}.report must be an object")
        validate_report_metadata(entry, report, label)
        camera = extract_camera(report, label)
        viewport = extract_viewport(report, label)
        if viewport["width"] != expected_width or viewport["height"] != expected_height:
            fail(f"{label}.report viewport does not match {viewport_name}")
        normalized[key] = {
            "entry": entry,
            "camera": camera,
            "viewport": viewport,
            "modelCenter": extract_model_center(report, label),
            "lights": extract_rect_lights(report, label),
            "statistics": extract_statistics(report, label),
            "regions": extract_regions(report, label),
        }

        if require_raw:
            raw_path = entry.get("rawPath")
            if not isinstance(raw_path, str) or not raw_path or Path(raw_path).is_absolute() or ".." in Path(raw_path).parts:
                fail(f"unsafe rawPath in {label}: {raw_path!r}")
            if raw_path in raw_paths:
                fail(f"duplicate rawPath: {raw_path}")
            raw_paths.add(raw_path)
        else:
            image_path = entry.get("image")
            if not isinstance(image_path, str) or not image_path or Path(image_path).is_absolute() or ".." in Path(image_path).parts:
                fail(f"unsafe committed image path in {label}: {image_path!r}")
            if image_path in image_paths:
                fail(f"duplicate committed image path: {image_path}")
            image_paths.add(image_path)

    if len(entries) != EXPECTED_CAPTURE_COUNT or actual != expected:
        missing = sorted(expected - actual)[:10]
        extra = sorted(actual - expected)[:10]
        fail(
            "capture matrix mismatch: "
            f"entries={len(entries)} unique={len(actual)} expected={EXPECTED_CAPTURE_COUNT} missing={missing} extra={extra}"
        )
    validate_comparison_invariants(normalized)
    validate_light_invariants(normalized)
    validate_luminance_gate(normalized)
    return normalized


def validate_comparison_invariants(normalized: Mapping[tuple[str, str, str, str, str], dict]) -> None:
    for viewport, theme, view, distance in product(VIEWPORTS, THEMES, VIEWS, DISTANCES):
        rows = [normalized[(candidate, viewport, theme, view, distance)] for candidate in CANDIDATES]
        reference = rows[0]
        for candidate, row in zip(CANDIDATES[1:], rows[1:]):
            if (
                abs(row["viewport"]["devicePixelRatio"] - reference["viewport"]["devicePixelRatio"]) > 1e-9
                or abs(row["viewport"]["renderPixelRatio"] - reference["viewport"]["renderPixelRatio"]) > 1e-9
            ):
                fail(f"DPR differs across candidates for {(viewport, theme, view, distance)} at {candidate}")
            for field in ("position", "quaternion", "target"):
                if not vectors_close(row["camera"][field], reference["camera"][field]):
                    fail(f"camera {field} differs across candidates for {(viewport, theme, view, distance)} at {candidate}")
            if abs(row["camera"]["distance"] - reference["camera"]["distance"]) > VECTOR_TOLERANCE:
                fail(f"camera distance differs across candidates for {(viewport, theme, view, distance)} at {candidate}")
            if not vectors_close(row["modelCenter"], reference["modelCenter"]):
                fail(f"model center differs across candidates for {(viewport, theme, view, distance)} at {candidate}")


def light_config_equal(left: Mapping[str, object], right: Mapping[str, object]) -> bool:
    return (
        vectors_close(left["size"], right["size"])
        and abs(float(left["intensity"]) - float(right["intensity"])) <= 1e-9
        and left["color"] == right["color"]
        and left["parent"] == right["parent"]
        and left["visible"] == right["visible"]
    )


def validate_light_invariants(normalized: Mapping[tuple[str, str, str, str, str], dict]) -> None:
    for candidate in ("d2a", "d2b"):
        for viewport, theme, view in product(VIEWPORTS, THEMES, VIEWS):
            distance_rows = {
                distance: normalized[(candidate, viewport, theme, view, distance)]
                for distance in DISTANCES
            }
            reference_lights = distance_rows["initial"]["lights"]
            for distance, row in distance_rows.items():
                if row["lights"].keys() != reference_lights.keys():
                    fail(f"{candidate} RectAreaLight names differ at {(viewport, theme, view, distance)}")
                for name, reference in reference_lights.items():
                    light = row["lights"][name]
                    if not light_config_equal(light, reference):
                        fail(f"{candidate} light configuration changes with zoom: {(viewport, theme, view, distance, name)}")
                    if abs(light["distanceToModel"] - reference["distanceToModel"]) > VECTOR_TOLERANCE:
                        fail(f"{candidate} light-to-model distance changes with zoom: {(viewport, theme, view, distance, name)}")
                    if not vectors_close(light["position"], reference["position"]):
                        fail(f"{candidate} light position changes with zoom: {(viewport, theme, view, distance, name)}")
                    if not vectors_close(light["quaternion"], reference["quaternion"]):
                        fail(f"{candidate} light quaternion changes with zoom: {(viewport, theme, view, distance, name)}")

    d2a_reference = normalized[("d2a", VIEWPORTS[0], THEMES[0], VIEWS[0], "initial")]["lights"]
    for viewport, theme, view, distance in product(VIEWPORTS, THEMES, VIEWS, DISTANCES):
        lights = normalized[("d2a", viewport, theme, view, distance)]["lights"]
        for name, reference in d2a_reference.items():
            light = lights[name]
            if (
                not light_config_equal(light, reference)
                or not vectors_close(light["position"], reference["position"])
                or not vectors_close(light["quaternion"], reference["quaternion"])
                or abs(light["distanceToModel"] - reference["distanceToModel"]) > VECTOR_TOLERANCE
            ):
                fail(f"D2a is not a fully world-fixed studio at {(viewport, theme, view, distance, name)}")

    d2b_reference = normalized[("d2b", VIEWPORTS[0], THEMES[0], VIEWS[0], "initial")]["lights"]
    positions: dict[str, set[tuple[float, ...]]] = {name: set() for name in d2b_reference}
    for viewport, theme, view, distance in product(VIEWPORTS, THEMES, VIEWS, DISTANCES):
        lights = normalized[("d2b", viewport, theme, view, distance)]["lights"]
        for name, reference in d2b_reference.items():
            light = lights[name]
            if not light_config_equal(light, reference):
                fail(f"D2b changes light size/intensity/color across conditions at {(viewport, theme, view, distance, name)}")
            if abs(light["distanceToModel"] - reference["distanceToModel"]) > VECTOR_TOLERANCE:
                fail(f"D2b does not keep a fixed model radius at {(viewport, theme, view, distance, name)}")
            positions[name].add(tuple(round(value, 5) for value in light["position"]))
    for name, unique_positions in positions.items():
        if len(unique_positions) < 2:
            fail(f"D2b light {name!r} does not demonstrate view-orientation following")


def validate_luminance_gate(normalized: Mapping[tuple[str, str, str, str, str], dict]) -> None:
    # The work order's quantitative zoom gate is explicitly the same front
    # direction at near / initial / far.  Back and side remain recorded for
    # qualitative metal-highlight review, where changing perspective changes
    # the visible reflective faces and is not a distance-only luminance test.
    view = "front"
    for candidate, viewport, theme in product(("d2a", "d2b"), VIEWPORTS, THEMES):
        rows = {
            distance: normalized[(candidate, viewport, theme, view, distance)]
            for distance in DISTANCES
        }
        for region in REGIONS:
            initial = rows["initial"]["regions"][region]["averageLuminance"]
            if initial <= 1e-9:
                fail(f"{candidate} initial luminance is zero for {(viewport, theme, view, region)}")
            for distance in ("near", "far"):
                value = rows[distance]["regions"][region]["averageLuminance"]
                relative_delta = abs(value / initial - 1)
                if relative_delta > LUMINANCE_TOLERANCE + 1e-9:
                    fail(
                        f"{candidate} {region} luminance changes by {relative_delta:.3%} "
                        f"at {(viewport, theme, view, distance)}; limit is {LUMINANCE_TOLERANCE:.0%}"
                    )


def safe_temp_path(relative: str, label: str) -> Path:
    path = (TEMP / relative).resolve()
    try:
        path.relative_to(TEMP.resolve())
    except ValueError as error:
        fail(f"{label} escapes temporary evidence root: {relative}")
        raise AssertionError from error
    return path


def convert_captures(matrix: Mapping[str, object]) -> list[dict]:
    entries = matrix["entries"]
    assert isinstance(entries, list)
    converted: list[dict] = []
    for index, entry in enumerate(entries):
        assert isinstance(entry, Mapping)
        candidate, viewport, theme, view, distance = (
            str(entry[field]) for field in ("candidate", "viewport", "theme", "view", "distance")
        )
        raw_path = str(entry["rawPath"])
        source = safe_temp_path(raw_path, f"entries[{index}].rawPath")
        if not source.exists():
            fail(f"missing raw browser JPEG: {source}")
        expected_size = tuple(int(value) for value in viewport.split("x"))
        output = CAPTURES / candidate / viewport / theme / view / distance / capture_filename(
            candidate, theme, view, distance, viewport
        )
        output.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(source) as image:
            if source.suffix.lower() not in {".jpg", ".jpeg"} or image.format != "JPEG" or source.read_bytes()[:3] != b"\xff\xd8\xff":
                fail(f"raw capture extension or MIME does not match browser JPEG output: {source}")
            if image.size != expected_size:
                fail(f"unexpected screenshot size {source}: {image.size}, expected {expected_size}")
        shutil.copyfile(source, output)
        committed_entry = {key: value for key, value in entry.items() if key != "rawPath"}
        committed_entry.update({
            "image": str(output.relative_to(ROOT)),
            "rawSource": "temporary-browser-jpeg-not-committed",
        })
        converted.append(committed_entry)
    return converted


def load_font(size: int = 17) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def labeled_cell(image: Image.Image, label: str, max_width: int) -> Image.Image:
    if image.width > max_width:
        height = round(image.height * max_width / image.width)
        image = image.resize((max_width, height), Image.Resampling.LANCZOS)
    else:
        image = image.copy()
    bar_height = 38
    cell = Image.new("RGB", (image.width, image.height + bar_height), "#11151b")
    cell.paste(image, (0, bar_height))
    ImageDraw.Draw(cell).text((10, 9), label, fill="#f5f7fa", font=load_font())
    return cell


def build_comparison_board(images: list[list[tuple[str, Image.Image]]], output: Path, max_width: int) -> None:
    cells = [[labeled_cell(image, label, max_width) for label, image in row] for row in images]
    column_widths = [max(cells[row][column].width for row in range(len(cells))) for column in range(len(cells[0]))]
    row_heights = [max(cell.height for cell in row) for row in cells]
    board = Image.new("RGB", (sum(column_widths), sum(row_heights)), "#0d1015")
    y = 0
    for row_index, row in enumerate(cells):
        x = 0
        for column_index, cell in enumerate(row):
            board.paste(cell, (x, y))
            x += column_widths[column_index]
        y += row_heights[row_index]
    output.parent.mkdir(parents=True, exist_ok=True)
    board.save(output, "JPEG", quality=88, optimize=True, progressive=True)
    for row in cells:
        for cell in row:
            cell.close()


def build_comparisons() -> None:
    labels = {"d2": "D2 CURRENT", "d2a": "D2A", "d2b": "D2B"}
    for viewport, theme, view in product(VIEWPORTS, THEMES, VIEWS):
        grid: list[list[tuple[str, Image.Image]]] = []
        for distance in DISTANCES:
            row: list[tuple[str, Image.Image]] = []
            for candidate in CANDIDATES:
                path = CAPTURES / candidate / viewport / theme / view / distance / capture_filename(
                    candidate, theme, view, distance, viewport
                )
                row.append((f"{labels[candidate]} · {distance.upper()}", Image.open(path).convert("RGB")))
            grid.append(row)
        output = COMPARISONS / viewport / theme / comparison_filename(theme, view, viewport)
        build_comparison_board(grid, output, max_width=320 if viewport == "1280x720" else 280)
        for row in grid:
            for _, image in row:
                image.close()


def copy_machine_outputs() -> None:
    source_reports = TEMP / "reports"
    source_layouts = TEMP / "light-layouts"
    if not source_reports.is_dir():
        fail(f"missing machine report directory: {source_reports}")
    if not source_layouts.is_dir():
        fail(f"missing light-layout directory: {source_layouts}")
    if REPORTS.exists():
        shutil.rmtree(REPORTS)
    if LIGHT_LAYOUTS.exists():
        shutil.rmtree(LIGHT_LAYOUTS)
    shutil.copytree(source_reports, REPORTS)
    shutil.copytree(source_layouts, LIGHT_LAYOUTS)


def report_rows(report: Mapping[str, object], label: str) -> list:
    for key in ("entries", "rows", "runs", "groups"):
        value = report.get(key)
        if isinstance(value, list):
            return value
    fail(f"{label} must contain entries, rows, or runs")
    return []


def validate_startup_report(report: Mapping[str, object]) -> None:
    entries = report_rows(report, "startup timeline report")
    expected = set(product(("d2", "d2a", "d2b", "d3"), VIEWPORTS))
    actual: set[tuple[str, str]] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, Mapping):
            fail(f"startup timeline entry {index} must be an object")
        candidate = normalize_report_candidate(
            entry.get("candidate", entry.get("resolvedCandidate", entry.get("queryCandidate")))
        )
        viewport = entry.get("viewport")
        if isinstance(viewport, Mapping):
            viewport = f"{viewport.get('width')}x{viewport.get('height')}"
        key = (str(candidate), str(viewport))
        if key not in expected or key in actual:
            fail(f"unexpected or duplicate startup timeline condition: {key}")
        actual.add(key)
        samples = nested(entry, ("samples",), ("timeline", "samples"))
        if not isinstance(samples, list) or len(samples) != 21:
            fail(f"startup timeline {key} must contain exactly 21 samples")
        elapsed = []
        scheduled = []
        for sample_index, sample in enumerate(samples):
            if not isinstance(sample, Mapping):
                fail(f"startup timeline {key} sample {sample_index} must be an object")
            value = sample.get("actualMs", sample.get("elapsedMs", sample.get("timeMs", sample.get("tMs"))))
            elapsed.append(finite_number(value, f"startup timeline {key} sample {sample_index} elapsedMs"))
            scheduled.append(
                finite_number(sample.get("scheduledMs"), f"startup timeline {key} sample {sample_index} scheduledMs")
            )
        expected_schedule = [sample_index * 250 for sample_index in range(21)]
        if scheduled != expected_schedule:
            fail(f"startup timeline {key} does not use absolute 250 ms deadlines")
        if (
            elapsed[0] < 0
            or elapsed[0] > 250
            or any(right <= left for left, right in zip(elapsed, elapsed[1:]))
            or elapsed[-1] < 4900
            or elapsed[-1] > 5250
            or max(abs(actual - deadline) for actual, deadline in zip(elapsed, scheduled)) > 125
        ):
            fail(f"startup timeline {key} does not remain on the monotonic five-second absolute schedule")
        payload = entry.get("report")
        if not isinstance(payload, Mapping):
            fail(f"startup timeline {key} must include the final startup report")
        if normalize_report_candidate(payload.get("candidate")) != candidate:
            fail(f"startup timeline {key} resolved a different candidate")
        if payload.get("queryPreserved") is not True or payload.get("gateSatisfied") is not True:
            fail(f"startup timeline {key} did not preserve its query or satisfy the startup gate")
        milestones = payload.get("milestones")
        if not isinstance(milestones, Mapping):
            fail(f"startup timeline {key} is missing milestones")
        required_milestones = (
            "pmremReady",
            "environmentApplied",
            "rectAreaUniformsReady",
            "candidateReady",
            "firstFrameRendered",
            "renderComplete",
        )
        if any(milestones.get(name) is not True for name in required_milestones):
            fail(f"startup timeline {key} completed before a required milestone")
        if candidate == "d3" and milestones.get("initialShadowReady") is not True:
            fail(f"startup timeline {key} completed before the D3 shadow map was ready")
        environment = payload.get("environment")
        render_status = payload.get("renderStatus")
        lights = payload.get("lights")
        expected_light_count = 3 if candidate == "d3" else 2
        if (
            not isinstance(environment, Mapping)
            or environment.get("pmremReady") is not True
            or environment.get("applied") is not True
            or not isinstance(render_status, Mapping)
            or render_status.get("done") is not True
            or not isinstance(lights, list)
            or len(lights) != expected_light_count
            or any(not isinstance(light, Mapping) or light.get("visible") is not True for light in lights)
        ):
            fail(f"startup timeline {key} final resource state is incomplete")
        final_sample = samples[-1]
        if not isinstance(final_sample, Mapping) or final_sample.get("renderStatus") != "done":
            fail(f"startup timeline {key} did not end with renderStatus done")
    if actual != expected:
        fail(f"startup timeline coverage mismatch: missing={sorted(expected - actual)} extra={sorted(actual - expected)}")


def normalize_report_condition(entry: Mapping[str, object]) -> tuple[str, str, str, str] | None:
    candidate = normalize_report_candidate(entry.get("candidate", entry.get("queryCandidate")))
    viewport = entry.get("viewport")
    if isinstance(viewport, Mapping):
        viewport = f"{viewport.get('width')}x{viewport.get('height')}"
    view = entry.get("view")
    if view in VIEW_CAMERAS.values():
        view = next(name for name, preset in VIEW_CAMERAS.items() if preset == view)
    distance = entry.get("distanceId", entry.get("distance"))
    if isinstance(distance, Mapping):
        distance = distance.get("id", distance.get("name"))
    key = (str(candidate), str(viewport), str(view), str(distance))
    valid = set(product(DIAGNOSTIC_CANDIDATES, VIEWPORTS, VIEWS, DISTANCES))
    return key if key in valid else None


def diagnostic_report_payload(entry: Mapping[str, object]) -> Mapping[str, object]:
    report = entry.get("report")
    return report if isinstance(report, Mapping) else entry


def extract_environment_intensity(report: Mapping[str, object], label: str) -> float:
    value = nested(
        report,
        ("environmentIntensity",),
        ("environment", "intensity"),
        ("zoom", "environmentIntensity"),
        ("zoom", "environment", "intensity"),
    )
    intensity = finite_number(value, f"{label}.environmentIntensity")
    if intensity < 0:
        fail(f"{label}.environmentIntensity must be non-negative")
    return intensity


def validate_distance_report(report: Mapping[str, object]) -> None:
    entries = report_rows(report, "camera/light distance report")
    expected = set(product(DIAGNOSTIC_CANDIDATES, VIEWPORTS, VIEWS, DISTANCES))
    normalized: dict[tuple[str, str, str, str], dict] = {}
    for index, entry in enumerate(entries):
        if not isinstance(entry, Mapping):
            fail(f"camera/light distance entry {index} must be an object")
        key = normalize_report_condition(entry)
        if key is None:
            continue
        if key in normalized:
            fail(f"duplicate camera/light distance condition: {key}")
        payload = diagnostic_report_payload(entry)
        label = f"camera/light distance {key}"
        normalized[key] = {
            "camera": extract_camera(payload, label),
            "lights": extract_rect_lights(payload, label),
            "environmentIntensity": extract_environment_intensity(payload, label),
        }
    actual = set(normalized)
    if actual != expected:
        fail(
            "camera/light distance report coverage mismatch: "
            f"missing={sorted(expected - actual)[:10]} extra={sorted(actual - expected)[:10]}"
        )
    for candidate, viewport, view in product(DIAGNOSTIC_CANDIDATES, VIEWPORTS, VIEWS):
        rows = {distance: normalized[(candidate, viewport, view, distance)] for distance in DISTANCES}
        initial = rows["initial"]
        if not rows["near"]["camera"]["distance"] < initial["camera"]["distance"] < rows["far"]["camera"]["distance"]:
            fail(f"camera distances are not ordered near/initial/far for {(candidate, viewport, view)}")
        for distance, row in rows.items():
            if abs(row["environmentIntensity"] - initial["environmentIntensity"]) > 1e-9:
                fail(f"environmentIntensity changes with zoom at {(candidate, viewport, view, distance)}")
            if row["lights"].keys() != initial["lights"].keys():
                fail(f"RectAreaLight names change with zoom at {(candidate, viewport, view, distance)}")
            for name, reference in initial["lights"].items():
                light = row["lights"][name]
                if not light_config_equal(light, reference):
                    fail(f"RectAreaLight configuration changes with zoom at {(candidate, viewport, view, distance, name)}")
                if abs(light["distanceToModel"] - reference["distanceToModel"]) > VECTOR_TOLERANCE:
                    fail(f"light-to-model distance changes with zoom at {(candidate, viewport, view, distance, name)}")


def validate_luminance_report(report: Mapping[str, object]) -> None:
    entries = report_rows(report, "luminance comparison report")
    expected = set(product(CANDIDATES, VIEWPORTS, THEMES, VIEWS))
    actual: set[tuple[str, str, str, str]] = set()
    for index, entry in enumerate(entries):
        if not isinstance(entry, Mapping):
            fail(f"luminance comparison group {index} must be an object")
        candidate = normalize_report_candidate(entry.get("candidate"))
        key = (str(candidate), str(entry.get("viewport")), str(entry.get("theme")), str(entry.get("view")))
        if key not in expected or key in actual:
            fail(f"unexpected or duplicate luminance comparison group: {key}")
        actual.add(key)
        regions = entry.get("regions")
        if not isinstance(regions, Mapping):
            fail(f"luminance comparison group {key} is missing regions")
        max_delta = 0.0
        for region in REGIONS:
            distances = regions.get(region)
            if not isinstance(distances, Mapping):
                fail(f"luminance comparison group {key} is missing {region}")
            initial = distances.get("initial")
            if not isinstance(initial, Mapping):
                fail(f"luminance comparison group {key} {region} is missing initial")
            initial_luminance = finite_number(
                initial.get("averageLuminance"), f"luminance comparison group {key} {region} initial"
            )
            if initial_luminance <= 0:
                fail(f"luminance comparison group {key} {region} initial must be positive")
            for distance in DISTANCES:
                row = distances.get(distance)
                if not isinstance(row, Mapping):
                    fail(f"luminance comparison group {key} {region} is missing {distance}")
                luminance = finite_number(
                    row.get("averageLuminance"), f"luminance comparison group {key} {region} {distance}"
                )
                relative_delta = finite_number(
                    row.get("relativeDelta"), f"luminance comparison group {key} {region} {distance} relativeDelta"
                )
                computed_delta = luminance / initial_luminance - 1
                if abs(relative_delta - computed_delta) > 1e-9:
                    fail(f"luminance comparison group {key} {region} {distance} relativeDelta is inconsistent")
                if distance != "initial":
                    max_delta = max(max_delta, abs(computed_delta))
                visible_surface = row.get("visibleSurface")
                if not isinstance(visible_surface, Mapping) or visible_surface.get("method") != "model-silhouette-mask-pass":
                    fail(f"luminance comparison group {key} {region} {distance} is missing visibleSurface")
        quantitative_gate = candidate in {"d2a", "d2b"} and entry.get("view") == "front"
        if entry.get("quantitativeGate") is not quantitative_gate:
            fail(f"luminance comparison group {key} quantitativeGate is incorrect")
        recorded_max = finite_number(entry.get("maxAbsoluteRelativeDelta"), f"luminance comparison group {key} max delta")
        if abs(recorded_max - max_delta) > 1e-9:
            fail(f"luminance comparison group {key} max delta is inconsistent")
        expected_within = max_delta <= LUMINANCE_TOLERANCE + 1e-9 if quantitative_gate else None
        if entry.get("withinTolerance") is not expected_within:
            fail(f"luminance comparison group {key} withinTolerance is incorrect")
        if quantitative_gate and not expected_within:
            fail(f"luminance comparison group {key} exceeds the front-view tolerance")
    if actual != expected or len(entries) != len(expected):
        fail(f"luminance comparison coverage mismatch: missing={sorted(expected - actual)} extra={sorted(actual - expected)}")


def validate_browser_report(report: Mapping[str, object]) -> None:
    runs = report_rows(report, "browser regression report")
    current = [run for run in runs if isinstance(run, Mapping) and run.get("source") == "Phase 2A.1 current head"]
    historical = [run for run in runs if isinstance(run, Mapping) and run.get("source") == "Phase 2A historical supplemental evidence"]
    expected = {
        *(('browser', candidate, viewport) for candidate in ('baseline', 'd2a', 'd2b') for viewport in ('1280x720', '390x844')),
        *(('ui', 'baseline', viewport) for viewport in ('1280x720', '390x844', '375x667')),
        *(('hud', 'baseline', viewport) for viewport in ('1280x720', '390x844', '393x852', '375x667')),
        *(('rendering', candidate, viewport) for candidate in ('d2a', 'd2b') for viewport in VIEWPORTS),
    }
    actual: set[tuple[str, str, str]] = set()
    for run in current:
        key = (str(run.get('suite')), str(run.get('candidate')), str(run.get('viewport')))
        if key not in expected or key in actual:
            fail(f"unexpected or duplicate current browser run: {key}")
        actual.add(key)
        payload = run.get('report')
        if not isinstance(payload, Mapping) or run.get('expectedResult') is not True:
            fail(f"current browser run {key} is missing its passing expectation")
        failed = payload.get('failed')
        if not isinstance(failed, list):
            fail(f"current browser run {key} is missing failed checks")
        allowed = run.get('allowedFailures', [])
        if key == ('browser', 'baseline', '390x844'):
            expected_failure = ['a5-all-background-themes-keep-front-back-luminance-within-thirty-percent']
            names = [item.get('name') if isinstance(item, Mapping) else item for item in failed]
            if names != expected_failure or allowed != expected_failure or payload.get('ok') is not False:
                fail("the known 390x844 baseline Issue #2 failure was not recorded exactly")
        elif payload.get('ok') is not True or failed:
            fail(f"current browser run {key} did not pass")
        if key[0] == 'browser':
            a7 = payload.get('a7')
            drift = payload.get('drift')
            if (
                not isinstance(a7, Mapping)
                or a7.get('passed') != 9
                or a7.get('total') != 9
                or a7.get('failed') != []
                or not isinstance(drift, Mapping)
                or drift.get('hold') != 0
                or drift.get('cycles') != 0
                or drift.get('frameRates') is not True
                or payload.get('windForbidden') != 0
                or payload.get('setForbidden') != 0
            ):
                fail(f"current browser run {key} regressed A.7, drift, or interference")
    if actual != expected or len(current) != len(expected) or len(historical) != 45 or len(runs) < 57:
        fail(
            "browser report coverage mismatch: "
            f"current={len(current)} historical={len(historical)} missing={sorted(expected - actual)}"
        )


def validate_performance_report(report: Mapping[str, object]) -> None:
    runs = report_rows(report, "performance report")
    current = [run for run in runs if isinstance(run, Mapping) and run.get("source") == "Phase 2A.1 current head"]
    historical = [run for run in runs if isinstance(run, Mapping) and run.get("source") == "Phase 2A historical supplemental evidence"]
    expected = set(product(('d2a', 'd2b'), ('1280x720', '390x844'), ('pointer-rotate', 'wheel-zoom', 'opacity-idle')))
    actual: set[tuple[str, str, str]] = set()
    for run in current:
        key = (str(run.get('candidate')), str(run.get('viewport')), str(run.get('scenario')))
        if key not in expected or key in actual:
            fail(f"unexpected or duplicate current performance run: {key}")
        actual.add(key)
        payload = run.get('report')
        pacing = payload.get('pacing') if isinstance(payload, Mapping) else None
        if not isinstance(pacing, Mapping) or run.get('expectedResult') is not True or payload.get('modelInvariant') is not True:
            fail(f"current performance run {key} is incomplete")
        average_fps = finite_number(pacing.get('averageFps'), f"performance {key} averageFps")
        p50 = finite_number(pacing.get('p50'), f"performance {key} p50")
        p95 = finite_number(pacing.get('p95'), f"performance {key} p95")
        p99 = finite_number(pacing.get('p99'), f"performance {key} p99")
        over33 = finite_number(pacing.get('over33'), f"performance {key} over33")
        over50 = finite_number(pacing.get('over50'), f"performance {key} over50")
        callbacks = finite_number(pacing.get('callbackCount'), f"performance {key} callbackCount")
        if callbacks <= 0:
            fail(f"current performance run {key} has no captured frames")
        if key[1] == '1280x720':
            passed = average_fps >= 55 and p50 <= 18 and p95 <= 25 and p99 <= 40 and over50 <= 1 and over33 / callbacks < .05
        else:
            passed = average_fps >= 45 and p95 <= 33.3 and over50 / callbacks < .02
        if not passed:
            fail(f"current performance run {key} exceeds the A.6 frame-pacing threshold")
        if key[2] == 'pointer-rotate':
            motion = payload.get('motion')
            if not isinstance(motion, Mapping) or motion.get('finite') is not True or motion.get('reversalCount') != 0 or motion.get('stopThenJumpCount') != 0:
                fail(f"current pointer performance run {key} regressed camera smoothness")
        if key[2] == 'wheel-zoom':
            zoom = payload.get('zoom')
            if not isinstance(zoom, Mapping) or zoom.get('finite') is not True or zoom.get('monotonic') is not True or finite_number(zoom.get('maxStepShare'), f"performance {key} maxStepShare") > .08:
                fail(f"current wheel performance run {key} regressed zoom smoothness")
    if actual != expected or len(current) != len(expected) or len(historical) != 36 or len(runs) < 48:
        fail(
            "performance report coverage mismatch: "
            f"current={len(current)} historical={len(historical)} missing={sorted(expected - actual)}"
        )


def validate_layout_report(report: Mapping[str, object], layout_paths: Iterable[Path]) -> None:
    entries = report_rows(report, "lighting layout report")
    expected = set(product(CANDIDATES, VIEWS, DISTANCES))
    actual: set[tuple[str, str, str]] = set()
    for entry in entries:
        if not isinstance(entry, Mapping):
            continue
        candidate = normalize_report_candidate(entry.get("candidate", entry.get("queryCandidate")))
        key = (str(candidate), str(entry.get("view")), str(entry.get("distanceId", entry.get("distance"))))
        if key in expected:
            actual.add(key)
    if len(entries) != EXPECTED_LIGHT_LAYOUT_COUNT or actual != expected:
        fail(f"lighting layout report coverage mismatch: entries={len(entries)} missing={sorted(expected - actual)}")
    names = [path.name for path in layout_paths]
    if len(names) != EXPECTED_LIGHT_LAYOUT_COUNT or set(names) != expected_layout_names() or len(names) != len(set(names)):
        fail("light-layout SVG names do not match the 3 candidate x 3 view x 3 distance matrix")


def validate_required_reports() -> None:
    for path in REQUIRED_REPORTS:
        load_json(path, "required machine report")
    startup = load_json(REPORTS / "startup/timelines.json")
    distances = load_json(REPORTS / "zoom/camera-light-distances.json")
    luminance = load_json(REPORTS / "zoom/luminance-comparison.json")
    layouts = load_json(REPORTS / "lighting/layouts.json")
    browser = load_json(REPORTS / "browser-report.json")
    performance = load_json(REPORTS / "performance/summary.json")
    validate_startup_report(startup)
    validate_distance_report(distances)
    validate_luminance_report(luminance)
    validate_browser_report(browser)
    validate_performance_report(performance)
    layout_paths = sorted(LIGHT_LAYOUTS.rglob("*.svg"))
    validate_layout_report(layouts, layout_paths)
    node = browser.get("node")
    if not isinstance(node, Mapping) or node.get("total") != 33 or node.get("passed") != 33 or node.get("failed") != 0:
        fail("browser report must record Node 33/33 with zero failures")


def file_record(path: Path) -> dict:
    data = path.read_bytes()
    record = {
        "path": str(path.relative_to(ROOT)),
        "bytes": len(data),
        "sha256": hashlib.sha256(data).hexdigest(),
        "mime": mimetypes.guess_type(path.name)[0] or "application/octet-stream",
    }
    if path.suffix.lower() in {".jpg", ".jpeg", ".png"}:
        with Image.open(path) as image:
            record["dimensions"] = list(image.size)
    return record


def write_manifest() -> dict:
    files = sorted(path for path in EVIDENCE.rglob("*") if path.is_file() and path != MANIFEST)
    manifest = {
        "schema": "issue2-phase2a1-evidence-v1",
        "root": str(EVIDENCE.relative_to(ROOT)),
        "expectedCaptureCount": EXPECTED_CAPTURE_COUNT,
        "expectedComparisonCount": EXPECTED_COMPARISON_COUNT,
        "expectedLightLayoutCount": EXPECTED_LIGHT_LAYOUT_COUNT,
        "luminanceTolerance": LUMINANCE_TOLERANCE,
        "fileCount": len(files),
        "files": [file_record(path) for path in files],
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def validate_artifact_counts() -> None:
    captures = sorted(CAPTURES.rglob("*.jpg"))
    comparisons = sorted(COMPARISONS.rglob("*.jpg"))
    layouts = sorted(LIGHT_LAYOUTS.rglob("*.svg"))
    if len(captures) != EXPECTED_CAPTURE_COUNT:
        fail(f"expected {EXPECTED_CAPTURE_COUNT} JPEG masters, found {len(captures)}")
    if len(comparisons) != EXPECTED_COMPARISON_COUNT:
        fail(f"expected {EXPECTED_COMPARISON_COUNT} nine-cell boards, found {len(comparisons)}")
    if len(layouts) != EXPECTED_LIGHT_LAYOUT_COUNT:
        fail(f"expected {EXPECTED_LIGHT_LAYOUT_COUNT} light-layout SVGs, found {len(layouts)}")
    if set(path.name for path in layouts) != expected_layout_names():
        fail("committed light-layout SVG filenames do not match the expected matrix")


def check_manifest() -> None:
    manifest = load_json(MANIFEST, "Phase 2A.1 evidence manifest")
    expected_root = str(EVIDENCE.relative_to(ROOT))
    if manifest.get("schema") != "issue2-phase2a1-evidence-v1" or manifest.get("root") != expected_root:
        fail("unexpected evidence manifest schema or root")
    expected_counts = {
        "expectedCaptureCount": EXPECTED_CAPTURE_COUNT,
        "expectedComparisonCount": EXPECTED_COMPARISON_COUNT,
        "expectedLightLayoutCount": EXPECTED_LIGHT_LAYOUT_COUNT,
        "luminanceTolerance": LUMINANCE_TOLERANCE,
    }
    for key, expected in expected_counts.items():
        if manifest.get(key) != expected:
            fail(f"manifest {key} mismatch: {manifest.get(key)!r}, expected {expected!r}")
    records = manifest.get("files")
    if not isinstance(records, list):
        fail("manifest files must be an array")
    paths = [record.get("path") for record in records if isinstance(record, Mapping)]
    if manifest.get("fileCount") != len(records) or len(paths) != len(set(paths)):
        fail("manifest fileCount mismatch or duplicate paths")
    actual_paths = {
        str(path.relative_to(ROOT))
        for path in EVIDENCE.rglob("*")
        if path.is_file() and path != MANIFEST
    }
    if set(paths) != actual_paths:
        fail(
            "manifest is not closed-world: "
            f"unlisted={sorted(actual_paths - set(paths))[:10]} stale={sorted(set(paths) - actual_paths)[:10]}"
        )
    for record in records:
        if not isinstance(record, Mapping) or not isinstance(record.get("path"), str):
            fail("manifest contains an invalid file record")
        path = ROOT / record["path"]
        if not path.exists():
            fail(f"manifest path missing: {path}")
        current = file_record(path)
        for key in ("bytes", "sha256", "mime", "dimensions"):
            if key not in record and key not in current:
                continue
            if record.get(key) != current.get(key):
                fail(f"manifest mismatch {key}: {path}")
        suffix = path.suffix.lower()
        if suffix in {".jpg", ".jpeg"} and path.read_bytes()[:2] != b"\xff\xd8":
            fail(f"JPEG magic mismatch: {path}")
        if suffix == ".json":
            load_json(path)
        if suffix == ".svg":
            try:
                ElementTree.parse(path)
            except ElementTree.ParseError as error:
                fail(f"invalid SVG XML {path}: {error}")
    validate_artifact_counts()
    matrix = load_capture_matrix(MATRIX)
    if matrix.get("schema") != "issue2-phase2a1-capture-matrix-v1":
        fail("unexpected committed capture matrix schema")
    normalize_entries(matrix, require_raw=False)
    validate_required_reports()
    print(json.dumps({
        "ok": True,
        "files": manifest["fileCount"],
        "captures": EXPECTED_CAPTURE_COUNT,
        "comparisons": EXPECTED_COMPARISON_COUNT,
        "lightLayouts": EXPECTED_LIGHT_LAYOUT_COUNT,
    }, ensure_ascii=False))


def generate() -> None:
    source_matrix = load_capture_matrix(TEMP / "capture-matrix.json")
    normalize_entries(source_matrix, require_raw=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    for generated in (CAPTURES, COMPARISONS):
        if generated.exists():
            shutil.rmtree(generated)
    converted = convert_captures(source_matrix)
    final_matrix = {
        **source_matrix,
        "schema": "issue2-phase2a1-capture-matrix-v1",
        "expectedCaptureCount": EXPECTED_CAPTURE_COUNT,
        "entries": converted,
    }
    MATRIX.write_text(json.dumps(final_matrix, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    copy_machine_outputs()
    build_comparisons()
    validate_artifact_counts()
    validate_required_reports()
    manifest = write_manifest()
    print(json.dumps({
        "generated": True,
        "files": manifest["fileCount"],
        "captures": EXPECTED_CAPTURE_COUNT,
        "comparisons": EXPECTED_COMPARISON_COUNT,
        "lightLayouts": EXPECTED_LIGHT_LAYOUT_COUNT,
    }, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="audit the committed Phase 2A.1 package without rewriting it")
    args = parser.parse_args()
    if args.check:
        check_manifest()
    else:
        generate()


if __name__ == "__main__":
    main()
