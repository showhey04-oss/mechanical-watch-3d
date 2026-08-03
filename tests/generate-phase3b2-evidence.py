#!/usr/bin/env python3
"""Generate Phase 3B.2 visual evidence from actual browser captures.

The script never creates the raw runtime captures.  It requires the existing
WebGL canvas PNGs and in-app browser screenshots, then derives comparison
boards, annotated close-ups, and short review GIFs from those source images.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/final-exterior-balanced-phase3b2"
REPORTS = EVIDENCE / "reports"
DESKTOP_SIZE = (1280, 720)
MOBILE_SIZE = (390, 844)


def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
    candidates = [
        Path("/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc")
        if bold
        else Path("/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"),
        Path("/System/Library/Fonts/Helvetica.ttc"),
        Path("/Library/Fonts/Arial Unicode.ttf"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return ImageFont.truetype(str(candidate), size)
    return ImageFont.load_default()


FONT_18 = font(18)
FONT_22 = font(22)
FONT_26 = font(26, bold=True)
FONT_32 = font(32, bold=True)


def open_source(name: str, expected: tuple[int, int] | None = None) -> Image.Image:
    path = EVIDENCE / name
    if not path.exists():
        raise FileNotFoundError(f"required actual capture is missing: {path}")
    image = Image.open(path).convert("RGB")
    if expected and image.size != expected:
        raise ValueError(f"{name}: expected {expected}, got {image.size}")
    return image


def panel(
    image: Image.Image,
    title: str,
    subtitle: str = "",
    border: tuple[int, int, int] = (62, 190, 255),
) -> Image.Image:
    result = image.copy()
    draw = ImageDraw.Draw(result, "RGBA")
    draw.rectangle((0, 0, result.width, 72), fill=(7, 15, 29, 220))
    draw.rectangle((0, 0, result.width - 1, result.height - 1), outline=border, width=3)
    draw.text((22, 12), title, font=FONT_26, fill=(244, 248, 255))
    if subtitle:
        draw.text((22, 45), subtitle, font=FONT_18, fill=(185, 210, 232))
    return result


def board(
    output: str,
    items: list[tuple[str, str, str]],
    columns: int = 2,
    target: tuple[int, int] = (640, 360),
) -> None:
    rows = (len(items) + columns - 1) // columns
    canvas = Image.new("RGB", (target[0] * columns, target[1] * rows), (8, 14, 25))
    for index, (name, title, subtitle) in enumerate(items):
        source = open_source(name)
        source.thumbnail(target, Image.Resampling.LANCZOS)
        cell = Image.new("RGB", target, (8, 14, 25))
        cell.paste(source, ((target[0] - source.width) // 2, (target[1] - source.height) // 2))
        cell = panel(cell, title, subtitle)
        canvas.paste(cell, ((index % columns) * target[0], (index // columns) * target[1]))
    canvas.save(EVIDENCE / output, format="PNG")


def annotate(
    source_name: str,
    output: str,
    title: str,
    lines: list[str],
    boxes: list[tuple[int, int, int, int, tuple[int, int, int]]] | None = None,
) -> None:
    image = open_source(source_name, DESKTOP_SIZE)
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rectangle((18, 18, 600, 52 + 28 * len(lines)), fill=(5, 12, 25, 218))
    draw.rectangle((18, 18, 600, 52 + 28 * len(lines)), outline=(78, 199, 255), width=2)
    draw.text((36, 30), title, font=FONT_26, fill=(246, 250, 255))
    for index, line in enumerate(lines):
        draw.text((36, 72 + index * 28), line, font=FONT_18, fill=(202, 224, 240))
    for box in boxes or []:
        x0, y0, x1, y1, color = box
        draw.rectangle((x0, y0, x1, y1), outline=color, width=4)
    image.save(EVIDENCE / output, format="PNG")


def crop_annotation(
    source_name: str,
    output: str,
    crop: tuple[int, int, int, int],
    title: str,
    lines: list[str],
) -> None:
    source = open_source(source_name, DESKTOP_SIZE)
    detail = source.crop(crop).resize((960, 540), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(detail, "RGBA")
    draw.rectangle((0, 0, detail.width, 104 + 25 * len(lines)), fill=(5, 12, 25, 210))
    draw.text((24, 16), title, font=FONT_32, fill=(246, 250, 255))
    for index, line in enumerate(lines):
        draw.text((24, 66 + index * 25), line, font=FONT_18, fill=(196, 225, 242))
    detail.save(EVIDENCE / output, format="PNG")


def labelled_frame(name: str, label: str, size: tuple[int, int] = (640, 360)) -> Image.Image:
    image = open_source(name)
    image.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, (7, 14, 25))
    canvas.paste(image, ((size[0] - image.width) // 2, (size[1] - image.height) // 2))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rectangle((0, 0, size[0], 50), fill=(4, 10, 20, 210))
    draw.text((18, 13), label, font=FONT_22, fill=(245, 249, 255))
    return canvas


def make_gif(output: str, frames: list[tuple[str, str]], duration: int = 650) -> None:
    images = [labelled_frame(name, label) for name, label in frames]
    images[0].save(
        EVIDENCE / output,
        format="GIF",
        save_all=True,
        append_images=images[1:],
        duration=duration,
        loop=0,
        disposal=2,
    )


def image_metrics(path: Path) -> dict:
    image = Image.open(path).convert("RGB")
    colors = image.getcolors(maxcolors=image.width * image.height)
    histogram = image.histogram()
    total = image.width * image.height
    dominant = max((count for count, _ in colors), default=0) if colors else None
    stat = ImageStat.Stat(image.convert("L"))
    return {
        "file": path.name,
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "uniqueRgbCount": len(colors) if colors else f">{total}",
        "dominantColorRatio": dominant / total if dominant is not None else None,
        "luminanceVariance": stat.var[0],
        "histogramNonZeroBins": sum(1 for count in histogram if count),
        "source": "actual runtime capture"
        if path.name in {
            "desktop-front.png",
            "desktop-side.png",
            "desktop-back.png",
            "mobile-390-front.png",
            "mobile-390-side.png",
            "mobile-390-back.png",
        }
        else "derived from actual runtime capture",
    }


def main() -> None:
    # The in-app Browser screenshot transport returns JPEG bytes.  Normalize
    # those actual screenshots to real PNG encoding before they enter the
    # evidence set; no pixels are synthesized and WebGL captures are untouched.
    browser_screenshots = [
        "buckle-selection-back.png",
        "buckle-selection.png",
        "internal-selection-opacity-16.png",
        "lug-selection.png",
        "mobile-390-panel-collapsed.png",
        "mobile-390-panel-open.png",
        "spring-bar-selection-exploded.png",
        "strap-pointer-selection.png",
    ]
    for name in browser_screenshots:
        path = EVIDENCE / name
        image = Image.open(path).convert("RGB")
        image.save(path, format="PNG")

    required = {
        "before-desktop-front.png": DESKTOP_SIZE,
        "before-desktop-side.png": DESKTOP_SIZE,
        "before-desktop-back.png": DESKTOP_SIZE,
        "desktop-front.png": DESKTOP_SIZE,
        "desktop-oblique-front.png": DESKTOP_SIZE,
        "desktop-side.png": DESKTOP_SIZE,
        "desktop-back.png": DESKTOP_SIZE,
        "desktop-oblique-back.png": DESKTOP_SIZE,
        "mobile-390-front.png": MOBILE_SIZE,
        "mobile-390-side.png": MOBILE_SIZE,
        "mobile-390-back.png": MOBILE_SIZE,
        "opacity-50.png": DESKTOP_SIZE,
        "opacity-16.png": DESKTOP_SIZE,
        "attachments-hidden.png": DESKTOP_SIZE,
        "exploded.png": DESKTOP_SIZE,
        "side-split.png": DESKTOP_SIZE,
        "crown-position-1.png": DESKTOP_SIZE,
        "crown-position-2.png": DESKTOP_SIZE,
        "lug-selection.png": DESKTOP_SIZE,
        "spring-bar-selection-exploded.png": DESKTOP_SIZE,
        "strap-pointer-selection.png": DESKTOP_SIZE,
        "buckle-selection-back.png": DESKTOP_SIZE,
        "internal-selection-opacity-16.png": DESKTOP_SIZE,
        "mobile-390-panel-collapsed.png": MOBILE_SIZE,
        "mobile-390-panel-open.png": MOBILE_SIZE,
    }
    for name, expected in required.items():
        open_source(name, expected)

    board(
        "comparison-front.png",
        [
            ("before-desktop-front.png", "Phase 3B.1", "approved core shell"),
            ("desktop-front.png", "Phase 3B.2", "lugs + straps + buckle"),
        ],
    )
    board(
        "comparison-side.png",
        [
            ("before-desktop-side.png", "Phase 3B.1", "approved core shell"),
            ("desktop-side.png", "Phase 3B.2", "attachment world bounds"),
        ],
    )
    board(
        "comparison-back.png",
        [
            ("before-desktop-back.png", "Phase 3B.1", "approved core shell"),
            ("desktop-back.png", "Phase 3B.2", "rear attachment relationship"),
        ],
    )
    board(
        "transparency-board.png",
        [
            ("desktop-front.png", "100%", "structural opacity"),
            ("opacity-50.png", "50%", "internal relationship"),
            ("opacity-16.png", "16%", "internal picking retained"),
            ("attachments-hidden.png", "Hidden", "core shell restored"),
        ],
    )
    board(
        "selection-board.png",
        [
            ("lug-selection.png", "Lug", "highlight + HUD"),
            ("spring-bar-selection-exploded.png", "Spring bar", "isolated selection"),
            ("strap-pointer-selection.png", "Strap", "normal pointer path"),
            ("buckle-selection-back.png", "Buckle", "back view selection"),
            ("internal-selection-opacity-16.png", "Internal", "setting wheel at 16%"),
        ],
    )
    board(
        "mobile-board.png",
        [
            ("mobile-390-front.png", "390×844 front", "actual WebGL canvas"),
            ("mobile-390-side.png", "390×844 side", "actual WebGL canvas"),
            ("mobile-390-back.png", "390×844 back", "actual WebGL canvas"),
            ("mobile-390-opacity-50.png", "390×844 at 50%", "structural opacity"),
            ("mobile-390-panel-collapsed.png", "Panel collapsed", "actual in-app browser"),
            ("mobile-390-panel-open.png", "Panel open", "actual in-app browser"),
        ],
        columns=2,
        target=(390, 844),
    )
    board(
        "visibility-display-board.png",
        [
            ("desktop-front.png", "Normal", "absolute transforms"),
            ("exploded.png", "Exploded", "reversible offsets"),
            ("side-split.png", "Front/back split", "reversible offsets"),
            ("attachments-hidden.png", "Attachments hidden", "Phase 3B.1 core"),
        ],
    )

    annotate(
        "desktop-front.png",
        "camera-occupancy-diagram.png",
        "Camera occupancy / world bounds",
        [
            "Core shell: 39.600 × 8.695 × 39.600",
            "Attachments: 24.400 × 30.101 × 88.202",
            "Existing camera presets and near/far are unchanged",
            "Review uses reversible wheel zoom-out; no default camera adoption",
        ],
        [(500, 68, 780, 654, (75, 213, 255))],
    )
    crop_annotation(
        "desktop-front.png",
        "lug-connection-12.png",
        (370, 0, 910, 360),
        "12 o'clock lug interface",
        ["outer Z +23.300", "spring-bar centre Z +21.800 / Y +2.800", "intended lug-case connection"],
    )
    crop_annotation(
        "desktop-front.png",
        "lug-connection-6.png",
        (370, 360, 910, 720),
        "6 o'clock lug interface",
        ["outer Z -23.300", "spring-bar centre Z -21.800 / Y +2.800", "intended lug-case connection"],
    )
    crop_annotation(
        "desktop-side.png",
        "crown-side-lug.png",
        (460, 110, 1000, 650),
        "Crown-side lug clearance",
        ["position 1 / position 2 forbidden interference: 0", "crown and A.7 absolute placement unchanged"],
    )
    crop_annotation(
        "spring-bar-selection-exploded.png",
        "spring-bar-diagram.png",
        (300, 70, 980, 650),
        "Educational spring-bar geometry",
        ["main Ø1.500 / main length 20.000", "effective pin-to-pin length 20.800", "spring and manufacturing tolerance: UNVERIFIED"],
    )
    crop_annotation(
        "desktop-oblique-front.png",
        "strap-connection.png",
        (300, 0, 980, 620),
        "Strap connection and tangent continuity",
        ["lug-side width 20.000", "end width 16.500 / thickness 2.400", "12-side 42.000 / 6-side 58.000 centreline"],
    )
    crop_annotation(
        "buckle-selection-back.png",
        "buckle-detail.png",
        (360, 0, 980, 430),
        "Simplified structural buckle",
        ["inner width 16.800 / outer width 18.400", "functional tongue and final finish deferred to Phase 3C"],
    )

    make_gif(
        "video-01-full-rotation.gif",
        [
            ("desktop-front.png", "Front"),
            ("desktop-oblique-front.png", "Oblique front"),
            ("desktop-side.png", "Side"),
            ("desktop-oblique-back.png", "Oblique back"),
            ("desktop-back.png", "Back"),
            ("desktop-side.png", "Side return"),
            ("desktop-front.png", "Front return"),
        ],
        850,
    )
    make_gif(
        "video-02-lug-close-rotation.gif",
        [
            ("lug-connection-12.png", "12 o'clock connection"),
            ("desktop-oblique-front.png", "Oblique connection"),
            ("crown-side-lug.png", "Crown-side connection"),
            ("lug-connection-6.png", "6 o'clock connection"),
        ],
        1100,
    )
    make_gif(
        "video-03-strap-close-rotation.gif",
        [
            ("desktop-front.png", "Front strap relation"),
            ("strap-connection.png", "Connection close-up"),
            ("desktop-side.png", "Curved centreline"),
            ("desktop-back.png", "Back strap relation"),
        ],
        1100,
    )
    make_gif(
        "video-04-crown-position-relation.gif",
        [
            ("crown-position-1.png", "Position 1 / winding"),
            ("crown-position-2.png", "Position 2 / time setting"),
        ],
        2200,
    )
    make_gif(
        "video-05-opacity-cycle.gif",
        [
            ("desktop-front.png", "100%"),
            ("opacity-50.png", "50%"),
            ("opacity-16.png", "16%"),
            ("attachments-hidden.png", "Attachments hidden"),
            ("desktop-front.png", "Restored 100%"),
        ],
        1000,
    )
    make_gif(
        "video-06-selection-cycle.gif",
        [
            ("lug-selection.png", "Lug"),
            ("spring-bar-selection-exploded.png", "Spring bar"),
            ("strap-pointer-selection.png", "Strap"),
            ("buckle-selection-back.png", "Buckle"),
            ("internal-selection-opacity-16.png", "Internal setting wheel"),
        ],
        1000,
    )
    make_gif(
        "video-07-mobile-rotation-zoom.gif",
        [
            ("mobile-390-front.png", "390×844 front"),
            ("mobile-390-side.png", "390×844 side"),
            ("mobile-390-back.png", "390×844 back"),
            ("mobile-390-opacity-50.png", "390×844 opacity 50%"),
            ("mobile-390-panel-open.png", "390×844 panel open"),
        ],
        1000,
    )
    make_gif(
        "video-08-mechanism-operation.gif",
        [
            ("crown-position-1.png", "Position 1 / winding"),
            ("crown-position-2.png", "Position 2 / time setting + stop seconds"),
            ("internal-selection-opacity-16.png", "Mechanism remains selectable"),
            ("desktop-front.png", "Attachments restored"),
        ],
        1200,
    )

    image_names = sorted(path.name for path in EVIDENCE.glob("*.png"))
    metrics = {
        "schemaVersion": 1,
        "sourceImplementationCommit": "51ab089e898cc3d2216d97fece83e334d9cd49c3",
        "captureMode": "actual WebGL canvas plus actual in-app browser screenshots",
        "rawCaptureCreationByThisScript": False,
        "images": [image_metrics(EVIDENCE / name) for name in image_names],
    }
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / "image-evidence-report.json").write_text(
        json.dumps(metrics, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
