from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageColor, ImageDraw, ImageFont, ImageStat

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs/evidence/movement-dial-y-stack-phase2c"
REPORTS = OUT / "reports"
DESKTOP_PATH = OUT / "desktop-side.png"
MOBILE_PATH = OUT / "mobile-390-side.png"
LAYER_PATH = REPORTS / "y-layer-stack.json"
FONT = ImageFont.load_default()
CAPTURE_IMPLEMENTATION_COMMIT = "c8d59606810026a69ddef1a9a7c4e68bd379cf51"
SOURCE_AUDIT_COMMIT = "da473d7d569f1b43b9d6adc04087a0a8011e9951"
PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"
Y_MIN = -2.510
Y_MAX = 4.235


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_runtime_png(path: Path, expected_size: tuple[int, int]) -> Image.Image:
    if not path.exists():
        raise RuntimeError(f"missing runtime capture: {path}")
    if path.read_bytes()[:8] != PNG_SIGNATURE:
        raise RuntimeError(f"not a PNG: {path}")
    image = Image.open(path)
    image.load()
    if image.size != expected_size:
        raise RuntimeError(f"unexpected runtime capture size for {path.name}: {image.size}")
    return image.convert("RGBA")


def pixel_metrics(path: Path, expected_size: tuple[int, int]) -> dict:
    image = load_runtime_png(path, expected_size)
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
            if math.sqrt(sum((pixel[index] - dominant_color[index]) ** 2 for index in range(3))) > 8
        )
    luminance_variance = ImageStat.Stat(rgb.convert("L")).var[0]
    alpha = image.getchannel("A")
    non_transparent_ratio = sum(1 for value in alpha.get_flattened_data() if value > 0) / (image.width * image.height)
    return {
        "path": path.name,
        "source": "actual Three.js scene rendered to offscreen WebGLRenderTarget",
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "uniqueRgbCount": unique_rgb_count,
        "dominantColor": list(dominant_color) if dominant_color else None,
        "dominantColorRatio": round(dominant_ratio, 9),
        "nonBackgroundPixelRatio": round(non_background_count / (image.width * image.height), 9),
        "luminanceVariance": round(luminance_variance, 9),
        "nonTransparentPixelRatio": round(non_transparent_ratio, 9),
        "authentic": unique_rgb_count > 256
        and dominant_ratio < 0.96
        and non_background_count / (image.width * image.height) > 0.02
        and luminance_variance > 8
        and non_transparent_ratio > 0.99,
    }


def map_y(value: float, left: int = 520, right: int = 750) -> int:
    return round(left + (value - Y_MIN) / (Y_MAX - Y_MIN) * (right - left))


def overlay_base(title: str, accent: str) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = load_runtime_png(DESKTOP_PATH, (1280, 720)).copy()
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((0, 0, 1280, 62), fill=(7, 12, 20, 224))
    draw.text((22, 21), title, fill="#f4f7fb", font=FONT)
    draw.rectangle((18, 82, 390, 690), fill=(7, 12, 20, 194), outline=accent, width=2)
    draw.text((24, 670), "front = negative Y    back = positive Y", fill="#d6deea", font=FONT)
    return image, draw


def draw_value_line(draw: ImageDraw.ImageDraw, value: float, label: str, color: str, label_y: int) -> None:
    x = map_y(value)
    draw.line((x, 72, x, 650), fill=color, width=3)
    draw.line((390, label_y + 6, x, label_y + 6), fill=color, width=2)
    draw.text((26, label_y), f"{label}: {value:.4f}", fill="#f4f7fb", font=FONT)


def generate_annotated_datums() -> None:
    image, draw = overlay_base("Phase 2C — measured Y datum overlay on actual desktop runtime capture", "#60d9ff")
    draw_value_line(draw, 0.0, "model origin Y", "#ffffff", 110)
    draw_value_line(draw, -0.5645, "plate dial side", "#60d9ff", 162)
    draw_value_line(draw, 0.652, "plate movement side", "#55e0a3", 214)
    draw_value_line(draw, -2.510, "minute hand front", "#f5cf72", 266)
    draw_value_line(draw, 4.235, "bridge top", "#ff8b8b", 318)
    ring_left, ring_right = map_y(-2.25119), map_y(-1.90881)
    draw.rectangle((ring_left, 92, ring_right, 642), fill=(188, 140, 255, 42), outline="#bc8cff", width=2)
    draw.line((390, 376, ring_right, 376), fill="#bc8cff", width=2)
    draw.text((26, 370), "dial ring: -2.2512 to -1.9088", fill="#f4f7fb", font=FONT)
    image.save(OUT / "annotated-side-y-datums.png", format="PNG")


def generate_envelope(name: str, title: str, y_min: float, y_max: float, thickness: float, objects: list[str], accent: str, definition: str) -> None:
    image, draw = overlay_base(title, accent)
    left, right = map_y(y_min), map_y(y_max)
    draw.rectangle((left, 88, right, 645), fill=(*ImageColor.getrgb(accent), 52), outline=accent, width=4)
    draw.line((left, 650, right, 650), fill=accent, width=4)
    draw.line((left, 642, left, 658), fill=accent, width=3)
    draw.line((right, 642, right, 658), fill=accent, width=3)
    lines = [
        f"yMin {y_min:.3f}",
        f"yMax {y_max:.3f}",
        f"thickness {thickness:.3f}",
        f"extrema: {' / '.join(objects)}",
        definition,
    ]
    for index, line in enumerate(lines):
        draw.text((26, 118 + index * 52), line, fill="#f4f7fb", font=FONT)
    image.save(OUT / name, format="PNG")


