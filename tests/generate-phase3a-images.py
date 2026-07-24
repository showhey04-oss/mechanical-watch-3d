from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFont, ImageStat

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/final-exterior-interface-phase3a"
REPORTS = EVIDENCE / "reports"
IMAGES = EVIDENCE / "images"
DESKTOP_FRONT = IMAGES / "desktop-front-baseline.png"
DESKTOP_SIDE = IMAGES / "desktop-side-baseline.png"
MOBILE_FRONT = IMAGES / "mobile-390-front-baseline.png"
MATRIX_PATH = REPORTS / "exterior-candidate-matrix.json"
CLEARANCE_PATH = REPORTS / "clearance-budget.json"
INTERFACE_PATH = REPORTS / "exterior-interface-map.json"
REGRESSION_PATH = REPORTS / "regression-results.json"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
FONT = ImageFont.load_default()
FRONT_SCALE = 720 / (2 * math.tan(math.radians(42) / 2) * 55.9)
FRONT_CENTER = (640, 360)
SIDE_Y_MIN = -4.6
SIDE_Y_MAX = 6.5
SIDE_LEFT = 430
SIDE_RIGHT = 850


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_png(path: Path, expected_size: tuple[int, int]) -> Image.Image:
    if not path.exists():
        raise RuntimeError(f"missing actual runtime capture: {path}")
    if path.read_bytes()[:8] != PNG_SIGNATURE:
        raise RuntimeError(f"invalid PNG signature: {path}")
    image = Image.open(path)
    image.load()
    if image.size != expected_size:
        raise RuntimeError(f"unexpected image dimensions for {path.name}: {image.size}")
    return image.convert("RGBA")


def pixel_metrics(path: Path, expected_size: tuple[int, int]) -> dict:
    image = load_png(path, expected_size)
    rgb = image.convert("RGB")
    colors = rgb.getcolors(maxcolors=rgb.width * rgb.height)
    if colors is None:
        unique_rgb_count = rgb.width * rgb.height
        dominant_count, dominant_color = 0, None
    else:
        unique_rgb_count = len(colors)
        dominant_count, dominant_color = max(colors)
    dominant_ratio = dominant_count / (rgb.width * rgb.height)
    if dominant_color is None:
        non_background_count = rgb.width * rgb.height
    else:
        non_background_count = sum(
            1
            for pixel in rgb.get_flattened_data()
            if math.sqrt(
                sum((pixel[index] - dominant_color[index]) ** 2 for index in range(3))
            )
            > 8
        )
    luminance_variance = ImageStat.Stat(rgb.convert("L")).var[0]
    alpha = image.getchannel("A")
    non_transparent_ratio = (
        sum(1 for value in alpha.get_flattened_data() if value > 0)
        / (image.width * image.height)
    )
    return {
        "path": f"images/{path.name}",
        "source": "actual Three.js scene rendered to offscreen WebGLRenderTarget",
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "uniqueRgbCount": unique_rgb_count,
        "dominantColor": list(dominant_color) if dominant_color else None,
        "dominantColorRatio": round(dominant_ratio, 9),
        "nonBackgroundPixelRatio": round(
            non_background_count / (rgb.width * rgb.height), 9
        ),
        "luminanceVariance": round(luminance_variance, 9),
        "nonTransparentPixelRatio": round(non_transparent_ratio, 9),
        "authentic": unique_rgb_count > 256
        and dominant_ratio < 0.96
        and non_background_count / (rgb.width * rgb.height) > 0.02
        and luminance_variance > 8
        and non_transparent_ratio > 0.99,
    }


def add_header(image: Image.Image, title: str, subtitle: str) -> ImageDraw.ImageDraw:
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((0, 0, image.width, 60), fill=(7, 12, 20, 224))
    draw.text((20, 14), title, fill="#f5f8fc", font=FONT)
    draw.text((20, 36), subtitle, fill="#c7d4e1", font=FONT)
    return draw


def circle_box(diameter: float, center=FRONT_CENTER) -> tuple[int, int, int, int]:
    radius = diameter * FRONT_SCALE / 2
    return (
        round(center[0] - radius),
        round(center[1] - radius),
        round(center[0] + radius),
        round(center[1] + radius),
    )


def draw_circle(
    draw: ImageDraw.ImageDraw,
    diameter: float,
    color: str,
    label: str | None,
    width: int = 3,
    center=FRONT_CENTER,
) -> None:
    draw.ellipse(circle_box(diameter, center), outline=color, width=width)
    if label:
        box = circle_box(diameter, center)
        draw.text((box[2] + 5, max(66, box[1])), f"{label} {diameter:.3f}", fill=color, font=FONT)


