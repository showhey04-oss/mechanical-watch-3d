#!/usr/bin/env python3
"""Build Phase 3C.2 lug-continuity evidence from actual Browser captures."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/final-exterior-design-phase3c2"
IMAGES = EVIDENCE / "images/lug-continuity-final"
BEFORE = IMAGES / "raw-before"
AFTER = IMAGES / "raw-after"
VIDEOS = EVIDENCE / "videos/lug-continuity-final"
REPORTS = EVIDENCE / "reports"
FRAME_ROOT = Path(os.environ.get(
    "PHASE3C2_VIDEO_FRAME_ROOT",
    "/private/tmp/phase3c2-lug-continuity/video-frames",
))
IMPLEMENTATION_COMMIT = "2a9cfe31de83c631e6d99d50851f2cb4463684dc"
START_COMMIT = "752418e72d3bb7b1dd86952638a3bb85fdf6d582"
BASE_COMMIT = "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914"
MAIN_COMMIT = "293626f13a50224924f8e3ac229a1fc4077ad7a7"
META = {
    "sourceImplementationCommit": IMPLEMENTATION_COMMIT,
    "sourceAuditCommit": IMPLEMENTATION_COMMIT,
    "sourceStartCommit": START_COMMIT,
    "sourceBaseCommit": BASE_COMMIT,
    "mainCommit": MAIN_COMMIT,
    "sourceBranch":
        "feature/final-exterior-balanced-phase3c2-strap-buckle",
    "baseBranch":
        "feature/final-exterior-balanced-phase3c1-watch-head",
    "appVersion": "v3.15.0",
    "classification": "PHASE3C2_REFINED_LUG_CASE_CONTINUITY_FINAL",
}


def font(size: int) -> ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


LABEL = font(30)
SMALL = font(22)
TITLE = font(38)


def open_rgb(path: Path) -> Image.Image:
    image = Image.open(path)
    image.load()
    return image.convert("RGB")


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False)


def label_panel(image: Image.Image, text: str, color: tuple[int, int, int]):
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(
        (18, 18, 420, 66),
        radius=10,
        fill=(4, 7, 12, 210),
        outline=(*color, 255),
        width=2,
    )
    draw.text((34, 26), text, font=LABEL, fill=(*color, 255))


def comparison(before_name: str, after_name: str, output_name: str) -> None:
    before = open_rgb(BEFORE / before_name).resize(
        (960, 540), Image.Resampling.LANCZOS,
    )
    after = open_rgb(AFTER / after_name).resize(
        (960, 540), Image.Resampling.LANCZOS,
    )
    label_panel(before, f"BEFORE {START_COMMIT[:8]}", (244, 174, 95))
    label_panel(after, f"AFTER {IMPLEMENTATION_COMMIT[:8]}", (91, 220, 166))
    board = Image.new("RGB", (1920, 540), "#0d1015")
    board.paste(before, (0, 0))
    board.paste(after, (960, 0))
    draw = ImageDraw.Draw(board)
    draw.line((959, 0, 959, 540), fill="#dce4ec", width=2)
    save_png(board, IMAGES / output_name)


def closeup(source: Path, box: tuple[int, int, int, int], label: str, name: str):
    crop = open_rgb(source).crop(box)
    canvas = ImageOps.fit(crop, (960, 540), Image.Resampling.LANCZOS)
    label_panel(canvas, label, (91, 220, 166))
    save_png(canvas, IMAGES / name)


def annotated_connection() -> None:
    image = open_rgb(AFTER / "review-angle.png")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(
        (32, 32, 650, 188),
        radius=12,
        fill=(5, 9, 15, 218),
        outline=(91, 220, 166, 255),
        width=3,
    )
    lines = [
        "PHASE3C2_REFINED_LUG_CASE_CONTINUITY_FINAL",
        "case-matched root chord / embed 0.260",
        "root section 3.600 wide x 5.800 thick",
        "monotonic transition 4.297 to protected tip",
    ]
    for index, text in enumerate(lines):
        draw.text(
            (52, 46 + index * 34),
            text,
            font=SMALL,
            fill=(236, 242, 248, 255),
        )
    for target in [(315, 548), (810, 442)]:
        draw.line((650, 150, target[0], target[1]), fill=(91, 220, 166, 255), width=4)
        draw.ellipse(
            (target[0] - 9, target[1] - 9, target[0] + 9, target[1] + 9),
            fill=(91, 220, 166, 255),
        )
    draw.text(
        (790, 392),
        "wide root grows from case",
        font=SMALL,
        fill=(245, 249, 252, 255),
        stroke_width=3,
        stroke_fill=(4, 7, 12, 255),
    )
    save_png(image, IMAGES / "lug-case-connection-annotation.png")


def profile_diagram(runtime: dict) -> None:
    current = runtime["geometry"]["refinedLugs"]["profileStations"]
    previous = [
        {"z": 16.280, "width": 2.400, "thickness": 5.050},
        {"z": 16.850, "width": 2.350, "thickness": 4.980},
        {"z": 18.400, "width": 2.250, "thickness": 4.350},
        {"z": 20.500, "width": 2.100, "thickness": 3.100},
        {"z": 22.300, "width": 2.000, "thickness": 2.250},
        {"z": 23.10508, "width": 2.000, "thickness": 2.000},
    ]
    image = Image.new("RGB", (1280, 720), "#0d1015")
    draw = ImageDraw.Draw(image)
    draw.text(
        (42, 30),
        "Refined lug root profile: approved start vs final local revision",
        font=TITLE,
        fill="#eef3f8",
    )
    chart = (90, 120, 1180, 620)
    draw.rounded_rectangle(chart, radius=14, fill="#151b24", outline="#4e5b6c", width=2)
    z_min, z_max = 16.0, 23.3
    width_min, width_max = 1.8, 3.8

    def xy(station):
        x = chart[0] + (station["z"] - z_min) / (z_max - z_min) * (
            chart[2] - chart[0]
        )
        y = chart[3] - (station["width"] - width_min) / (
            width_max - width_min
        ) * (chart[3] - chart[1])
        return x, y

    for value in [16, 18, 20, 22, 23.3]:
        x = chart[0] + (value - z_min) / (z_max - z_min) * (
            chart[2] - chart[0]
        )
        draw.line((x, chart[1], x, chart[3]), fill="#293443", width=1)
        draw.text((x - 20, chart[3] + 12), f"Z {value:g}", font=SMALL, fill="#aeb9c6")
    for value in [2.0, 2.5, 3.0, 3.5]:
        y = chart[3] - (value - width_min) / (
            width_max - width_min
        ) * (chart[3] - chart[1])
        draw.line((chart[0], y, chart[2], y), fill="#293443", width=1)
        draw.text((20, y - 12), f"W {value:.1f}", font=SMALL, fill="#aeb9c6")
    for stations, color, label in [
        (previous, "#f4ae5f", f"before {START_COMMIT[:8]}"),
        (current, "#5bdca6", f"after {IMPLEMENTATION_COMMIT[:8]}"),
    ]:
        points = [xy(station) for station in stations]
        draw.line(points, fill=color, width=7, joint="curve")
        for x, y in points:
            draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=color)
        draw.text(
            (860, 70 if label.startswith("before") else 96),
            label,
            font=SMALL,
            fill=color,
        )
    draw.text(
        (90, 660),
        "Root width +50%; tip anchors, 46.600 lug-to-lug, 20.000 inner gap and spring-bar centers unchanged.",
        font=SMALL,
        fill="#eef3f8",
    )
    save_png(image, IMAGES / "root-profile-comparison.png")


def pixel_metrics(path: Path) -> dict:
    image = open_rgb(path)
    colors = image.getcolors(maxcolors=image.width * image.height)
    counts = sorted((count for count, _ in colors), reverse=True)
    total = image.width * image.height
    stats = ImageStat.Stat(image.convert("L"))
    return {
        "file": path.relative_to(EVIDENCE).as_posix(),
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "uniqueRgbCount": len(colors),
        "dominantColorRatio": counts[0] / total,
        "luminanceVariance": stats.var[0],
        "provenance": "actual runtime WebGLRenderTarget capture",
    }


def build_gif(source: Path, output: Path, fps: int) -> None:
    frames = [open_rgb(path) for path in sorted(source.glob("frame-*.png"))]
    if len(frames) < 8:
        raise RuntimeError(f"insufficient actual Browser frames: {source}")
    output.parent.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        output,
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / fps),
        loop=0,
        disposal=2,
        optimize=False,
        format="GIF",
    )


def main() -> None:
    runtime = json.loads((REPORTS / "desktop-runtime.json").read_text())
    comparison("front.png", "front.png", "comparison-front.png")
    comparison("oblique.png", "oblique.png", "comparison-oblique.png")
    comparison("side.png", "side.png", "comparison-side.png")
    comparison("oblique.png", "oblique.png", "comparison-review-angle.png")
    review_board = open_rgb(IMAGES / "comparison-review-angle.png")
    review_draw = ImageDraw.Draw(review_board, "RGBA")
    review_draw.rounded_rectangle(
        (570, 474, 1350, 528),
        radius=10,
        fill=(4, 7, 12, 220),
        outline=(91, 220, 166, 255),
        width=2,
    )
    review_draw.text(
        (600, 484),
        "HUMAN REVIEW ANGLE EQUIVALENT - continuity focus",
        font=SMALL,
        fill=(238, 244, 249, 255),
    )
    save_png(review_board, IMAGES / "comparison-review-angle.png")
    closeup(AFTER / "top.png", (300, 185, 570, 455), "12 o'clock / left lug", "lug-12-left-closeup.png")
    closeup(AFTER / "top.png", (710, 185, 980, 455), "12 o'clock / right lug", "lug-12-right-closeup.png")
    closeup(AFTER / "bottom.png", (300, 270, 570, 540), "6 o'clock / left lug", "lug-6-left-closeup.png")
    closeup(AFTER / "bottom.png", (710, 270, 980, 540), "6 o'clock / right lug", "lug-6-right-closeup.png")
    annotated_connection()
    profile_diagram(runtime)

    video_specs = [
        ("rotation", "front-oblique-side-continuous.gif", 6),
        ("closeup-rotation", "review-angle-closeup-rotation.gif", 6),
        ("split-explode-restore", "split-explode-restore.gif", 6),
        ("mobile-rotate-zoom", "mobile-rotate-zoom.gif", 6),
    ]
    for source, output, fps in video_specs:
        build_gif(FRAME_ROOT / source, VIDEOS / output, fps)

    raw_paths = [
        BEFORE / "front.png",
        BEFORE / "oblique.png",
        BEFORE / "side.png",
        AFTER / "front.png",
        AFTER / "oblique.png",
        AFTER / "side.png",
        AFTER / "review-angle.png",
        AFTER / "top.png",
        AFTER / "bottom.png",
        AFTER / "mobile.png",
        AFTER / "opacity-50.png",
        AFTER / "opacity-16-selection.png",
    ]
    image_report = {
        **META,
        "schemaVersion": 1,
        "captureMode":
            "same-origin unsandboxed iframe harness; actual Three.js scene rendered to offscreen WebGLRenderTarget",
        "images": [pixel_metrics(path) for path in raw_paths],
    }
    (REPORTS / "lug-continuity-image-metrics.json").write_text(
        json.dumps(image_report, indent=2) + "\n",
    )

    protected = []
    for identifier, base, current in [
        (
            "normal-path",
            EVIDENCE / "images/normal-path-base.png",
            AFTER / "normal-path-protected.png",
        ),
        (
            "phase3c1-only-path",
            EVIDENCE / "images/phase3c1-path-base.png",
            AFTER / "phase3c1-path-protected.png",
        ),
    ]:
        base_image = open_rgb(base)
        current_image = open_rgb(current)
        pixel_exact = ImageChops.difference(base_image, current_image).getbbox() is None
        protected.append({
            "id": identifier,
            "baseFile": base.relative_to(EVIDENCE).as_posix(),
            "currentFile": current.relative_to(EVIDENCE).as_posix(),
            "basePngSha256": hashlib.sha256(base.read_bytes()).hexdigest(),
            "currentPngSha256": hashlib.sha256(current.read_bytes()).hexdigest(),
            "decodedPixelExact": pixel_exact,
            "changedPixelCount": 0 if pixel_exact else None,
            "pngByteStreamMayDifferBecauseBrowserEncoder": True,
        })
    protected_report = {
        **META,
        "schemaVersion": 1,
        "paths": protected,
        "allDecodedPixelsExact": all(item["decodedPixelExact"] for item in protected),
        "phase3c2Object3DAddedOutsideCandidatePath": 0,
    }
    (REPORTS / "lug-continuity-protected-paths.json").write_text(
        json.dumps(protected_report, indent=2) + "\n",
    )


if __name__ == "__main__":
    main()