def generate_layer_diagram() -> None:
    report = json.loads(LAYER_PATH.read_text())
    layers = report["desktop"]
    image = Image.new("RGBA", (1280, 720), "#101820")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((0, 0, 1280, 64), fill="#172738")
    draw.text((22, 22), "Phase 2C — Y layer stack generated from y-layer-stack.json", fill="#f4f7fb", font=FONT)
    plot_left, plot_right = 315, 1220
    draw.line((plot_left, 92, plot_right, 92), fill="#8fa5bc", width=2)
    for tick in [-2.5, -2, -1, 0, 1, 2, 3, 4, 4.235]:
        x = round(plot_left + (tick - Y_MIN) / (Y_MAX - Y_MIN) * (plot_right - plot_left))
        draw.line((x, 86, x, 690), fill=(104, 124, 146, 80), width=1)
        draw.text((x - 12, 70), f"{tick:g}", fill="#c7d1dd", font=FONT)
    decision_colors = {"KEEP": "#55e0a3", "PROTECTED": "#ff8b8b", "LOCAL_REVIEW": "#f5cf72", "DEFER_TO_EXTERIOR": "#bc8cff"}
    for index, layer in enumerate(layers):
        top = 112 + index * 50
        left = round(plot_left + (layer["yMin"] - Y_MIN) / (Y_MAX - Y_MIN) * (plot_right - plot_left))
        right = round(plot_left + (layer["yMax"] - Y_MIN) / (Y_MAX - Y_MIN) * (plot_right - plot_left))
        color = decision_colors[layer["decision"]]
        draw.text((18, top + 6), layer["id"], fill="#f4f7fb", font=FONT)
        draw.text((188, top + 6), layer["decision"], fill=color, font=FONT)
        draw.rectangle((left, top, max(left + 2, right), top + 26), fill=(*ImageColor.getrgb(color), 150), outline=color, width=2)
        gap = layer.get("adjacentGap")
        gap_label = "first layer" if gap is None else f"{'gap' if gap >= 0 else 'overlap'} {abs(gap):.4f}"
        draw.text((plot_left, top + 30), f"{layer['yMin']:.4f} .. {layer['yMax']:.4f}    {gap_label}", fill="#bdc9d6", font=FONT)
    draw.text((20, 688), "front = negative Y", fill="#c7d1dd", font=FONT)
    draw.text((1120, 688), "back = positive Y", fill="#c7d1dd", font=FONT)
    image.convert("RGB").save(OUT / "y-layer-stack-diagram.png", format="PNG")


def shared_runtime_pixel_ratio(path: Path) -> float:
    raw = load_runtime_png(DESKTOP_PATH, (1280, 720)).convert("RGB")
    overlay = load_runtime_png(path, (1280, 720)).convert("RGB")
    shared = sum(left == right for left, right in zip(raw.get_flattened_data(), overlay.get_flattened_data()))
    return round(shared / (raw.width * raw.height), 9)


def main() -> None:
    desktop_metrics = pixel_metrics(DESKTOP_PATH, (1280, 720))
    mobile_metrics = pixel_metrics(MOBILE_PATH, (390, 844))
    if not desktop_metrics["authentic"] or not mobile_metrics["authentic"]:
        raise RuntimeError(f"runtime capture authenticity failed: {desktop_metrics} {mobile_metrics}")
    if desktop_metrics["sha256"] == mobile_metrics["sha256"]:
        raise RuntimeError("desktop and mobile runtime captures must differ")
    generate_annotated_datums()
    generate_envelope(
        "base-movement-envelope.png",
        "Base movement envelope — actual desktop runtime capture",
        -2.410,
        4.235,
        6.645,
        ["dialWorks", "bridges"],
        "#f5cf72",
        "base movement components",
    )
    generate_envelope(
        "hand-fitting-envelope.png",
        "Physical hand-fitting and protruding-arbor envelope — actual desktop runtime capture",
        -2.470,
        0.720,
        3.190,
        ["minuteBoss", "fourthArbor"],
        "#55e0a3",
        "cannonTube / hourPipe / fourthDialArbor / three hand bosses (physical meshes; not proxy)",
    )
    generate_envelope(
        "complete-display-envelope.png",
        "Application envelope including dial and hands — actual desktop runtime capture",
        -2.510,
        4.235,
        6.745,
        ["minuteHand", "bridges"],
        "#bc8cff",
        "dial, indexes, and three hands included",
    )
    generate_layer_diagram()
    overlay_paths = [
        OUT / "annotated-side-y-datums.png",
        OUT / "base-movement-envelope.png",
        OUT / "hand-fitting-envelope.png",
        OUT / "complete-display-envelope.png",
    ]
    shared_ratios = {path.name: shared_runtime_pixel_ratio(path) for path in overlay_paths}
    if not all(ratio > 0.5 for ratio in shared_ratios.values()):
        raise RuntimeError(f"annotated images do not preserve enough runtime pixels: {shared_ratios}")
    authenticity = {
        "sourceAuditCommit": SOURCE_AUDIT_COMMIT,
        "captureImplementationCommit": CAPTURE_IMPLEMENTATION_COMMIT,
        "captureMode": "same-origin unsandboxed iframe harness - actual Three.js scene rendered to offscreen WebGLRenderTarget",
        "desktop": desktop_metrics,
        "mobile390": mobile_metrics,
        "annotatedDesktopBackgroundSharedRatio": shared_ratios,
        "checks": {
            "bothAuthentic": True,
            "desktopAndMobileShaDiffer": True,
            "rawImagesCreatedByGenerator": False,
            "annotatedImagesUseDesktopRuntimeBackground": True,
            "allAnnotatedBackgroundSharedRatiosAboveHalf": True,
        },
    }
    (REPORTS / "image-authenticity.json").write_text(json.dumps(authenticity, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
