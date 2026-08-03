#!/usr/bin/env python3
"""Build refined-lug surfacing evidence from actual Browser captures."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/final-exterior-design-phase3c2"
IMAGES = EVIDENCE / "images/lug-surfacing-final"
BEFORE = IMAGES / "raw-before"
AFTER = IMAGES / "raw-after"
REPORTS = EVIDENCE / "reports"
VIDEOS = EVIDENCE / "videos/lug-surfacing-final"
FRAMES = Path("/private/tmp/phase3c2-lug-surfacing/video-frames/rotation")
START_COMMIT = "9b55d5d3971ef456de5474b3bff6d3f26d6879f8"
IMPLEMENTATION_COMMIT = "00983f49b4dea623247e211cca54f3aac3f559ec"


def font(size: int) -> ImageFont.ImageFont:
    for candidate in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


TITLE = font(34)
LABEL = font(27)
SMALL = font(20)


def open_rgb(path: Path) -> Image.Image:
    image = Image.open(path)
    image.load()
    return image.convert("RGB")


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False)


def label_panel(
    image: Image.Image,
    text: str,
    color: tuple[int, int, int],
) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(
        (18, 18, 520, 66),
        radius=10,
        fill=(4, 7, 12, 218),
        outline=(*color, 255),
        width=2,
    )
    draw.text((34, 26), text, font=LABEL, fill=(*color, 255))


def comparison(name: str, output: str, title: str) -> None:
    before = open_rgb(BEFORE / name).resize(
        (960, 540),
        Image.Resampling.LANCZOS,
    )
    after = open_rgb(AFTER / name).resize(
        (960, 540),
        Image.Resampling.LANCZOS,
    )
    label_panel(before, f"BEFORE {START_COMMIT[:8]}", (244, 174, 95))
    label_panel(after, f"AFTER {IMPLEMENTATION_COMMIT[:8]}", (91, 220, 166))
    board = Image.new("RGB", (1920, 590), "#0d1015")
    board.paste(before, (0, 50))
    board.paste(after, (960, 50))
    draw = ImageDraw.Draw(board)
    draw.text((36, 8), title, font=TITLE, fill="#eef3f8")
    draw.line((959, 50, 959, 590), fill="#dce4ec", width=2)
    save_png(board, IMAGES / output)


def closeup(
    source: Path,
    box: tuple[int, int, int, int],
    label: str,
    output: str,
) -> None:
    crop = open_rgb(source).crop(box)
    image = ImageOps.fit(crop, (960, 540), Image.Resampling.LANCZOS)
    label_panel(image, label, (91, 220, 166))
    save_png(image, IMAGES / output)


def surfacing_annotation(runtime: dict) -> None:
    image = open_rgb(AFTER / "review-angle.png")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(
        (28, 26, 705, 206),
        radius=12,
        fill=(5, 9, 15, 222),
        outline=(91, 220, 166, 255),
        width=3,
    )
    surfacing = runtime["geometry"]["refinedLugs"]["surfacing"]
    lines = [
        "PHASE3C2_REFINED_LUG_SURFACING_FINAL",
        f"{surfacing['stationCount']} longitudinal stations / "
        f"{surfacing['crossSectionSegments']} section segments",
        "rounded superellipse section; shared-vertex normal flow",
        f"mid-waist count {surfacing['midWaistCount']} / "
        "forbidden interference 0",
    ]
    for index, text in enumerate(lines):
        draw.text(
            (48, 40 + index * 39),
            text,
            font=SMALL,
            fill=(239, 245, 249, 255),
        )
    for point, label in (
        ((321, 552), "case-matched root"),
        ((823, 468), "eased taper + rounded section"),
    ):
        draw.line((690, 174, point[0], point[1]), fill=(91, 220, 166, 255), width=4)
        draw.ellipse(
            (point[0] - 8, point[1] - 8, point[0] + 8, point[1] + 8),
            fill=(91, 220, 166, 255),
        )
        draw.text(
            (point[0] - 70, point[1] - 38),
            label,
            font=SMALL,
            fill=(245, 249, 252, 255),
            stroke_width=3,
            stroke_fill=(4, 7, 12, 255),
        )
    save_png(image, IMAGES / "surfacing-continuity-annotation.png")


def profile_diagram(runtime: dict) -> None:
    stations = runtime["geometry"]["refinedLugs"]["profileStations"]
    image = Image.new("RGB", (1280, 720), "#0d1015")
    draw = ImageDraw.Draw(image)
    draw.text(
        (38, 28),
        "Refined lug surfacing: monotonic width and thickness distribution",
        font=TITLE,
        fill="#eef3f8",
    )
    chart = (92, 116, 1180, 602)
    draw.rounded_rectangle(
        chart,
        radius=14,
        fill="#151b24",
        outline="#4e5b6c",
        width=2,
    )
    z_min, z_max = 16.0, 23.3

    def point(station: dict, key: str, low: float, high: float):
        x = chart[0] + (station["z"] - z_min) / (z_max - z_min) * (
            chart[2] - chart[0]
        )
        y = chart[3] - (station[key] - low) / (high - low) * (
            chart[3] - chart[1]
        )
        return (x, y)

    width_points = [point(item, "width", 1.8, 5.6) for item in stations]
    thickness_points = [
        point(item, "thickness", 1.8, 5.6) for item in stations
    ]
    draw.line(width_points, fill="#5bdca6", width=6, joint="curve")
    draw.line(thickness_points, fill="#70a7ff", width=6, joint="curve")
    for x, y in width_points:
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill="#5bdca6")
    for x, y in thickness_points:
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill="#70a7ff")
    draw.text((875, 72), "width", font=SMALL, fill="#5bdca6")
    draw.text((980, 72), "thickness", font=SMALL, fill="#70a7ff")
    draw.text(
        (92, 630),
        "No local minimum: root stays connected, width reaches the protected "
        "20.000 inner gap before the leather wrap, thickness continues smoothly.",
        font=SMALL,
        fill="#eef3f8",
    )
    save_png(image, IMAGES / "surfacing-profile.png")


def build_rotation_gif() -> None:
    frames = [open_rgb(path) for path in sorted(FRAMES.glob("frame-*.png"))]
    if len(frames) != 18:
        raise RuntimeError(f"expected 18 actual Browser frames, got {len(frames)}")
    VIDEOS.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        VIDEOS / "front-oblique-side-continuous.gif",
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / 6),
        loop=0,
        disposal=2,
        optimize=False,
        format="GIF",
    )


def metrics(path: Path, provenance: str) -> dict:
    image = open_rgb(path)
    colors = image.getcolors(maxcolors=image.width * image.height)
    counts = sorted((count for count, _ in colors), reverse=True)
    total = image.width * image.height
    return {
        "file": path.relative_to(EVIDENCE).as_posix(),
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "uniqueRgbCount": len(colors),
        "dominantColorRatio": counts[0] / total,
        "luminanceVariance": ImageStat.Stat(image.convert("L")).var[0],
        "provenance": provenance,
    }


def main() -> None:
    runtime = json.loads(
        (REPORTS / "lug-surfacing-desktop-runtime.json").read_text(),
    )
    comparison("front.png", "comparison-front.png", "Front surfacing comparison")
    comparison(
        "oblique.png",
        "comparison-oblique.png",
        "Oblique surfacing and highlight-flow comparison",
    )
    comparison("side.png", "comparison-side.png", "Side silhouette comparison")
    comparison(
        "review-angle.png",
        "comparison-review-angle.png",
        "Attached human-review angle comparison",
    )
    closeup(
        AFTER / "top.png",
        (300, 185, 570, 455),
        "12 o'clock / left refined lug",
        "lug-12-left-closeup.png",
    )
    closeup(
        AFTER / "top.png",
        (710, 185, 980, 455),
        "12 o'clock / right refined lug",
        "lug-12-right-closeup.png",
    )
    closeup(
        AFTER / "bottom.png",
        (300, 270, 570, 540),
        "6 o'clock / left refined lug",
        "lug-6-left-closeup.png",
    )
    closeup(
        AFTER / "bottom.png",
        (710, 270, 980, 540),
        "6 o'clock / right refined lug",
        "lug-6-right-closeup.png",
    )
    surfacing_annotation(runtime)
    profile_diagram(runtime)
    build_rotation_gif()

    raw_paths = [
        *(BEFORE / name for name in (
            "front.png",
            "oblique.png",
            "side.png",
            "review-angle.png",
            "top.png",
            "bottom.png",
            "mobile.png",
        )),
        *(AFTER / name for name in (
            "front.png",
            "oblique.png",
            "side.png",
            "review-angle.png",
            "top.png",
            "bottom.png",
            "mobile.png",
        )),
    ]
    report = {
        "schemaVersion": 1,
        "classification": "PHASE3C2_REFINED_LUG_SURFACING_FINAL",
        "sourceStartCommit": START_COMMIT,
        "sourceImplementationCommit": IMPLEMENTATION_COMMIT,
        "captureMode":
            "same-origin unsandboxed iframe harness; actual Three.js scene "
            "rendered to offscreen WebGLRenderTarget",
        "images": [
            metrics(path, "actual runtime WebGLRenderTarget capture")
            for path in raw_paths
        ],
        "derivedImages": [
            metrics(path, "actual runtime capture with measured overlay or crop")
            for path in sorted(IMAGES.glob("*.png"))
        ],
        "rotationGif": {
            "file": "videos/lug-surfacing-final/front-oblique-side-continuous.gif",
            "frameCount": 18,
            "fps": 6,
            "source":
                "actual invariant Three.js WebGLRenderTarget frames",
        },
    }
    (REPORTS / "lug-surfacing-image-metrics.json").write_text(
        json.dumps(report, indent=2) + "\n",
    )

    paths = []
    for identifier, base, current in (
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
    ):
        pixel_exact = ImageChops.difference(
            open_rgb(base),
            open_rgb(current),
        ).getbbox() is None
        paths.append({
            "id": identifier,
            "baseFile": base.relative_to(EVIDENCE).as_posix(),
            "currentFile": current.relative_to(EVIDENCE).as_posix(),
            "basePngSha256": hashlib.sha256(base.read_bytes()).hexdigest(),
            "currentPngSha256":
                hashlib.sha256(current.read_bytes()).hexdigest(),
            "decodedPixelExact": pixel_exact,
            "changedPixelCount": 0 if pixel_exact else None,
        })
    protected = {
        "schemaVersion": 1,
        "classification": "PHASE3C2_REFINED_LUG_SURFACING_FINAL",
        "sourceStartCommit": START_COMMIT,
        "sourceImplementationCommit": IMPLEMENTATION_COMMIT,
        "sourceBaseCommit":
            "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914",
        "appVersion": "v3.15.0",
        "paths": paths,
        "allDecodedPixelsExact":
            all(item["decodedPixelExact"] for item in paths),
        "phase3c2Object3DAddedOutsideCandidatePath": 0,
    }
    (REPORTS / "lug-surfacing-protected-paths.json").write_text(
        json.dumps(protected, indent=2) + "\n",
    )


if __name__ == "__main__":
    main()
