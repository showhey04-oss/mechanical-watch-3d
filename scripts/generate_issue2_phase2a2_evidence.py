#!/usr/bin/env python3
"""Build and audit the Issue #2 Phase 2A.2 midtone evidence package.

The in-app browser capture harness writes viewport-sized JPEG masters and a
``capture-matrix.json`` to ``/tmp/issue2-rendering-quality-phase2a2``.  Each
matrix entry contains the ``getIssue2ZoomReport()`` payload.  The matrix must
also provide one full ``describeIssue2StudioRig()`` payload per candidate in
``candidateProfiles`` (a mapping or list); alternatively the same data may be
written to ``reports/lighting/candidate-profiles.json``.

This script deliberately operates on the Phase 2A.2 roots only.  In particular,
it never reads, rewrites, or copies the immutable Phase 1/2A/2A.1 packages.  It
validates the complete 4 candidate x 3 viewport x 4 theme x 5 view x 3 distance
matrix, commits 720 original browser JPEGs without re-encoding them, builds 60
4-column x 3-distance comparison boards, emits four studio-placement diagrams,
derives watch-silhouette and visible-surface reports, and seals the resulting
folder with a closed-world SHA-256 manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import math
import mimetypes
import shutil
from collections.abc import Mapping, Sequence
from itertools import product
from pathlib import Path
from urllib.parse import parse_qs, urlparse
from xml.etree import ElementTree

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
TEMP = Path("/tmp/issue2-rendering-quality-phase2a2")
EVIDENCE = ROOT / "docs/evidence/issue2-rendering-quality-phase2a2"
CAPTURES = EVIDENCE / "captures"
COMPARISONS = EVIDENCE / "comparisons"
REPORTS = EVIDENCE / "reports"
LIGHT_LAYOUTS = EVIDENCE / "light-layouts"
MATRIX = EVIDENCE / "capture-matrix.json"
MANIFEST = EVIDENCE / "evidence-manifest.json"

CANDIDATES = ("d2a", "d2c1", "d2c2", "d2c3")
CANDIDATE_QUERIES = {candidate: f"studio-{candidate}" for candidate in CANDIDATES}
CANDIDATE_PROFILES = {
    "d2a": "base",
    "d2c1": "d2c1-midtone-environment",
    "d2c2": "d2c2-balanced-key-fill",
    "d2c3": "d2c3-lower-bounce",
}
VIEWPORTS = ("1280x720", "390x844", "393x852")
THEMES = ("navy", "obsidian", "walnut", "gallery")
VIEWS = ("front", "back", "side", "winding", "motion-works")
VIEW_CAMERAS = {
    "front": "reset",
    "back": "movementBack",
    "side": "side",
    "winding": "winding",
    "motion-works": "motionWorks",
}
VIEW_CAMERA_ALIASES = {
    "front": {"reset", "front", "dialFront"},
    "back": {"movementBack", "back"},
    "side": {"side"},
    "winding": {"winding"},
    "motion-works": {"motionWorks", "dial", "dialMechanism"},
}
DISTANCES = ("near", "initial", "far")
REGIONS = ("dial", "hands", "brassTrain", "steelTrain", "ruby", "plate", "outerBezel")

EXPECTED_CAPTURE_COUNT = len(CANDIDATES) * len(VIEWPORTS) * len(THEMES) * len(VIEWS) * len(DISTANCES)
EXPECTED_COMPARISON_COUNT = len(VIEWPORTS) * len(THEMES) * len(VIEWS)
EXPECTED_LIGHT_LAYOUT_COUNT = len(CANDIDATES)
VECTOR_TOLERANCE = 2e-4
SCALAR_TOLERANCE = 1e-9

REQUIRED_CONDITIONS = {
    "time": "10:10:30",
    "paused": True,
    "structuralOpacity": 1,
    "exploded": False,
    "split": False,
    "panel": "closed",
}

# These are intentionally conservative, audited Phase 2A.2 values.  The
# evidence builder checks the browser-reported live rig against them so a board
# cannot accidentally document a stale WIP candidate.
BASE_PANELS = (
    {"name": "studioEnvKeyPanel", "color": "#ffffff", "radiance": 4.8, "size": (34, 22), "position": (16, -30, 20)},
    {"name": "studioEnvFillPanel", "color": "#ffffff", "radiance": 2.75, "size": (32, 26), "position": (-20, 28, 10)},
    {"name": "studioEnvStripPanel", "color": "#ffffff", "radiance": 2.1, "size": (8, 32), "position": (-28, -3, -12)},
)
BASE_FLAGS = (
    {"name": "studioEnvFrontFlag", "color": "#000000", "size": (7, 30), "position": (-23, -25, 3)},
    {"name": "studioEnvBackFlag", "color": "#000000", "size": (8, 28), "position": (24, 22, -4)},
)
D2C_FLAGS = tuple({**flag, "color": "#080808"} for flag in BASE_FLAGS)
BASE_LIGHTS = (
    {"name": "studioRectKey", "color": "#ffffff", "intensity": 1.0, "size": (30, 20), "position": (15, -28, 18)},
    {"name": "studioRectFill", "color": "#ffffff", "intensity": 0.35, "size": (28, 22), "position": (-18, 27, 11)},
)
D2C_BALANCED_LIGHTS = (
    {"name": "studioRectKey", "color": "#ffffff", "intensity": 0.85, "size": (30, 20), "position": (15, -28, 18)},
    {"name": "studioRectFill", "color": "#ffffff", "intensity": 0.455, "size": (32.2, 25.3), "position": (-18, 27, 11)},
)
LOWER_BOUNCE = {
    "name": "studioRectLowerBounce",
    "color": "#ffffff",
    "intensity": 0.085,
    "size": (38, 24),
    "position": (0, -22, -26),
}

EXPECTED_PROFILES = {
    "d2a": {
        "roomColor": "#181818",
        "floorColor": "#181818",
        "floorRadiance": 0.7,
        "flags": BASE_FLAGS,
        "rectLights": BASE_LIGHTS,
    },
    "d2c1": {
        "roomColor": "#202020",
        "floorColor": "#202020",
        "floorRadiance": 0.7,
        "flags": D2C_FLAGS,
        "rectLights": BASE_LIGHTS,
    },
    "d2c2": {
        "roomColor": "#202020",
        "floorColor": "#202020",
        "floorRadiance": 0.7,
        "flags": D2C_FLAGS,
        "rectLights": D2C_BALANCED_LIGHTS,
    },
    "d2c3": {
        "roomColor": "#202020",
        "floorColor": "#202020",
        "floorRadiance": 0.7,
        "flags": D2C_FLAGS,
        "rectLights": (*D2C_BALANCED_LIGHTS, LOWER_BOUNCE),
    },
}

METRIC_FIELDS = (
    "meanLuminance",
    "medianLuminance",
    "p10Luminance",
    "p25Luminance",
    "p75Luminance",
    "p90Luminance",
    "darkRatio",
    "clippedRatio",
    "sampleCount",
)
METRIC_ALIASES = {
    "meanLuminance": ("meanLuminance", "averageLuminance", "mean", "average"),
    "medianLuminance": ("medianLuminance", "p50Luminance", "median"),
    "p10Luminance": ("p10Luminance", "p10"),
    "p25Luminance": ("p25Luminance", "p25"),
    "p75Luminance": ("p75Luminance", "p75"),
    "p90Luminance": ("p90Luminance", "p90"),
    "darkRatio": ("darkRatio",),
    "clippedRatio": ("clippedRatio",),
    "sampleCount": ("sampleCount", "samples"),
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


def close(left: float, right: float, tolerance: float = SCALAR_TOLERANCE) -> bool:
    return abs(left - right) <= tolerance


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


def expected_capture_keys() -> set[tuple[str, str, str, str, str]]:
    return set(product(CANDIDATES, VIEWPORTS, THEMES, VIEWS, DISTANCES))


def capture_filename(candidate: str, theme: str, view: str, distance: str, viewport: str) -> str:
    return f"{candidate}-{theme}-{view}-{distance}-{viewport}.jpg"


def comparison_filename(theme: str, view: str, viewport: str) -> str:
    return f"d2c-midtone-grid-{theme}-{view}-{viewport}.jpg"


def normalize_candidate(value: object) -> str | None:
    if value in CANDIDATES:
        return str(value)
    for candidate, query in CANDIDATE_QUERIES.items():
        if value == query:
            return candidate
    return None


def normalize_metric(value: object, label: str, *, allow_empty: bool = False) -> dict:
    if not isinstance(value, Mapping):
        fail(f"{label} must be a metric object")
    result: dict[str, float | int | str | list] = {}
    for field in METRIC_FIELDS:
        raw = next((value[name] for name in METRIC_ALIASES[field] if name in value), None)
        number = finite_number(raw, f"{label}.{field}")
        result[field] = int(number) if field == "sampleCount" else number
    samples = int(result["sampleCount"])
    if samples < 0 or (samples == 0 and not allow_empty):
        fail(f"{label}.sampleCount must be {'non-negative' if allow_empty else 'positive'}")
    for field in ("meanLuminance", "medianLuminance", "p10Luminance", "p25Luminance", "p75Luminance", "p90Luminance"):
        if float(result[field]) < 0:
            fail(f"{label}.{field} must be non-negative")
    for field in ("darkRatio", "clippedRatio"):
        if not 0 <= float(result[field]) <= 1:
            fail(f"{label}.{field} must be between zero and one")
    if samples > 0:
        ordered = [float(result[field]) for field in ("p10Luminance", "p25Luminance", "medianLuminance", "p75Luminance", "p90Luminance")]
        if any(right + 1e-12 < left for left, right in zip(ordered, ordered[1:])):
            fail(f"{label} percentiles are not monotonic")
    method = value.get("method")
    if isinstance(method, str):
        result["method"] = method
    buffer = value.get("buffer")
    if buffer is not None:
        result["buffer"] = list(finite_vector(buffer, 2, f"{label}.buffer"))
    return result


def normalize_light(light: Mapping[str, object], label: str) -> dict:
    name = light.get("name")
    if not isinstance(name, str) or not name:
        fail(f"{label}.name must be a non-empty string")
    size = light.get("size")
    if size is None and is_number(light.get("width")) and is_number(light.get("height")):
        size = [light["width"], light["height"]]
    parent = light.get("parent")
    if not isinstance(parent, str) or not parent or "camera" in parent.lower() or light.get("cameraAttached") is True:
        fail(f"{label} must be world/model parented, not camera attached")
    result = {
        "name": name,
        "color": str(light.get("color", "")).lower(),
        "intensity": finite_number(light.get("intensity"), f"{label}.intensity"),
        "size": finite_vector(size, 2, f"{label}.size"),
        "position": finite_vector(light.get("position"), 3, f"{label}.position"),
        "quaternion": finite_vector(light.get("quaternion"), 4, f"{label}.quaternion"),
        "distanceToModel": finite_number(light.get("distanceToModel"), f"{label}.distanceToModel"),
        "parent": parent,
        "castShadow": light.get("castShadow"),
    }
    if result["color"] != "#ffffff" or result["intensity"] < 0 or min(result["size"]) <= 0:
        fail(f"{label} must be a non-negative neutral-white RectAreaLight with positive size")
    if result["castShadow"] is not False:
        fail(f"{label} must not cast a shadow")
    if "visible" in light and light.get("visible") is not True:
        fail(f"{label} must be visible")
    return result


def normalize_rect_lights(value: object, label: str) -> dict[str, dict]:
    if isinstance(value, Mapping):
        rows = list(value.values())
    elif isinstance(value, list):
        rows = value
    else:
        fail(f"{label} must contain RectAreaLight rows")
    result: dict[str, dict] = {}
    for index, row in enumerate(rows):
        if not isinstance(row, Mapping):
            fail(f"{label}[{index}] must be an object")
        light = normalize_light(row, f"{label}[{index}]")
        if light["name"] in result:
            fail(f"{label} contains duplicate light {light['name']!r}")
        result[light["name"]] = light
    return dict(sorted(result.items()))


def validate_expected_light(candidate: str, actual: Mapping[str, object], expected: Mapping[str, object], label: str) -> None:
    for field in ("color", "intensity"):
        if field == "color":
            matched = actual[field] == expected[field]
        else:
            matched = close(float(actual[field]), float(expected[field]))
        if not matched:
            fail(f"{label}.{field} does not match audited {candidate} value: {actual[field]!r} != {expected[field]!r}")
    for field in ("size", "position"):
        if not vectors_close(actual[field], expected[field], 1e-9):
            fail(f"{label}.{field} does not match audited {candidate} value")


def extract_capture_payload(entry: Mapping[str, object], label: str) -> dict:
    report = entry.get("report")
    if not isinstance(report, Mapping):
        fail(f"{label}.report must be an object")
    camera_value = report.get("camera")
    if not isinstance(camera_value, Mapping):
        fail(f"{label}.report.camera is missing")
    camera = {
        "position": finite_vector(camera_value.get("position"), 3, f"{label}.camera.position"),
        "quaternion": finite_vector(camera_value.get("quaternion"), 4, f"{label}.camera.quaternion"),
        "target": finite_vector(camera_value.get("target"), 3, f"{label}.camera.target"),
        "distance": finite_number(camera_value.get("distance"), f"{label}.camera.distance"),
    }
    viewport_value = report.get("viewport")
    if not isinstance(viewport_value, Mapping):
        fail(f"{label}.report.viewport is missing")
    viewport = {
        "width": int(finite_number(viewport_value.get("width"), f"{label}.viewport.width")),
        "height": int(finite_number(viewport_value.get("height"), f"{label}.viewport.height")),
        "devicePixelRatio": finite_number(viewport_value.get("devicePixelRatio"), f"{label}.viewport.devicePixelRatio"),
        "renderPixelRatio": finite_number(viewport_value.get("renderPixelRatio"), f"{label}.viewport.renderPixelRatio"),
    }
    fog = report.get("fog")
    active_fog = fog.get("active") if isinstance(fog, Mapping) else None
    if not isinstance(active_fog, Mapping) or not close(finite_number(active_fog.get("near"), f"{label}.fog.near"), 160) or not close(finite_number(active_fog.get("far"), f"{label}.fog.far"), 260):
        fail(f"{label} does not preserve the required D2a fog 160/260")
    candidate = normalize_candidate(report.get("candidate", report.get("queryCandidate")))
    if candidate != entry["candidate"]:
        fail(f"{label}.report candidate does not match {entry['candidate']}")
    if report.get("theme") != entry["theme"]:
        fail(f"{label}.report theme does not match {entry['theme']}")
    report_view = report.get("view", report.get("cameraPreset"))
    if report_view not in {entry["view"], *VIEW_CAMERA_ALIASES[str(entry["view"])]}:
        fail(f"{label}.report view does not match {entry['view']}")
    distance = report.get("distanceId", report.get("distance"))
    if isinstance(distance, Mapping):
        distance = distance.get("id", distance.get("name"))
    if distance != entry["distance"]:
        fail(f"{label}.report distance does not match {entry['distance']}")
    expected_profile = CANDIDATE_PROFILES[str(entry["candidate"])]
    if report.get("studioProfile") != expected_profile:
        fail(f"{label}.report studioProfile must be {expected_profile!r}")
    if report.get("placementStrategy") != "world-fixed":
        fail(f"{label}.report must retain the D2a world-fixed placement strategy")
    if not close(finite_number(report.get("environmentIntensity"), f"{label}.environmentIntensity"), 1):
        fail(f"{label}.environmentIntensity changed from 1")
    rect_lights = normalize_rect_lights(report.get("rectLights"), f"{label}.rectLights")
    expected_lights = EXPECTED_PROFILES[str(entry["candidate"])]["rectLights"]
    if set(rect_lights) != {light["name"] for light in expected_lights}:
        fail(f"{label}.rectLights do not match {entry['candidate']}")
    for expected in expected_lights:
        validate_expected_light(str(entry["candidate"]), rect_lights[expected["name"]], expected, f"{label}.{expected['name']}")
    watch = normalize_metric(report.get("watchSilhouette", report.get("statistics")), f"{label}.watchSilhouette")
    background = normalize_metric(report.get("background"), f"{label}.background", allow_empty=True)
    if watch.get("method") != "watch-root-silhouette-mask-pass":
        fail(f"{label}.watchSilhouette must use the full watch-root silhouette mask")
    if background.get("method") != "inverse-watch-mask-background-pass":
        fail(f"{label}.background must use the inverse watch-root mask")
    regions_value = report.get("regions")
    if not isinstance(regions_value, Mapping):
        fail(f"{label}.regions is missing")
    regions: dict[str, dict] = {}
    for region in REGIONS:
        region_value = regions_value.get(region)
        if not isinstance(region_value, Mapping):
            fail(f"{label}.regions is missing {region!r}")
        visible_surface = region_value.get("visibleSurface")
        regions[region] = normalize_metric(visible_surface, f"{label}.regions.{region}.visibleSurface", allow_empty=True)
        regions[region]["method"] = "model-visible-surface-mask-pass"
        regions[region]["meshCount"] = int(finite_number(region_value.get("meshCount"), f"{label}.regions.{region}.meshCount"))
        regions[region]["occluded"] = regions[region]["sampleCount"] == 0
        if regions[region]["meshCount"] <= 0:
            fail(f"{label}.regions.{region}.meshCount must be positive")
    startup = report.get("startup")
    if not isinstance(startup, Mapping) or startup.get("queryPreserved") is not True or startup.get("gateSatisfied") is not True:
        fail(f"{label}.startup did not preserve the candidate query or satisfy the resource gate")
    return {
        "report": report,
        "camera": camera,
        "viewport": viewport,
        "modelCenter": finite_vector(report.get("modelCenter"), 3, f"{label}.modelCenter"),
        "rectLights": rect_lights,
        "watchSilhouette": watch,
        "background": background,
        "regions": regions,
    }


def validate_url(entry: Mapping[str, object], conditions: Mapping[str, object], label: str) -> None:
    url = entry.get("url")
    if not isinstance(url, str) or not url:
        fail(f"{label}.url must be a direct-launch URL")
    query = parse_qs(urlparse(url).query)
    expected = {
        "issue2Candidate": CANDIDATE_QUERIES[str(entry["candidate"])],
        "theme": str(entry["theme"]),
        "camera": str(entry["cameraPreset"]),
        "issue2View": str(entry["view"]),
        str(conditions.get("distanceQueryParameter", "issue2Distance")): str(entry["distance"]),
        "time": str(conditions["time"]),
        "paused": "1",
        "opacity": "1",
        "panel": "collapsed",
        "issue2Report": str(conditions.get("reportMode", "zoom")),
        "evidenceViewport": str(entry["viewport"]),
    }
    for key, expected_value in expected.items():
        if query.get(key) != [expected_value]:
            fail(f"{label}.url query mismatch for {key}: {query.get(key)!r}, expected {[expected_value]!r}")


def normalize_entries(matrix: Mapping[str, object], *, require_raw: bool) -> dict[tuple[str, str, str, str, str], dict]:
    conditions = matrix.get("conditions")
    if not isinstance(conditions, Mapping):
        fail("capture matrix must contain conditions")
    for key, expected in REQUIRED_CONDITIONS.items():
        if conditions.get(key) != expected:
            fail(f"capture condition mismatch {key}: {conditions.get(key)!r}, expected {expected!r}")
    entries = matrix.get("entries")
    if not isinstance(entries, list):
        fail("capture matrix entries must be an array")
    expected_keys = expected_capture_keys()
    normalized: dict[tuple[str, str, str, str, str], dict] = {}
    paths: set[str] = set()
    urls: set[str] = set()
    for index, original in enumerate(entries):
        label = f"entries[{index}]"
        if not isinstance(original, Mapping):
            fail(f"{label} must be an object")
        entry = dict(original)
        try:
            key = tuple(str(entry[field]) for field in ("candidate", "viewport", "theme", "view", "distance"))
        except KeyError as error:
            fail(f"{label} is missing {error.args[0]!r}")
        if key not in expected_keys or key in normalized:
            fail(f"unexpected or duplicate capture condition: {key}")
        candidate, viewport_name, _theme, view, _distance = key
        if entry.get("queryCandidate") != CANDIDATE_QUERIES[candidate]:
            fail(f"{label}.queryCandidate does not match {candidate}")
        camera_preset = entry.get("cameraPreset")
        if camera_preset not in VIEW_CAMERA_ALIASES[view]:
            fail(f"{label}.cameraPreset {camera_preset!r} is not valid for {view}")
        width, height = (int(value) for value in viewport_name.split("x"))
        if entry.get("width") != width or entry.get("height") != height:
            fail(f"{label} dimensions do not match {viewport_name}")
        validate_url(entry, conditions, label)
        if str(entry.get("url")) in urls:
            fail(f"duplicate capture URL: {entry.get('url')}")
        urls.add(str(entry.get("url")))
        payload = extract_capture_payload(entry, label)
        if payload["viewport"]["width"] != width or payload["viewport"]["height"] != height:
            fail(f"{label}.report viewport does not match {viewport_name}")
        path_field = "rawPath" if require_raw else "image"
        path_value = entry.get(path_field)
        if not isinstance(path_value, str) or not path_value or Path(path_value).is_absolute() or ".." in Path(path_value).parts:
            fail(f"unsafe {path_field} in {label}: {path_value!r}")
        if path_value in paths:
            fail(f"duplicate {path_field}: {path_value}")
        paths.add(path_value)
        normalized[key] = {"entry": entry, **payload}
    if len(entries) != EXPECTED_CAPTURE_COUNT or set(normalized) != expected_keys:
        fail(
            f"capture matrix mismatch: entries={len(entries)}, expected={EXPECTED_CAPTURE_COUNT}, "
            f"missing={sorted(expected_keys - set(normalized))[:10]}, extra={sorted(set(normalized) - expected_keys)[:10]}"
        )
    validate_capture_invariants(normalized)
    return normalized


def validate_capture_invariants(normalized: Mapping[tuple[str, str, str, str, str], dict]) -> None:
    for viewport, theme, view, distance in product(VIEWPORTS, THEMES, VIEWS, DISTANCES):
        reference = normalized[("d2a", viewport, theme, view, distance)]
        for candidate in CANDIDATES[1:]:
            row = normalized[(candidate, viewport, theme, view, distance)]
            if not close(row["viewport"]["devicePixelRatio"], reference["viewport"]["devicePixelRatio"]) or not close(row["viewport"]["renderPixelRatio"], reference["viewport"]["renderPixelRatio"]):
                fail(f"DPR differs across candidates at {(viewport, theme, view, distance, candidate)}")
            for field in ("position", "quaternion", "target"):
                if not vectors_close(row["camera"][field], reference["camera"][field]):
                    fail(f"camera {field} differs across candidates at {(viewport, theme, view, distance, candidate)}")
            if not close(row["camera"]["distance"], reference["camera"]["distance"], VECTOR_TOLERANCE):
                fail(f"camera distance differs across candidates at {(viewport, theme, view, distance, candidate)}")
            if not vectors_close(row["modelCenter"], reference["modelCenter"]):
                fail(f"model center differs across candidates at {(viewport, theme, view, distance, candidate)}")
            watch_count_delta = abs(row["watchSilhouette"]["sampleCount"] - reference["watchSilhouette"]["sampleCount"])
            if watch_count_delta > max(4, math.ceil(reference["watchSilhouette"]["sampleCount"] * 1e-4)):
                fail(f"watch silhouette mask differs across candidates at {(viewport, theme, view, distance, candidate)}")
            for region in REGIONS:
                reference_count = reference["regions"][region]["sampleCount"]
                count_delta = abs(row["regions"][region]["sampleCount"] - reference_count)
                if count_delta > max(4, math.ceil(reference_count * 1e-4)):
                    fail(f"visibleSurface mask differs across candidates at {(viewport, theme, view, distance, candidate, region)}")
    for candidate, viewport, theme, view in product(CANDIDATES, VIEWPORTS, THEMES, VIEWS):
        distance_rows = {distance: normalized[(candidate, viewport, theme, view, distance)] for distance in DISTANCES}
        distances = {name: row["camera"]["distance"] for name, row in distance_rows.items()}
        ordered = (
            distances["initial"] < distances["near"] < distances["far"]
            if view in {"winding", "motion-works"}
            else distances["near"] < distances["initial"] < distances["far"]
        )
        if not ordered:
            fail(f"camera distances are not ordered near/initial/far at {(candidate, viewport, theme, view)}")
        initial = normalized[(candidate, viewport, theme, view, "initial")]
        for distance in DISTANCES:
            row = normalized[(candidate, viewport, theme, view, distance)]
            if set(row["rectLights"]) != set(initial["rectLights"]):
                fail(f"RectAreaLight set changes with zoom at {(candidate, viewport, theme, view, distance)}")
            for name, base_light in initial["rectLights"].items():
                light = row["rectLights"][name]
                if any(not vectors_close(light[field], base_light[field]) for field in ("position", "quaternion", "size")):
                    fail(f"world-fixed light transform changes with zoom at {(candidate, viewport, theme, view, distance, name)}")
                if not close(light["intensity"], base_light["intensity"]) or not close(light["distanceToModel"], base_light["distanceToModel"], VECTOR_TOLERANCE):
                    fail(f"world-fixed light intensity/radius changes with zoom at {(candidate, viewport, theme, view, distance, name)}")
    for candidate in CANDIDATES:
        reference = normalized[(candidate, VIEWPORTS[0], THEMES[0], VIEWS[0], "initial")]
        for viewport, theme, view, distance in product(VIEWPORTS, THEMES, VIEWS, DISTANCES):
            row = normalized[(candidate, viewport, theme, view, distance)]
            for name, base_light in reference["rectLights"].items():
                light = row["rectLights"][name]
                if any(not vectors_close(light[field], base_light[field]) for field in ("position", "quaternion", "size")):
                    fail(f"{candidate} is not a fully world-fixed studio at {(viewport, theme, view, distance, name)}")
                if not close(light["intensity"], base_light["intensity"]) or not close(light["distanceToModel"], base_light["distanceToModel"], VECTOR_TOLERANCE):
                    fail(f"{candidate} changes direct-light balance/radius at {(viewport, theme, view, distance, name)}")


def profile_rows(value: object) -> list[Mapping[str, object]]:
    if isinstance(value, Mapping):
        if isinstance(value.get("entries"), list):
            return [item for item in value["entries"] if isinstance(item, Mapping)]
        rows = []
        for candidate, item in value.items():
            if isinstance(item, Mapping):
                rows.append({"candidate": candidate, **item})
        return rows
    if isinstance(value, list):
        return [item for item in value if isinstance(item, Mapping)]
    return []


def load_candidate_profiles(matrix: Mapping[str, object]) -> dict[str, dict]:
    source = matrix.get("candidateProfiles")
    if source is None:
        candidates = (
            TEMP / "reports/lighting/candidate-profiles.json",
            TEMP / "candidate-profiles.json",
            TEMP / "candidate-profiles.checkpoint.json",
        )
        path = next((candidate for candidate in candidates if candidate.exists()), candidates[0])
        source = load_json(path, "candidate profile report")
    profiles: dict[str, dict] = {}
    for index, row in enumerate(profile_rows(source)):
        candidate = normalize_candidate(row.get("candidate", row.get("queryCandidate")))
        if candidate not in CANDIDATES or candidate in profiles:
            fail(f"unexpected or duplicate candidate profile at row {index}: {candidate!r}")
        studio = row.get("studio") if isinstance(row.get("studio"), Mapping) else row
        assert isinstance(studio, Mapping)
        validate_candidate_profile(candidate, studio, f"candidateProfiles.{candidate}")
        profiles[candidate] = dict(studio)
    if set(profiles) != set(CANDIDATES):
        fail(f"candidate profile coverage mismatch: missing={sorted(set(CANDIDATES) - set(profiles))}")
    return profiles


def named_rows(value: object, label: str) -> dict[str, Mapping[str, object]]:
    if not isinstance(value, list):
        fail(f"{label} must be an array")
    result: dict[str, Mapping[str, object]] = {}
    for index, row in enumerate(value):
        if not isinstance(row, Mapping) or not isinstance(row.get("name"), str):
            fail(f"{label}[{index}] must have a name")
        if row["name"] in result:
            fail(f"{label} contains duplicate {row['name']!r}")
        result[str(row["name"])] = row
    return result


def validate_panel_rows(actual_value: object, expected_rows: Sequence[Mapping[str, object]], label: str) -> None:
    actual = named_rows(actual_value, label)
    if set(actual) != {str(row["name"]) for row in expected_rows}:
        fail(f"{label} names do not match the audited layout")
    for expected in expected_rows:
        row = actual[str(expected["name"])]
        if str(row.get("color", "")).lower() != expected["color"]:
            fail(f"{label}.{expected['name']}.color does not match the audited layout")
        for field in ("size", "position"):
            if not vectors_close(finite_vector(row.get(field), len(expected[field]), f"{label}.{expected['name']}.{field}"), expected[field], 1e-9):
                fail(f"{label}.{expected['name']}.{field} does not match the audited layout")
        if "radiance" in expected and not close(finite_number(row.get("radiance"), f"{label}.{expected['name']}.radiance"), float(expected["radiance"])):
            fail(f"{label}.{expected['name']}.radiance does not match the audited layout")


def validate_candidate_profile(candidate: str, studio: Mapping[str, object], label: str) -> None:
    expected = EXPECTED_PROFILES[candidate]
    if studio.get("candidate") not in {candidate, CANDIDATE_QUERIES[candidate]}:
        fail(f"{label}.candidate does not match {candidate}")
    if studio.get("studioProfile") != CANDIDATE_PROFILES[candidate]:
        fail(f"{label}.studioProfile does not match {CANDIDATE_PROFILES[candidate]!r}")
    if studio.get("placementStrategy") != "world-fixed" or studio.get("cameraDistanceInvariant") is not True:
        fail(f"{label} must retain D2a world-fixed, camera-distance-invariant placement")
    if studio.get("shadowCarrier") is not None or studio.get("pointLightActive") is not False:
        fail(f"{label} must not add D3 shadow carrier or PointLight")
    environment = studio.get("environment")
    if not isinstance(environment, Mapping):
        fail(f"{label}.environment is missing")
    required_environment = {"source": "PMREMGenerator.fromScene", "sigma": 0.04, "near": 0.1, "far": 100, "background": "#080808"}
    for field, expected_value in required_environment.items():
        actual = environment.get(field)
        if isinstance(expected_value, float):
            matched = close(finite_number(actual, f"{label}.environment.{field}"), expected_value)
        else:
            matched = actual == expected_value
        if not matched:
            fail(f"{label}.environment.{field} changed from the audited PMREM setup")
    ambient = environment.get("ambientSurface")
    if not isinstance(ambient, Mapping):
        fail(f"{label}.environment.ambientSurface is missing")
    for field in ("roomColor", "floorColor"):
        if str(ambient.get(field, "")).lower() != expected[field]:
            fail(f"{label}.environment.ambientSurface.{field} does not match the audited value")
    if str(ambient.get("color", "")).lower() != expected["roomColor"]:
        fail(f"{label}.environment.ambientSurface.color does not match roomColor")
    scalar_expectations = {"floorRadiance": expected["floorRadiance"], "roomRadius": 70}
    for field, expected_value in scalar_expectations.items():
        if not close(finite_number(ambient.get(field), f"{label}.ambientSurface.{field}"), float(expected_value)):
            fail(f"{label}.environment.ambientSurface.{field} changed")
    if not vectors_close(finite_vector(ambient.get("floorSize"), 2, f"{label}.ambientSurface.floorSize"), (96, 96), 1e-9) or not vectors_close(finite_vector(ambient.get("floorPosition"), 3, f"{label}.ambientSurface.floorPosition"), (0, 0, -24), 1e-9):
        fail(f"{label}.environment ambient floor geometry changed")
    validate_panel_rows(environment.get("panels"), BASE_PANELS, f"{label}.environment.panels")
    validate_panel_rows(environment.get("flags"), expected["flags"], f"{label}.environment.flags")
    rect_lights = normalize_rect_lights(studio.get("rectLights"), f"{label}.rectLights")
    if set(rect_lights) != {row["name"] for row in expected["rectLights"]}:
        fail(f"{label}.rectLights do not match the audited candidate")
    for expected_light in expected["rectLights"]:
        validate_expected_light(candidate, rect_lights[expected_light["name"]], expected_light, f"{label}.{expected_light['name']}")
    balance = studio.get("directLightBalance")
    if not isinstance(balance, Mapping):
        fail(f"{label}.directLightBalance is missing")
    key, fill = expected["rectLights"][:2]
    expected_balance = {
        "keyIntensity": key["intensity"],
        "fillIntensity": fill["intensity"],
        "keyToFillRatio": key["intensity"] / fill["intensity"],
        "keyArea": key["size"][0] * key["size"][1],
        "fillArea": fill["size"][0] * fill["size"][1],
        "lowerBounceIntensity": expected["rectLights"][2]["intensity"] if len(expected["rectLights"]) == 3 else 0,
        "lowerBounceToKeyRatio": expected["rectLights"][2]["intensity"] / key["intensity"] if len(expected["rectLights"]) == 3 else 0,
    }
    for field, expected_value in expected_balance.items():
        if not close(finite_number(balance.get(field), f"{label}.directLightBalance.{field}"), float(expected_value)):
            fail(f"{label}.directLightBalance.{field} is inconsistent")


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
        candidate, viewport, theme, view, distance = (str(entry[field]) for field in ("candidate", "viewport", "theme", "view", "distance"))
        source = safe_temp_path(str(entry["rawPath"]), f"entries[{index}].rawPath")
        if not source.exists():
            fail(f"missing raw browser JPEG: {source}")
        expected_size = tuple(int(value) for value in viewport.split("x"))
        with Image.open(source) as image:
            if source.suffix.lower() not in {".jpg", ".jpeg"} or image.format != "JPEG" or source.read_bytes()[:3] != b"\xff\xd8\xff":
                fail(f"raw capture is not a browser JPEG: {source}")
            if image.size != expected_size:
                fail(f"unexpected screenshot size {source}: {image.size}, expected {expected_size}")
        output = CAPTURES / candidate / viewport / theme / view / distance / capture_filename(candidate, theme, view, distance, viewport)
        output.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, output)
        report = entry["report"]
        assert isinstance(report, Mapping)
        compact_report = {
            key: report[key]
            for key in (
                "candidate", "queryCandidate", "theme", "view", "cameraPreset", "distance",
                "distanceProfile", "camera", "viewport", "modelCenter", "fog", "environmentIntensity",
                "environment", "placementStrategy", "studioProfile", "rectLights", "watchSilhouette",
                "background", "watchToBackground",
            )
            if key in report
        }
        compact_report["regions"] = {
            region: {
                "meshCount": report["regions"][region].get("meshCount"),
                "visibleSurface": report["regions"][region].get("visibleSurface"),
            }
            for region in REGIONS
        }
        startup = report.get("startup")
        if isinstance(startup, Mapping):
            compact_report["startup"] = {
                "queryPreserved": startup.get("queryPreserved"),
                "gateSatisfied": startup.get("gateSatisfied"),
            }
        committed = {key: value for key, value in entry.items() if key not in {"rawPath", "report"}}
        committed["report"] = compact_report
        committed.update({"image": str(output.relative_to(ROOT)), "rawSource": "temporary-browser-jpeg-not-committed"})
        converted.append(committed)
    return converted


def load_font(size: int = 17) -> ImageFont.ImageFont:
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def labeled_cell(image: Image.Image, label: str, max_width: int) -> Image.Image:
    if image.width > max_width:
        image = image.resize((max_width, round(image.height * max_width / image.width)), Image.Resampling.LANCZOS)
    else:
        image = image.copy()
    cell = Image.new("RGB", (image.width, image.height + 38), "#11151b")
    cell.paste(image, (0, 38))
    ImageDraw.Draw(cell).text((10, 9), label, fill="#f5f7fa", font=load_font())
    return cell


def build_comparison_board(grid: list[list[tuple[str, Image.Image]]], output: Path, max_width: int) -> None:
    cells = [[labeled_cell(image, label, max_width) for label, image in row] for row in grid]
    widths = [max(cells[row][column].width for row in range(len(cells))) for column in range(len(cells[0]))]
    heights = [max(cell.height for cell in row) for row in cells]
    board = Image.new("RGB", (sum(widths), sum(heights)), "#0d1015")
    y = 0
    for row_index, row in enumerate(cells):
        x = 0
        for column_index, cell in enumerate(row):
            board.paste(cell, (x, y))
            x += widths[column_index]
        y += heights[row_index]
    output.parent.mkdir(parents=True, exist_ok=True)
    board.save(output, "JPEG", quality=90, optimize=True, progressive=True)
    board.close()
    for row in cells:
        for cell in row:
            cell.close()


def build_comparisons() -> None:
    labels = {"d2a": "D2A BASE", "d2c1": "D2C1", "d2c2": "D2C2", "d2c3": "D2C3"}
    for viewport, theme, view in product(VIEWPORTS, THEMES, VIEWS):
        grid: list[list[tuple[str, Image.Image]]] = []
        for distance in DISTANCES:
            row = []
            for candidate in CANDIDATES:
                path = CAPTURES / candidate / viewport / theme / view / distance / capture_filename(candidate, theme, view, distance, viewport)
                row.append((f"{labels[candidate]} · {distance.upper()}", Image.open(path).convert("RGB")))
            grid.append(row)
        output = COMPARISONS / viewport / theme / comparison_filename(theme, view, viewport)
        build_comparison_board(grid, output, max_width=285 if viewport == "1280x720" else 230)
        for row in grid:
            for _label, image in row:
                image.close()


def relative_metric(value: Mapping[str, object], baseline: Mapping[str, object]) -> dict:
    result = {}
    for field in METRIC_FIELDS:
        current = float(value[field])
        base = float(baseline[field])
        result[field] = {"delta": current - base, "ratio": current / base if abs(base) > 1e-12 else None}
    result["directionalImprovement"] = {
        "medianHigher": float(value["medianLuminance"]) > float(baseline["medianLuminance"]),
        "p25Higher": float(value["p25Luminance"]) > float(baseline["p25Luminance"]),
        "darkRatioLower": float(value["darkRatio"]) < float(baseline["darkRatio"]),
        "clippedRatioNotHigher": float(value["clippedRatio"]) <= float(baseline["clippedRatio"]) + 1e-12,
    }
    return result


def build_midtone_reports(normalized: Mapping[tuple[str, str, str, str, str], dict]) -> None:
    silhouette_rows = []
    surface_rows = []
    for candidate, viewport, theme, view, distance in product(CANDIDATES, VIEWPORTS, THEMES, VIEWS, DISTANCES):
        row = normalized[(candidate, viewport, theme, view, distance)]
        baseline = normalized[("d2a", viewport, theme, view, distance)]
        common = {"candidate": candidate, "queryCandidate": CANDIDATE_QUERIES[candidate], "viewport": viewport, "theme": theme, "view": view, "distance": distance}
        silhouette_rows.append({
            **common,
            "watchSilhouette": row["watchSilhouette"],
            "background": row["background"],
            "watchToBackground": {
                "medianDifference": float(row["watchSilhouette"]["medianLuminance"]) - float(row["background"]["medianLuminance"]),
                "p25ToBackgroundP75": float(row["watchSilhouette"]["p25Luminance"]) - float(row["background"]["p75Luminance"]),
            },
            "relativeToD2a": relative_metric(row["watchSilhouette"], baseline["watchSilhouette"]),
            "relativeAdoptionGateScope": distance in {"initial", "far"},
        })
        surface_rows.append({**common, "regions": row["regions"]})
    midtone = REPORTS / "midtone"
    midtone.mkdir(parents=True, exist_ok=True)
    (midtone / "watch-silhouette.json").write_text(json.dumps({
        "schema": "issue2-phase2a2-watch-silhouette-v1",
        "baseline": "d2a",
        "fixedAbsoluteThresholdUsedForAdoption": False,
        "relativeReview": "median/p25 improvement, dark-ratio reduction, clipped/p90 restraint, and physical-device appearance",
        "entries": silhouette_rows,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (midtone / "visible-surfaces.json").write_text(json.dumps({
        "schema": "issue2-phase2a2-visible-surfaces-v1",
        "method": "composited-frame visibleSurface object-mask metrics",
        "regions": list(REGIONS),
        "regionDefinitions": {
            "dial": "dialRing and dial marker meshes",
            "hands": "minute, hour, and small-seconds hand axes",
            "brassTrain": "barrel, center, and third-wheel roots",
            "steelTrain": "fourth, escape, and pallet roots",
            "ruby": "watch-root meshes using the shared ruby material",
            "plate": "mainPlate root",
            "outerBezel": "simplified outer contour: dialRing plus upper/lower plate-edge rings; the model has no separate case/bezel Object3D",
        },
        "entries": surface_rows,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    def summarize_delta(values: Sequence[float], *, direction: str) -> dict:
        improved = sum(value > 1e-12 for value in values) if direction == "higher" else sum(value < -1e-12 for value in values)
        non_worse = sum(value >= -1e-12 for value in values) if direction == "higher" else sum(value <= 1e-12 for value in values)
        return {
            "meanDelta": sum(values) / len(values),
            "minimumDelta": min(values),
            "maximumDelta": max(values),
            "improvedCount": improved,
            "nonWorseCount": non_worse,
            "conditionCount": len(values),
        }

    decision_rows = []
    for candidate in CANDIDATES[1:]:
        comparisons = []
        for viewport, theme, view, distance in product(VIEWPORTS, THEMES, VIEWS, ("initial", "far")):
            current = normalized[(candidate, viewport, theme, view, distance)]["watchSilhouette"]
            baseline = normalized[("d2a", viewport, theme, view, distance)]["watchSilhouette"]
            comparisons.append({field: float(current[field]) - float(baseline[field]) for field in METRIC_FIELDS if field != "sampleCount"})
        median = summarize_delta([row["medianLuminance"] for row in comparisons], direction="higher")
        p25 = summarize_delta([row["p25Luminance"] for row in comparisons], direction="higher")
        dark = summarize_delta([row["darkRatio"] for row in comparisons], direction="lower")
        clipped = summarize_delta([row["clippedRatio"] for row in comparisons], direction="lower")
        p90_values = [row["p90Luminance"] for row in comparisons]
        near_rows = [normalized[(candidate, viewport, theme, view, "near")]["watchSilhouette"] for viewport, theme, view in product(VIEWPORTS, THEMES, VIEWS)]
        automatic_gate = {
            "medianHigherAll": median["improvedCount"] == median["conditionCount"],
            "p25HigherAll": p25["improvedCount"] == p25["conditionCount"],
            "darkRatioLowerAll": dark["improvedCount"] == dark["conditionCount"],
            "clippedRatioNotHigherAll": clipped["nonWorseCount"] == clipped["conditionCount"],
        }
        decision_rows.append({
            "candidate": candidate,
            "queryCandidate": CANDIDATE_QUERIES[candidate],
            "comparisonScope": {"distances": ["initial", "far"], "conditionCount": len(comparisons)},
            "relativeToD2a": {
                "medianLuminance": median,
                "p25Luminance": p25,
                "darkRatio": dark,
                "clippedRatio": clipped,
                "p90Luminance": {"meanDelta": sum(p90_values) / len(p90_values), "minimumDelta": min(p90_values), "maximumDelta": max(p90_values)},
            },
            "near": {
                "conditionCount": len(near_rows),
                "maximumClippedRatio": max(float(row["clippedRatio"]) for row in near_rows),
                "maximumP90Luminance": max(float(row["p90Luminance"]) for row in near_rows),
            },
            "automaticRelativeGate": automatic_gate,
            "eligibleForPhysicalReview": all(automatic_gate.values()),
            "physicalIPhoneReviewRequired": True,
            "defaultAdoptionAllowed": False,
        })
    (midtone / "decision-summary.json").write_text(json.dumps({
        "schema": "issue2-phase2a2-decision-summary-v1",
        "baseline": "d2a",
        "fixedAbsoluteThresholdUsedForAdoption": False,
        "visualBoardReviewRequired": True,
        "physicalIPhoneReviewRequired": True,
        "candidates": decision_rows,
    }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def svg_projection(position: Sequence[float], axes: tuple[int, int], origin: tuple[float, float], scale: float) -> tuple[float, float]:
    return origin[0] + position[axes[0]] * scale, origin[1] - position[axes[1]] * scale


def build_layout_svg(candidate: str, studio: Mapping[str, object]) -> str:
    environment = studio["environment"]
    assert isinstance(environment, Mapping)
    objects = []
    for kind, rows in (("panel", environment["panels"]), ("flag", environment["flags"]), ("light", studio["rectLights"])):
        assert isinstance(rows, list)
        for row in rows:
            assert isinstance(row, Mapping)
            objects.append((kind, row))
    colors = {"panel": "#f4d35e", "flag": "#4e5968", "light": "#71c4ff"}
    chunks = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="620" viewBox="0 0 1000 620">',
        '<rect width="1000" height="620" fill="#0d1117"/>',
        f'<text x="30" y="42" fill="#f5f7fa" font-family="sans-serif" font-size="24">{html.escape(candidate.upper())} · audited studio placement</text>',
        '<text x="250" y="82" fill="#aeb6c2" font-family="sans-serif" font-size="17" text-anchor="middle">Top X/Y</text>',
        '<text x="750" y="82" fill="#aeb6c2" font-family="sans-serif" font-size="17" text-anchor="middle">Front X/Z</text>',
        '<rect x="30" y="95" width="440" height="440" fill="#131922" stroke="#394453"/>',
        '<rect x="530" y="95" width="440" height="440" fill="#131922" stroke="#394453"/>',
    ]
    for origin in ((250, 315), (750, 315)):
        chunks.append(f'<circle cx="{origin[0]}" cy="{origin[1]}" r="26" fill="#c9a96e" stroke="#f1d399" stroke-width="2"/>')
        chunks.append(f'<line x1="{origin[0]-205}" y1="{origin[1]}" x2="{origin[0]+205}" y2="{origin[1]}" stroke="#2b3542"/>')
        chunks.append(f'<line x1="{origin[0]}" y1="{origin[1]-205}" x2="{origin[0]}" y2="{origin[1]+205}" stroke="#2b3542"/>')
    for kind, row in objects:
        position = finite_vector(row.get("position"), 3, f"layout.{candidate}.{row.get('name')}.position")
        for axes, origin in (((0, 1), (250, 315)), ((0, 2), (750, 315))):
            x, y = svg_projection(position, axes, origin, 5.1)
            chunks.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="9" fill="{colors[kind]}" stroke="#ffffff" stroke-width="1"/>')
            chunks.append(f'<text x="{x+12:.2f}" y="{y+5:.2f}" fill="#d7dee8" font-family="sans-serif" font-size="11">{html.escape(str(row.get("name")))}</text>')
    chunks.extend([
        '<text x="32" y="570" fill="#aeb6c2" font-family="sans-serif" font-size="14">Gold = PMREM white panel · gray = retained dark flag · blue = shadowless RectAreaLight</text>',
        '<text x="32" y="596" fill="#aeb6c2" font-family="sans-serif" font-size="14">Model at origin. Coordinates are browser-reported world positions; diagrams are diagnostic, not photometric.</text>',
        '</svg>',
    ])
    return "\n".join(chunks) + "\n"


def build_layout_reports(profiles: Mapping[str, Mapping[str, object]]) -> None:
    LIGHT_LAYOUTS.mkdir(parents=True, exist_ok=True)
    layout_entries = []
    profile_entries = []
    for candidate in CANDIDATES:
        studio = profiles[candidate]
        path = LIGHT_LAYOUTS / f"{candidate}-studio-layout.svg"
        path.write_text(build_layout_svg(candidate, studio), encoding="utf-8")
        layout_entries.append({
            "candidate": candidate,
            "queryCandidate": CANDIDATE_QUERIES[candidate],
            "studioProfile": CANDIDATE_PROFILES[candidate],
            "path": str(path.relative_to(EVIDENCE)),
            "environment": studio["environment"],
            "rectLights": studio["rectLights"],
            "directLightBalance": studio["directLightBalance"],
        })
        profile_entries.append({
            **studio,
            "candidate": candidate,
            "queryCandidate": CANDIDATE_QUERIES[candidate],
        })
    target = REPORTS / "lighting"
    target.mkdir(parents=True, exist_ok=True)
    (target / "candidate-profiles.json").write_text(json.dumps({"schema": "issue2-phase2a2-candidate-profiles-v1", "entries": profile_entries}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (target / "layouts.json").write_text(json.dumps({"schema": "issue2-phase2a2-light-layouts-v1", "entries": layout_entries}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def report_rows(report: Mapping[str, object], label: str) -> list:
    for key in ("entries", "rows", "runs", "groups"):
        if isinstance(report.get(key), list):
            return report[key]
    fail(f"{label} must contain entries, rows, runs, or groups")
    return []


def validate_browser_report(report: Mapping[str, object]) -> None:
    node = report.get("node")
    if not isinstance(node, Mapping) or node.get("total") != 33 or node.get("passed") != 33 or node.get("failed") != 0:
        fail("browser report must record Node 33/33")
    runs = [row for row in report_rows(report, "browser report") if isinstance(row, Mapping) and row.get("source") == "Phase 2A.2 current head"]
    expected = {
        *product(("browser",), ("baseline", *CANDIDATES), ("1280x720", "390x844")),
        *product(("rendering",), CANDIDATES, VIEWPORTS),
        *product(("ui",), ("baseline",), ("1280x720", "390x844", "375x667")),
        *product(("hud",), ("baseline",), ("1280x720", "390x844", "393x852", "375x667")),
    }
    known_baseline_mobile = ("browser", "baseline", "390x844")
    known_baseline_failure = ["a5-all-background-themes-keep-front-back-luminance-within-thirty-percent"]
    actual: set[tuple[str, str, str]] = set()
    for row in runs:
        key = (str(row.get("suite")), str(row.get("candidate")), str(row.get("viewport")))
        if key not in expected or key in actual:
            fail(f"unexpected or duplicate current browser run: {key}")
        actual.add(key)
        payload = row.get("report")
        allowed = row.get("allowedFailures")
        expected_failed = known_baseline_failure if key == known_baseline_mobile else []
        if not isinstance(payload, Mapping) or row.get("expectedResult") is not True or allowed != expected_failed or payload.get("failed") != expected_failed or payload.get("ok") != (key != known_baseline_mobile):
            fail(f"browser run did not pass: {key}")
        if key[0] == "browser":
            a7 = payload.get("a7")
            drift = payload.get("drift")
            if not isinstance(a7, Mapping) or a7.get("passed") != 9 or a7.get("total") != 9 or a7.get("failed") != []:
                fail(f"browser run regressed A.7: {key}")
            if not isinstance(drift, Mapping) or drift.get("hold") != 0 or drift.get("cycles") != 0 or drift.get("frameRates") is not True:
                fail(f"browser run regressed keyless drift: {key}")
            if payload.get("windForbidden") != 0 or payload.get("setForbidden") != 0:
                fail(f"browser run regressed forbidden interference: {key}")
    if actual != expected:
        fail(f"browser report coverage mismatch: missing={sorted(expected - actual)}, extra={sorted(actual - expected)}")


def validate_performance_report(report: Mapping[str, object]) -> None:
    runs = [row for row in report_rows(report, "performance report") if isinstance(row, Mapping) and row.get("source") == "Phase 2A.2 current head"]
    expected = set(product(CANDIDATES, ("1280x720", "390x844"), ("pointer-rotate", "wheel-zoom", "opacity-idle")))
    actual: set[tuple[str, str, str]] = set()
    for row in runs:
        key = (str(row.get("candidate")), str(row.get("viewport")), str(row.get("scenario")))
        if key not in expected or key in actual:
            fail(f"unexpected or duplicate performance run: {key}")
        actual.add(key)
        payload = row.get("report")
        pacing = payload.get("pacing") if isinstance(payload, Mapping) else None
        if not isinstance(payload, Mapping) or not isinstance(pacing, Mapping) or row.get("expectedResult") is not True or payload.get("modelInvariant") is not True:
            fail(f"incomplete performance run: {key}")
        average_fps = finite_number(pacing.get("averageFps"), f"performance {key}.averageFps")
        p50 = finite_number(pacing.get("p50"), f"performance {key}.p50")
        p95 = finite_number(pacing.get("p95"), f"performance {key}.p95")
        p99 = finite_number(pacing.get("p99"), f"performance {key}.p99")
        over33 = finite_number(pacing.get("over33"), f"performance {key}.over33")
        over50 = finite_number(pacing.get("over50"), f"performance {key}.over50")
        callbacks = finite_number(pacing.get("callbackCount"), f"performance {key}.callbackCount")
        if callbacks <= 0:
            fail(f"performance run captured no frames: {key}")
        if key[1] == "1280x720":
            passed = average_fps >= 55 and p50 <= 18 and p95 <= 25 and p99 <= 40 and over50 <= 1 and over33 / callbacks < 0.05
        else:
            passed = average_fps >= 45 and p95 <= 33.3 and over50 / callbacks < 0.02
        if not passed:
            fail(f"performance run exceeds the unchanged A.6 threshold: {key}")
        if key[2] == "pointer-rotate":
            motion = payload.get("motion")
            if not isinstance(motion, Mapping) or motion.get("finite") is not True or motion.get("reversalCount") != 0 or motion.get("stopThenJumpCount") != 0:
                fail(f"pointer run regressed camera smoothness: {key}")
        if key[2] == "wheel-zoom":
            zoom = payload.get("zoom")
            if not isinstance(zoom, Mapping) or zoom.get("finite") is not True or zoom.get("monotonic") is not True or finite_number(zoom.get("maxStepShare"), f"performance {key}.maxStepShare") > 0.08:
                fail(f"wheel run regressed zoom smoothness: {key}")
    if actual != expected:
        fail(f"performance report coverage mismatch: missing={sorted(expected - actual)}, extra={sorted(actual - expected)}")


def copy_and_validate_regression_reports() -> None:
    source = TEMP / "reports"
    browser_source = source / "browser-report.json"
    performance_source = source / "performance/summary.json"
    browser = load_json(browser_source, "browser regression report")
    performance = load_json(performance_source, "performance report")
    validate_browser_report(browser)
    validate_performance_report(performance)
    REPORTS.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(browser_source, REPORTS / "browser-report.json")
    (REPORTS / "performance").mkdir(parents=True, exist_ok=True)
    shutil.copyfile(performance_source, REPORTS / "performance/summary.json")


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


def artifact_paths() -> tuple[list[Path], list[Path], list[Path]]:
    return sorted(CAPTURES.rglob("*.jpg")), sorted(COMPARISONS.rglob("*.jpg")), sorted(LIGHT_LAYOUTS.rglob("*.svg"))


def validate_evidence_path_scope(paths: Sequence[Path]) -> None:
    allowed_files = {"README.md", "capture-matrix.json"}
    allowed_directories = {"captures", "comparisons", "reports", "light-layouts"}
    for path in paths:
        relative = path.relative_to(EVIDENCE)
        if len(relative.parts) == 1:
            if relative.name not in allowed_files:
                fail(f"unexpected top-level Phase 2A.2 evidence file: {relative}")
        elif relative.parts[0] not in allowed_directories:
            fail(f"unexpected Phase 2A.2 evidence path: {relative}")


def validate_artifact_counts() -> None:
    captures, comparisons, layouts = artifact_paths()
    if len(captures) != EXPECTED_CAPTURE_COUNT:
        fail(f"expected {EXPECTED_CAPTURE_COUNT} JPEG masters, found {len(captures)}")
    if len(comparisons) != EXPECTED_COMPARISON_COUNT:
        fail(f"expected {EXPECTED_COMPARISON_COUNT} comparison boards, found {len(comparisons)}")
    if len(layouts) != EXPECTED_LIGHT_LAYOUT_COUNT:
        fail(f"expected {EXPECTED_LIGHT_LAYOUT_COUNT} placement SVGs, found {len(layouts)}")
    expected_names = {f"{candidate}-studio-layout.svg" for candidate in CANDIDATES}
    if {path.name for path in layouts} != expected_names:
        fail("placement SVG names do not match the four candidates")


def write_manifest() -> dict:
    files = sorted(path for path in EVIDENCE.rglob("*") if path.is_file() and path != MANIFEST)
    validate_evidence_path_scope(files)
    manifest = {
        "schema": "issue2-phase2a2-evidence-v1",
        "root": str(EVIDENCE.relative_to(ROOT)),
        "expectedCaptureCount": EXPECTED_CAPTURE_COUNT,
        "expectedComparisonCount": EXPECTED_COMPARISON_COUNT,
        "expectedLightLayoutCount": EXPECTED_LIGHT_LAYOUT_COUNT,
        "candidates": list(CANDIDATES),
        "viewports": list(VIEWPORTS),
        "themes": list(THEMES),
        "views": list(VIEWS),
        "distances": list(DISTANCES),
        "fileCount": len(files),
        "files": [file_record(path) for path in files],
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return manifest


def validate_derived_reports() -> None:
    silhouette = load_json(REPORTS / "midtone/watch-silhouette.json")
    surfaces = load_json(REPORTS / "midtone/visible-surfaces.json")
    decision = load_json(REPORTS / "midtone/decision-summary.json")
    layouts = load_json(REPORTS / "lighting/layouts.json")
    expected = expected_capture_keys()
    silhouette_rows = report_rows(silhouette, "watch silhouette report")
    silhouette_keys: set[tuple[str, str, str, str, str]] = set()
    for index, row in enumerate(silhouette_rows):
        if not isinstance(row, Mapping):
            fail(f"watch silhouette row {index} must be an object")
        key = tuple(str(row.get(field)) for field in ("candidate", "viewport", "theme", "view", "distance"))
        if key not in expected or key in silhouette_keys:
            fail(f"unexpected or duplicate watch silhouette row: {key}")
        silhouette_keys.add(key)
        normalize_metric(row.get("watchSilhouette"), f"watch silhouette {key}")
        normalize_metric(row.get("background"), f"watch silhouette {key}.background", allow_empty=True)
        relative = row.get("relativeToD2a")
        if not isinstance(relative, Mapping) or not isinstance(relative.get("directionalImprovement"), Mapping):
            fail(f"watch silhouette {key} is missing D2a-relative diagnostics")
        if row.get("relativeAdoptionGateScope") != (key[4] in {"initial", "far"}):
            fail(f"watch silhouette {key} has an incorrect relative gate scope")
    if len(silhouette_rows) != EXPECTED_CAPTURE_COUNT or silhouette_keys != expected:
        fail("watch silhouette report must contain one unique row per capture")

    surface_rows = report_rows(surfaces, "visible surfaces report")
    surface_keys: set[tuple[str, str, str, str, str]] = set()
    for index, row in enumerate(surface_rows):
        if not isinstance(row, Mapping):
            fail(f"visible surfaces row {index} must be an object")
        key = tuple(str(row.get(field)) for field in ("candidate", "viewport", "theme", "view", "distance"))
        if key not in expected or key in surface_keys:
            fail(f"unexpected or duplicate visible surfaces row: {key}")
        surface_keys.add(key)
        regions = row.get("regions")
        if not isinstance(regions, Mapping) or set(regions) != set(REGIONS):
            fail(f"visible surfaces row {key} does not contain the seven required regions")
        for region in REGIONS:
            metric = normalize_metric(regions[region], f"visible surfaces {key}.{region}", allow_empty=True)
            if metric.get("method") != "model-visible-surface-mask-pass":
                fail(f"visible surfaces {key}.{region} has an incorrect method")
            if int(finite_number(regions[region].get("meshCount"), f"visible surfaces {key}.{region}.meshCount")) <= 0:
                fail(f"visible surfaces {key}.{region} has no target meshes")
    if len(surface_rows) != EXPECTED_CAPTURE_COUNT or surface_keys != expected:
        fail("visible surfaces report must contain one unique row per capture")

    layout_rows = report_rows(layouts, "lighting layouts report")
    layout_candidates = {normalize_candidate(row.get("candidate")) for row in layout_rows if isinstance(row, Mapping)}
    if len(layout_rows) != EXPECTED_LIGHT_LAYOUT_COUNT or layout_candidates != set(CANDIDATES):
        fail("lighting layouts report must contain one row per candidate")

    decision_rows = decision.get("candidates")
    if not isinstance(decision_rows, list) or {normalize_candidate(row.get("candidate")) for row in decision_rows if isinstance(row, Mapping)} != set(CANDIDATES[1:]):
        fail("decision summary must contain D2c1, D2c2, and D2c3")
    for row in decision_rows:
        if not isinstance(row, Mapping) or not isinstance(row.get("automaticRelativeGate"), Mapping):
            fail("decision summary candidate row is incomplete")
        gate = row["automaticRelativeGate"]
        if row.get("eligibleForPhysicalReview") != all(value is True for value in gate.values()):
            fail("decision summary physical-review eligibility is inconsistent")


def check_manifest() -> None:
    manifest = load_json(MANIFEST, "Phase 2A.2 evidence manifest")
    if manifest.get("schema") != "issue2-phase2a2-evidence-v1" or manifest.get("root") != str(EVIDENCE.relative_to(ROOT)):
        fail("unexpected Phase 2A.2 manifest schema or root")
    expected_counts = {
        "expectedCaptureCount": EXPECTED_CAPTURE_COUNT,
        "expectedComparisonCount": EXPECTED_COMPARISON_COUNT,
        "expectedLightLayoutCount": EXPECTED_LIGHT_LAYOUT_COUNT,
    }
    for field, expected in expected_counts.items():
        if manifest.get(field) != expected:
            fail(f"manifest {field} mismatch")
    records = manifest.get("files")
    if not isinstance(records, list):
        fail("manifest files must be an array")
    recorded_paths = [record.get("path") for record in records if isinstance(record, Mapping)]
    actual_paths = {str(path.relative_to(ROOT)) for path in EVIDENCE.rglob("*") if path.is_file() and path != MANIFEST}
    validate_evidence_path_scope([ROOT / path for path in actual_paths])
    if manifest.get("fileCount") != len(records) or len(recorded_paths) != len(set(recorded_paths)) or set(recorded_paths) != actual_paths:
        fail("manifest is not closed-world or contains duplicate/stale paths")
    for record in records:
        if not isinstance(record, Mapping) or not isinstance(record.get("path"), str):
            fail("manifest contains an invalid record")
        path = ROOT / record["path"]
        if not path.exists():
            fail(f"manifest path missing: {path}")
        current = file_record(path)
        for field in ("bytes", "sha256", "mime", "dimensions"):
            if field in record or field in current:
                if record.get(field) != current.get(field):
                    fail(f"manifest mismatch {field}: {path}")
        if path.suffix.lower() == ".json":
            load_json(path)
        if path.suffix.lower() == ".svg":
            try:
                ElementTree.parse(path)
            except ElementTree.ParseError as error:
                fail(f"invalid SVG XML {path}: {error}")
    validate_artifact_counts()
    matrix = load_json(MATRIX, "committed capture matrix")
    if matrix.get("schema") != "issue2-phase2a2-capture-matrix-v1":
        fail("unexpected committed capture matrix schema")
    normalize_entries(matrix, require_raw=False)
    profiles_report = load_json(REPORTS / "lighting/candidate-profiles.json")
    profiles = {}
    for row in report_rows(profiles_report, "candidate profiles report"):
        if isinstance(row, Mapping):
            candidate = normalize_candidate(row.get("candidate"))
            if candidate in CANDIDATES:
                validate_candidate_profile(candidate, row, f"candidateProfiles.{candidate}")
                profiles[candidate] = row
    if set(profiles) != set(CANDIDATES):
        fail("committed candidate profiles are incomplete")
    validate_browser_report(load_json(REPORTS / "browser-report.json"))
    validate_performance_report(load_json(REPORTS / "performance/summary.json"))
    validate_derived_reports()
    print(json.dumps({"ok": True, "files": manifest["fileCount"], "captures": EXPECTED_CAPTURE_COUNT, "comparisons": EXPECTED_COMPARISON_COUNT, "lightLayouts": EXPECTED_LIGHT_LAYOUT_COUNT}, ensure_ascii=False))


def generate() -> None:
    source_matrix = load_json(TEMP / "capture-matrix.json", "browser capture matrix")
    normalized = normalize_entries(source_matrix, require_raw=True)
    profiles = load_candidate_profiles(source_matrix)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    for generated in (CAPTURES, COMPARISONS, REPORTS, LIGHT_LAYOUTS):
        if generated.exists():
            shutil.rmtree(generated)
    for generated_file in (MATRIX, MANIFEST):
        if generated_file.exists():
            generated_file.unlink()
    converted = convert_captures(source_matrix)
    committed_matrix = {
        **source_matrix,
        "schema": "issue2-phase2a2-capture-matrix-v1",
        "expectedCaptureCount": EXPECTED_CAPTURE_COUNT,
        "candidateProfiles": {candidate: profiles[candidate] for candidate in CANDIDATES},
        "entries": converted,
    }
    MATRIX.write_text(json.dumps(committed_matrix, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    build_comparisons()
    copy_and_validate_regression_reports()
    build_midtone_reports(normalized)
    build_layout_reports(profiles)
    validate_artifact_counts()
    validate_derived_reports()
    manifest = write_manifest()
    print(json.dumps({"generated": True, "files": manifest["fileCount"], "captures": EXPECTED_CAPTURE_COUNT, "comparisons": EXPECTED_COMPARISON_COUNT, "lightLayouts": EXPECTED_LIGHT_LAYOUT_COUNT}, ensure_ascii=False))


def print_capture_plan() -> None:
    """Print the canonical browser-harness plan without touching evidence."""

    entries = []
    for candidate, viewport, theme, view, distance in product(CANDIDATES, VIEWPORTS, THEMES, VIEWS, DISTANCES):
        width, height = (int(value) for value in viewport.split("x"))
        camera_preset = VIEW_CAMERAS[view]
        entries.append({
            "candidate": candidate,
            "queryCandidate": CANDIDATE_QUERIES[candidate],
            "viewport": viewport,
            "width": width,
            "height": height,
            "theme": theme,
            "view": view,
            "cameraPreset": camera_preset,
            "distance": distance,
            "rawPath": f"captures/{candidate}/{viewport}/{theme}/{view}/{distance}/{capture_filename(candidate, theme, view, distance, viewport)}",
            "query": {
                "issue2Candidate": CANDIDATE_QUERIES[candidate],
                "theme": theme,
                "camera": camera_preset,
                "issue2View": view,
                "issue2Distance": distance,
                "time": REQUIRED_CONDITIONS["time"],
                "paused": "1",
                "opacity": "1",
                "panel": "collapsed",
                "issue2Report": "zoom",
                "evidenceViewport": viewport,
            },
        })
    print(json.dumps({
        "schema": "issue2-phase2a2-capture-plan-v1",
        "temporaryRoot": str(TEMP),
        "captureMatrix": str(TEMP / "capture-matrix.json"),
        "conditions": {**REQUIRED_CONDITIONS, "distanceQueryParameter": "issue2Distance", "reportMode": "zoom"},
        "candidateProfiles": {
            "required": True,
            "acceptedLocations": [
                "capture-matrix.json#candidateProfiles",
                "reports/lighting/candidate-profiles.json",
                "candidate-profiles.json",
                "candidate-profiles.checkpoint.json (all four profiles required)",
            ],
            "payload": "one describeIssue2StudioRig() object per candidate",
        },
        "requiredReports": [
            "reports/browser-report.json",
            "reports/performance/summary.json",
        ],
        "expectedCaptureCount": EXPECTED_CAPTURE_COUNT,
        "entries": entries,
    }, ensure_ascii=False, indent=2))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    actions = parser.add_mutually_exclusive_group()
    actions.add_argument("--check", action="store_true", help="audit the committed Phase 2A.2 package without rewriting it")
    actions.add_argument("--print-plan", action="store_true", help="print the canonical 720-capture browser-harness plan as JSON")
    args = parser.parse_args()
    if args.check:
        check_manifest()
    elif args.print_plan:
        print_capture_plan()
    else:
        generate()


if __name__ == "__main__":
    main()
