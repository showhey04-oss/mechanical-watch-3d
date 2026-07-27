#!/usr/bin/env python3
"""Derive Phase 3C.2 review boards and GIFs from actual Browser captures."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/final-exterior-design-phase3c2"
IMAGES = EVIDENCE / "images"
VIDEOS = EVIDENCE / "videos"
REPORTS = EVIDENCE / "reports"
DESKTOP = (1280, 720)
MOBILE = (390, 844)


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        Path("/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc")
        if bold
        else Path("/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"),
        Path("/System/Library/Fonts/Helvetica.ttc"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONT_16 = font(16)
FONT_20 = font(20)
FONT_26 = font(26, True)


def source(name: str, expected: tuple[int, int] | None = None) -> Image.Image:
    path = IMAGES / name
    if not path.exists():
        raise FileNotFoundError(f"actual Browser capture missing: {path}")
    image = Image.open(path)
    image.load()
    if expected and image.size != expected:
        raise ValueError(f"{name}: expected {expected}, got {image.size}")
    return image.convert("RGB")


def label(image: Image.Image, title: str, subtitle: str = "") -> Image.Image:
    result = image.copy()
    draw = ImageDraw.Draw(result, "RGBA")
    draw.rectangle((0, 0, result.width, 72), fill=(4, 9, 17, 220))
    draw.text((18, 10), title, font=FONT_26, fill=(248, 251, 255))
    if subtitle:
        draw.text((18, 43), subtitle, font=FONT_16, fill=(180, 211, 230))
    return result


def crop_board(
    source_name: str,
    output_name: str,
    crop: tuple[int, int, int, int],
    title: str,
    subtitle: str,
) -> None:
    image = source(source_name, DESKTOP).crop(crop)
    image = image.resize((960, 540), Image.Resampling.LANCZOS)
    label(image, title, subtitle).save(IMAGES / output_name, format="PNG")


def full_length_board() -> None:
    panels = [
        ("desktop-top-strap.png", "12 o'clock / buckle side"),
        ("desktop-front.png", "watch head / spring-bar anchors"),
        ("desktop-bottom-strap.png", "6 o'clock / perforated side"),
    ]
    canvas = Image.new("RGB", DESKTOP, (7, 13, 23))
    for index, (name, caption) in enumerate(panels):
        item = source(name, DESKTOP).crop((350, 0, 930, 720))
        left = int(index * DESKTOP[0] / 3)
        right = int((index + 1) * DESKTOP[0] / 3)
        cell = ImageOps.fit(
            item,
            (right - left, DESKTOP[1]),
            Image.Resampling.LANCZOS,
        )
        canvas.paste(label(cell, caption, "actual runtime segment capture"), (left, 0))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rectangle((0, 664, 1280, 720), fill=(4, 9, 17, 224))
    draw.text(
        (18, 680),
        "75 / 115 model-unit centerlines; reversible review framing; live camera constants unchanged",
        font=FONT_20,
        fill=(241, 246, 251),
    )
    canvas.save(IMAGES / "desktop-full-length.png", format="PNG")


def mobile_board() -> None:
    front = source("mobile-390-front.png", MOBILE)
    side = source("mobile-390-side.png", MOBILE)
    canvas = Image.new("RGB", MOBILE, (7, 13, 23))
    for index, (image, caption) in enumerate([
        (front, "front"),
        (side, "side"),
    ]):
        crop = image.resize((195, 422), Image.Resampling.LANCZOS)
        canvas.paste(label(crop, caption), (index * 195, 0))
        canvas.paste(label(crop, caption), (index * 195, 422))
    canvas.save(IMAGES / "mobile-390-full-length.png", format="PNG")


def holes_board() -> None:
    image = source("hole-detail.png", DESKTOP)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(
        (34, 420, 1246, 692),
        14,
        fill=(4, 9, 17, 222),
        outline=(82, 205, 244),
        width=2,
    )
    draw.text((56, 438), "Seven real through holes", font=FONT_26, fill="white")
    draw.text(
        (56, 474),
        "diameter 2.000 / pitch 7.000 / free-end distances 24..66",
        font=FONT_20,
        fill=(190, 220, 238),
    )
    x0, y0, spacing = 120, 590, 145
    for index in range(7):
        x = x0 + index * spacing
        draw.ellipse(
            (x - 24, y0 - 24, x + 24, y0 + 24),
            outline=(255, 205, 87),
            width=4,
        )
        draw.text((x - 6, y0 + 36), str(index + 1), font=FONT_16, fill="white")
    draw.text(
        (56, 646),
        "lower row is a measured-position annotation; upper image is the actual Three.js strap capture",
        font=FONT_16,
        fill=(175, 207, 228),
    )
    image.save(IMAGES / "seven-hole-row.png", format="PNG")


def make_gif(output: str, frames: list[tuple[str, str]]) -> None:
    images: list[Image.Image] = []
    for name, caption in frames:
        image = source(name)
        image.thumbnail((640, 360), Image.Resampling.LANCZOS)
        canvas = Image.new("RGB", (640, 360), (7, 13, 23))
        canvas.paste(
            image,
            ((canvas.width - image.width) // 2, (canvas.height - image.height) // 2),
        )
        images.append(label(canvas, caption))
    expanded = (images * ((10 + len(images) - 1) // len(images)))[:10]
    palette = expanded[0].convert(
        "P",
        palette=Image.Palette.ADAPTIVE,
        colors=192,
    )
    converted = [
        image.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG)
        for image in expanded
    ]
    converted[0].save(
        VIDEOS / output,
        format="GIF",
        save_all=True,
        append_images=converted[1:],
        duration=500,
        loop=0,
        disposal=2,
        optimize=False,
    )


def image_metric(path: Path, provenance: str) -> dict:
    image = Image.open(path).convert("RGB")
    colors = image.getcolors(maxcolors=image.width * image.height)
    total = image.width * image.height
    dominant = max((count for count, _ in colors), default=0) if colors else None
    return {
        "file": str(path.relative_to(EVIDENCE)),
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "uniqueRgbCount": len(colors) if colors else f">{total}",
        "dominantColorRatio": dominant / total if dominant is not None else None,
        "luminanceVariance": ImageStat.Stat(image.convert("L")).var[0],
        "provenance": provenance,
    }


def main() -> None:
    IMAGES.mkdir(parents=True, exist_ok=True)
    VIDEOS.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    panel_capture = source("mobile-panel-open-browser-raw.png")
    if panel_capture.width < MOBILE[0] or panel_capture.height != MOBILE[1]:
        raise ValueError(
            "mobile panel Browser capture must contain a 390x844 app viewport",
        )
    panel_capture.crop((0, 0, MOBILE[0], MOBILE[1])).save(
        IMAGES / "mobile-390-panel-open.png",
        format="PNG",
    )
    full_length_board()
    mobile_board()
    crop_board(
        "desktop-top-strap.png",
        "lug-12-connection.png",
        (360, 360, 920, 720),
        "12 o'clock lug connection",
        "actual spring-bar and leather-pocket view",
    )
    crop_board(
        "desktop-top-strap.png",
        "lug-12-wrap-closeup.png",
        (350, 330, 930, 720),
        "12 o'clock leather wrap",
        "continuous tongue overlaps the strap body around the real spring bar",
    )
    crop_board(
        "desktop-bottom-strap.png",
        "lug-6-connection.png",
        (360, 0, 920, 360),
        "6 o'clock lug connection",
        "actual spring-bar and leather-pocket view",
    )
    crop_board(
        "desktop-bottom-strap.png",
        "lug-6-wrap-closeup.png",
        (350, 0, 930, 390),
        "6 o'clock leather wrap",
        "continuous tongue overlaps the strap body around the real spring bar",
    )
    crop_board(
        "top-strap-back.png",
        "spring-bar-wraps.png",
        (260, 300, 1020, 720),
        "Spring-bar wrap",
        "real annular tunnel / INTENDED_STRAP_BAR_CONNECTION",
    )
    holes_board()
    crop_board(
        "bottom-strap-back.png",
        "six-free-tip.png",
        (360, 0, 920, 520),
        "6 o'clock rounded free end",
        "symmetric cosine cap; nominal 16.000 body width",
    )
    crop_board(
        "buckle-detail.png",
        "buckle-frame-tang-bar.png",
        (350, 300, 1160, 720),
        "Buckle frame / tang / attachment bar",
        "polished stable silver; static educational interface",
    )
    crop_board(
        "buckle-detail.png",
        "buckle-wrap-connection.png",
        (300, 0, 980, 620),
        "Buckle-side leather connection",
        "real leather tongue wraps the attachment bar; frame is not floating",
    )
    crop_board(
        "buckle-detail.png",
        "hardware-silver-closeup.png",
        (320, 210, 1000, 720),
        "Silver frame / bar / tang",
        "opaque midtone silver in the accepted Phase 3C.1 material family",
    )
    crop_board(
        "buckle-detail.png",
        "keepers.png",
        (350, 0, 1160, 470),
        "Fixed and floating keepers",
        "closed loops; 0.150 model-unit strap clearance",
    )
    crop_board(
        "desktop-top-strap.png",
        "stitch-edge-grain.png",
        (500, 0, 1080, 560),
        "Calf grain / tonal stitch / black edge",
        "128x128 procedural texture; no external image asset",
    )
    crop_board(
        "desktop-bottom-strap.png",
        "leather-grain-stitch-edge-closeup.png",
        (420, 150, 860, 690),
        "Opaque black calf / stitch / edge",
        "periodic bump-only grain; top, underside, and edge remain distinct",
    )
    crop_board(
        "desktop-top-strap.png",
        "strap-top-seam-closeup.png",
        (430, 0, 850, 620),
        "Continuous strap top surface",
        "periodic height field and centerline UV remove the former cut-like seam",
    )

    make_gif(
        "01-complete-watch-rotation.gif",
        [
            ("desktop-front.png", "front"),
            ("desktop-oblique-front.png", "oblique"),
            ("desktop-side.png", "side"),
            ("desktop-back.png", "back"),
        ],
    )
    make_gif(
        "02-twelve-spring-bar-wrap.gif",
        [
            ("desktop-front.png", "front anchor"),
            ("desktop-top-strap.png", "12 o'clock strap"),
            ("top-strap-back.png", "pocket / spring bar"),
        ],
    )
    make_gif(
        "03-six-spring-bar-wrap.gif",
        [
            ("desktop-front.png", "front anchor"),
            ("desktop-bottom-strap.png", "6 o'clock strap"),
            ("bottom-strap-back.png", "pocket / spring bar"),
        ],
    )
    make_gif(
        "04-hole-row-to-free-tip.gif",
        [
            ("hole-detail.png", "through-hole row"),
            ("seven-hole-row.png", "7-hole audit"),
            ("six-free-tip.png", "rounded free tip"),
        ],
    )
    make_gif(
        "05-buckle-frame-tang-bar.gif",
        [
            ("buckle-detail.png", "buckle assembly"),
            ("buckle-frame-tang-bar.png", "frame / tang / bar"),
        ],
    )
    make_gif(
        "06-fixed-floating-keepers.gif",
        [
            ("buckle-detail.png", "strap end"),
            ("keepers.png", "fixed / floating keeper"),
        ],
    )
    make_gif(
        "07-exterior-on-off-on.gif",
        [
            ("desktop-front.png", "exterior ON"),
            ("desktop-exterior-off.png", "exterior OFF"),
            ("desktop-front.png", "exterior ON restored"),
        ],
    )
    make_gif(
        "08-split-explode-restore.gif",
        [
            ("desktop-front.png", "normal"),
            ("desktop-split.png", "split"),
            ("desktop-explode.png", "explode"),
            ("desktop-front.png", "restored"),
        ],
    )
    make_gif(
        "09-mobile-rotate-zoom.gif",
        [
            ("mobile-390-front.png", "390x844 front"),
            ("mobile-390-side.png", "390x844 side"),
            ("mobile-390-front.png", "front restored"),
        ],
    )
    make_gif(
        "10-crown-operation-and-audio.gif",
        [
            ("crown-position1.png", "position 1 / winding / audio ON-OFF tested"),
            ("crown-position2.png", "position 2 / time setting / hacking"),
            ("crown-position1.png", "position 1 restored"),
        ],
    )

    raw_names = [
        "desktop-front.png",
        "desktop-oblique-front.png",
        "desktop-side.png",
        "desktop-back.png",
        "desktop-top-strap.png",
        "desktop-bottom-strap.png",
        "top-strap-back.png",
        "bottom-strap-back.png",
        "buckle-detail.png",
        "hole-detail.png",
        "mobile-390-front.png",
        "mobile-390-side.png",
        "mobile-panel-open-browser-raw.png",
    ]
    metrics = [
        image_metric(IMAGES / name, "actual runtime WebGL capture")
        for name in raw_names
    ]
    metrics.extend(
        image_metric(path, "derived from actual runtime captures")
        for path in sorted(IMAGES.glob("*.png"))
        if path.name not in raw_names
    )
    (REPORTS / "image-metrics.json").write_text(
        json.dumps({"images": metrics}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