def front_overlay_base(title: str, subtitle: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = load_png(DESKTOP_FRONT, (1280, 720)).copy()
    draw = add_header(image, title, subtitle)
    return image, draw


def side_map(value: float) -> int:
    return round(
        SIDE_LEFT
        + (value - SIDE_Y_MIN) / (SIDE_Y_MAX - SIDE_Y_MIN) * (SIDE_RIGHT - SIDE_LEFT)
    )


def side_overlay_base(title: str, subtitle: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = load_png(DESKTOP_SIDE, (1280, 720)).copy()
    draw = add_header(image, title, subtitle)
    draw.text((16, 692), "front = negative Y", fill="#c7d4e1", font=FONT)
    draw.text((1120, 692), "back = positive Y", fill="#c7d4e1", font=FONT)
    return image, draw


def generate_front_constraints(interface: dict, matrix: dict) -> None:
    image, draw = front_overlay_base(
        "Phase 3A — front display and aperture constraints",
        "Measured S86 and movement anchors over actual desktop front capture",
    )
    front = interface["frontDisplay"]
    anchor_lines = [
        ("movement", front["movementOuterDiameter"]["value"], "#f5cf72"),
        ("S86 dial ring", front["dialRingDiameter"]["value"], "#65d9ff"),
        ("S86 index", front["indexCircleDiameter"]["value"], "#55e0a3"),
        ("minute tip", front["minuteHandTipDiameter"]["value"], "#ff8b8b"),
    ]
    for label, value, color in anchor_lines:
        draw_circle(draw, value, color, None)
    colors = {"E-COMPACT": "#f7c873", "E-BALANCED": "#60d9ff", "E-EDUCATIONAL": "#bc8cff"}
    for index, (candidate_id, candidate) in enumerate(matrix["candidates"].items()):
        aperture = candidate["values"]["dialApertureDiameter"]["value"]
        draw_circle(draw, aperture, colors[candidate_id], None, 2)
    legend = anchor_lines + [
        (f"{candidate_id} aperture", candidate["values"]["dialApertureDiameter"]["value"], colors[candidate_id])
        for candidate_id, candidate in matrix["candidates"].items()
    ]
    draw.rectangle((12, 78, 260, 78 + len(legend) * 25 + 12), fill=(7, 12, 20, 202), outline="#536579", width=1)
    for index, (label, value, color) in enumerate(legend):
        draw.text((20, 88 + index * 25), f"{label}: {value:.3f}", fill=color, font=FONT)
    image.save(IMAGES / "front-aperture-constraints.png", format="PNG")


def generate_side_clearance(clearance: dict) -> None:
    image, draw = side_overlay_base(
        "Phase 3A — Y clearance stack",
        "Protected application envelope and candidate crystal/caseback budgets",
    )
    anchors = [(-2.510, "minute hand front"), (-2.470, "hand fitting front"), (-2.410, "base front"), (0, "origin"), (0.720, "hand fitting back"), (4.235, "bridge top")]
    for index, (value, label) in enumerate(anchors):
        x = side_map(value)
        draw.line((x, 72, x, 650), fill="#dce5ef", width=2)
        draw.text((18, 86 + index * 28), f"{label}: {value:.3f}", fill="#eef3f8", font=FONT)
    colors = {"E-COMPACT": "#f7c873", "E-BALANCED": "#60d9ff", "E-EDUCATIONAL": "#bc8cff"}
    for index, (candidate_id, candidate) in enumerate(clearance["candidates"].items()):
        front_x = side_map(candidate["front"]["crystalOuterY"])
        rear_x = side_map(candidate["rear"]["casebackOuterY"])
        top = 470 + index * 50
        draw.rectangle(
            (front_x, top, rear_x, top + 28),
            fill=(*ImageColor.getrgb(colors[candidate_id]), 66),
            outline=colors[candidate_id],
            width=3,
        )
        draw.text(
            (18, top + 7),
            f"{candidate_id}: {candidate['totalCaseThickness']:.3f}",
            fill=colors[candidate_id],
            font=FONT,
        )
    image.save(IMAGES / "side-clearance-stack.png", format="PNG")


def generate_crown_interface(interface: dict, matrix: dict) -> None:
    image, draw = front_overlay_base(
        "Phase 3A — crown and stem interface",
        "Fixed A.7 axis and position-1/position-2 travel; exterior must adapt",
    )
    crown = interface["crownStem"]
    center_y = FRONT_CENTER[1] - crown["axis"]["centerZ"] * FRONT_SCALE
    x_wind = FRONT_CENTER[0] + crown["crownPosition1"]["centerX"] * FRONT_SCALE
    x_set = FRONT_CENTER[0] + crown["crownPosition2"]["centerX"] * FRONT_SCALE
    draw.line((FRONT_CENTER[0], center_y, 1260, center_y), fill="#60d9ff", width=3)
    draw.ellipse((x_wind - 12, center_y - 12, x_wind + 12, center_y + 12), outline="#55e0a3", width=4)
    draw.ellipse((x_set - 12, center_y - 12, x_set + 12, center_y + 12), outline="#ff8b8b", width=4)
    draw.line((x_wind, center_y - 34, x_set, center_y - 34), fill="#f5cf72", width=3)
    draw.text((870, 84), f"axis Y {crown['axis']['centerY']:.3f}", fill="#60d9ff", font=FONT)
    draw.text((870, 108), f"position 1 X {crown['crownPosition1']['centerX']:.3f}", fill="#55e0a3", font=FONT)
    draw.text((870, 132), f"position 2 X {crown['crownPosition2']['centerX']:.3f}", fill="#ff8b8b", font=FONT)
    draw.text((870, 156), f"pull travel {crown['pullTravel']['value']:.3f}", fill="#f5cf72", font=FONT)
    colors = {"E-COMPACT": "#f7c873", "E-BALANCED": "#60d9ff", "E-EDUCATIONAL": "#bc8cff"}
    for candidate_id, candidate in matrix["candidates"].items():
        draw_circle(draw, candidate["values"]["caseOuterDiameter"]["value"], colors[candidate_id], None, 2)
    image.save(IMAGES / "crown-stem-interface.png", format="PNG")


def generate_front_comparison(matrix: dict) -> None:
    image, draw = front_overlay_base(
        "Phase 3A — exterior candidate front comparison",
        "Candidate outlines only; no exterior Geometry is added to the Three.js scene",
    )
    colors = {"E-COMPACT": "#f7c873", "E-BALANCED": "#60d9ff", "E-EDUCATIONAL": "#bc8cff"}
    for index, (candidate_id, candidate) in enumerate(matrix["candidates"].items()):
        color = colors[candidate_id]
        case_diameter = candidate["values"]["caseOuterDiameter"]["value"]
        aperture = candidate["values"]["dialApertureDiameter"]["value"]
        lug_to_lug = candidate["values"]["lugToLug"]["value"]
        lug_width = candidate["values"]["lugWidth"]["value"]
        draw_circle(draw, case_diameter, color, None, 3)
        draw_circle(draw, aperture, color, None, 1)
        case_radius_px = case_diameter * FRONT_SCALE / 2
        lug_half_length_px = lug_to_lug * FRONT_SCALE / 2
        lug_half_width_px = lug_width * FRONT_SCALE / 2
        x0 = FRONT_CENTER[0] - lug_half_width_px
        x1 = FRONT_CENTER[0] + lug_half_width_px
        draw.rectangle(
            (x0, FRONT_CENTER[1] - lug_half_length_px, x1, FRONT_CENTER[1] - case_radius_px),
            outline=color,
            width=2,
        )
        draw.rectangle(
            (x0, FRONT_CENTER[1] + case_radius_px, x1, FRONT_CENTER[1] + lug_half_length_px),
            outline=color,
            width=2,
        )
        draw.rectangle((12, 82 + index * 54, 322, 126 + index * 54), fill=(7, 12, 20, 188), outline=color, width=2)
        draw.text((20, 90 + index * 54), candidate_id, fill=color, font=FONT)
        draw.text(
            (20, 108 + index * 54),
            f"case {case_diameter:.1f} / aperture {aperture:.1f} / L2L {lug_to_lug:.1f}",
            fill="#eef3f8",
            font=FONT,
        )
    image.save(IMAGES / "exterior-candidate-front-comparison.png", format="PNG")


def generate_side_comparison(matrix: dict) -> None:
    image, draw = side_overlay_base(
        "Phase 3A — exterior candidate side comparison",
        "Crystal and caseback candidate surfaces around protected Y extrema",
    )
    colors = {"E-COMPACT": "#f7c873", "E-BALANCED": "#60d9ff", "E-EDUCATIONAL": "#bc8cff"}
    for value, label in [(-2.510, "-2.510"), (-2.470, "-2.470"), (-2.410, "-2.410"), (0, "0"), (0.720, "0.720"), (4.235, "4.235")]:
        x = side_map(value)
        draw.line((x, 68, x, 650), fill=(220, 230, 240, 100), width=1)
        draw.text((x - 18, 656), label, fill="#dce5ef", font=FONT)
    for index, (candidate_id, candidate) in enumerate(matrix["candidates"].items()):
        color = colors[candidate_id]
        inner_front = candidate["values"]["crystalInnerY"]["value"]
        outer_front = candidate["values"]["crystalOuterY"]["value"]
        inner_back = candidate["values"]["casebackInnerY"]["value"]
        outer_back = candidate["values"]["casebackOuterY"]["value"]
        top = 130 + index * 150
        draw.rectangle(
            (side_map(outer_front), top, side_map(outer_back), top + 92),
            fill=(*ImageColor.getrgb(color), 40),
            outline=color,
            width=3,
        )
        draw.line((side_map(inner_front), top, side_map(inner_front), top + 92), fill=color, width=2)
        draw.line((side_map(inner_back), top, side_map(inner_back), top + 92), fill=color, width=2)
        draw.text((18, top + 8), candidate_id, fill=color, font=FONT)
        draw.text((18, top + 30), f"crystal {outer_front:.3f} / {inner_front:.3f}", fill="#eef3f8", font=FONT)
        draw.text((18, top + 50), f"caseback {inner_back:.3f} / {outer_back:.3f}", fill="#eef3f8", font=FONT)
        draw.text(
            (18, top + 70),
            f"total {candidate['values']['totalCaseThickness']['value']:.3f}",
            fill="#eef3f8",
            font=FONT,
        )
    image.save(IMAGES / "exterior-candidate-side-comparison.png", format="PNG")


def shared_runtime_pixel_ratio(raw_path: Path, overlay_path: Path) -> float:
    raw = load_png(raw_path, (1280, 720)).convert("RGB")
    overlay = load_png(overlay_path, (1280, 720)).convert("RGB")
    shared = sum(
        left == right
        for left, right in zip(raw.get_flattened_data(), overlay.get_flattened_data())
    )
    return round(shared / (raw.width * raw.height), 9)


def main() -> None:
    IMAGES.mkdir(parents=True, exist_ok=True)
    matrix = json.loads(MATRIX_PATH.read_text())
    clearance = json.loads(CLEARANCE_PATH.read_text())
    interface = json.loads(INTERFACE_PATH.read_text())
    desktop_front_metrics = pixel_metrics(DESKTOP_FRONT, (1280, 720))
    desktop_side_metrics = pixel_metrics(DESKTOP_SIDE, (1280, 720))
    mobile_front_metrics = pixel_metrics(MOBILE_FRONT, (390, 844))
    raw_metrics = {
        "desktopFront": desktop_front_metrics,
        "desktopSide": desktop_side_metrics,
        "mobile390Front": mobile_front_metrics,
    }
    if not all(entry["authentic"] for entry in raw_metrics.values()):
        raise RuntimeError(f"runtime capture authenticity failed: {raw_metrics}")
    if len({entry["sha256"] for entry in raw_metrics.values()}) != 3:
        raise RuntimeError("all three runtime baselines must have different SHA-256 values")

    generate_front_constraints(interface, matrix)
    generate_side_clearance(clearance)
    generate_crown_interface(interface, matrix)
    generate_front_comparison(matrix)
    generate_side_comparison(matrix)

    overlay_paths = [
        IMAGES / "front-aperture-constraints.png",
        IMAGES / "side-clearance-stack.png",
        IMAGES / "crown-stem-interface.png",
        IMAGES / "exterior-candidate-front-comparison.png",
        IMAGES / "exterior-candidate-side-comparison.png",
    ]
    overlay_shas = {path.name: sha256(path) for path in overlay_paths}
    if len(set(overlay_shas.values())) != len(overlay_shas):
        raise RuntimeError(f"purpose-specific overlays must differ: {overlay_shas}")
    shared_ratios = {
        path.name: shared_runtime_pixel_ratio(
            DESKTOP_SIDE if "side-" in path.name or path.name.startswith("side-") else DESKTOP_FRONT,
            path,
        )
        for path in overlay_paths
    }
    if not all(value > 0.45 for value in shared_ratios.values()):
        raise RuntimeError(f"overlays do not preserve enough runtime pixels: {shared_ratios}")

    regression = json.loads(REGRESSION_PATH.read_text())
    regression["imageEvidence"] = {
        "rawCaptures": raw_metrics,
        "overlaySha256": overlay_shas,
        "overlayRuntimeBackgroundSharedRatio": shared_ratios,
        "checks": {
            "allRawCapturesAuthentic": True,
            "allRawCaptureShasDiffer": True,
            "allOverlayShasDiffer": True,
            "allOverlayBackgroundSharedRatiosAbove45Percent": True,
            "rawBaselinesCreatedByGenerator": False,
        },
    }
    REGRESSION_PATH.write_text(json.dumps(regression, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
