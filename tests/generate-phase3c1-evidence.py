#!/usr/bin/env python3
"""Build Phase 3C.1 review evidence from actual browser captures.

The raw Three.js captures are prerequisites. This script never synthesizes
desktop/mobile runtime images; it only normalizes actual Browser screenshots,
copies the approved Phase 3B.2 comparison captures, and derives annotated
boards, close-ups, diagrams, and review GIFs from those sources.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/final-exterior-design-phase3c1"
REPORTS = EVIDENCE / "reports"
BASE_EVIDENCE = ROOT / "docs/evidence/final-exterior-balanced-phase3b2"
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


FONT_16 = font(16)
FONT_18 = font(18)
FONT_22 = font(22)
FONT_26 = font(26, True)
FONT_32 = font(32, True)


def open_image(path: Path, expected: tuple[int, int] | None = None) -> Image.Image:
    if not path.exists():
        raise FileNotFoundError(f"required actual capture is missing: {path}")
    image = Image.open(path)
    image.load()
    if expected and image.size != expected:
        raise ValueError(f"{path.name}: expected {expected}, got {image.size}")
    return image.convert("RGB")


def open_source(name: str, expected: tuple[int, int] | None = None) -> Image.Image:
    return open_image(EVIDENCE / name, expected)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def normalize_browser_screenshot(name: str) -> None:
    path = EVIDENCE / name
    image = open_image(path)
    image.save(path, format="PNG")


def copy_base_capture(source_name: str, target_name: str) -> None:
    image = open_image(BASE_EVIDENCE / source_name, DESKTOP_SIZE)
    image.save(EVIDENCE / target_name, format="PNG")


def labelled_panel(
    image: Image.Image,
    title: str,
    subtitle: str,
    border: tuple[int, int, int] = (84, 198, 239),
) -> Image.Image:
    result = image.copy()
    draw = ImageDraw.Draw(result, "RGBA")
    draw.rectangle((0, 0, result.width, 74), fill=(6, 12, 23, 222))
    draw.rectangle((0, 0, result.width - 1, result.height - 1), outline=border, width=3)
    draw.text((20, 12), title, font=FONT_26, fill=(246, 250, 255))
    draw.text((20, 46), subtitle, font=FONT_16, fill=(188, 215, 232))
    return result


def board(
    output: str,
    items: list[tuple[str, str, str]],
    columns: int = 2,
    cell_size: tuple[int, int] = (640, 360),
) -> None:
    rows = (len(items) + columns - 1) // columns
    canvas = Image.new("RGB", (cell_size[0] * columns, cell_size[1] * rows), (7, 13, 23))
    for index, (name, title, subtitle) in enumerate(items):
        source = open_source(name)
        source.thumbnail(cell_size, Image.Resampling.LANCZOS)
        cell = Image.new("RGB", cell_size, (7, 13, 23))
        cell.paste(source, ((cell.width - source.width) // 2, (cell.height - source.height) // 2))
        canvas.paste(
            labelled_panel(cell, title, subtitle),
            ((index % columns) * cell_size[0], (index // columns) * cell_size[1]),
        )
    canvas.save(EVIDENCE / output, format="PNG")


def annotate_full(
    source_name: str,
    output: str,
    title: str,
    lines: list[str],
    ellipse: tuple[int, int, int, int] | None = None,
    arrows: list[tuple[tuple[int, int], tuple[int, int], str]] | None = None,
) -> None:
    image = open_source(source_name, DESKTOP_SIZE)
    draw = ImageDraw.Draw(image, "RGBA")
    height = 66 + len(lines) * 26
    draw.rounded_rectangle((18, 18, 610, height), 10, fill=(4, 10, 20, 220), outline=(82, 205, 244), width=2)
    draw.text((34, 30), title, font=FONT_26, fill=(247, 251, 255))
    for index, line in enumerate(lines):
        draw.text((34, 68 + index * 26), line, font=FONT_18, fill=(198, 224, 240))
    if ellipse:
        draw.ellipse(ellipse, outline=(255, 205, 87), width=5)
    for start, end, label in arrows or []:
        draw.line((*start, *end), fill=(255, 205, 87), width=4)
        draw.ellipse((end[0] - 5, end[1] - 5, end[0] + 5, end[1] + 5), fill=(255, 205, 87))
        draw.text((start[0], start[1] - 24), label, font=FONT_16, fill=(255, 224, 148))
    image.save(EVIDENCE / output, format="PNG")


def closeup(
    source_name: str,
    output: str,
    crop: tuple[int, int, int, int],
    title: str,
    lines: list[str],
) -> None:
    source = open_source(source_name, DESKTOP_SIZE)
    detail = source.crop(crop).resize((960, 540), Image.Resampling.LANCZOS)
    draw = ImageDraw.Draw(detail, "RGBA")
    draw.rectangle((0, 0, 960, 82 + 25 * len(lines)), fill=(4, 10, 20, 212))
    draw.text((24, 14), title, font=FONT_32, fill=(247, 251, 255))
    for index, line in enumerate(lines):
        draw.text((24, 62 + index * 25), line, font=FONT_18, fill=(198, 224, 240))
    detail.save(EVIDENCE / output, format="PNG")


def profile_diagram(output: str) -> None:
    runtime = json.loads((REPORTS / "desktop-runtime.json").read_text())
    line_of_sight = runtime["geometry"]["lineOfSight"]
    audit = runtime["geometry"]["openHeart"]
    image = Image.new("RGB", (1280, 720), (10, 17, 28))
    draw = ImageDraw.Draw(image, "RGBA")
    draw.text((28, 22), "Phase 3C.1 open-heart obstruction / support section", font=FONT_32, fill=(246, 250, 255))
    draw.text((28, 66), "read-only diagram generated from actual runtime Raycaster and Geometry reports", font=FONT_18, fill=(175, 207, 228))
    center_x = 640
    layers = [
        ("ivory dial", -2.02, (214, 194, 149)),
        ("replacement plate", -0.56, (114, 129, 145)),
        ("balance / hairspring", 1.73, (212, 223, 232)),
        ("balance bridge", 3.60, (152, 166, 181)),
    ]
    min_y, max_y = -3.0, 4.3
    scale = 78
    for label, y_value, color in layers:
        y = 650 - int((y_value - min_y) * scale)
        draw.rectangle((250, y - 10, 1030, y + 10), fill=(*color, 190))
        draw.text((50, y - 12), f"{label}  Y={y_value:.3f}", font=FONT_18, fill=(235, 241, 247))
    dial_y = 650 - int((-2.02 - min_y) * scale)
    balance_y = 650 - int((1.73 - min_y) * scale)
    draw.rectangle((center_x - 100, dial_y - 16, center_x + 100, dial_y + 16), outline=(255, 205, 87), width=3)
    draw.line((center_x, dial_y, center_x, balance_y), fill=(78, 218, 161), width=5)
    draw.text((center_x + 18, (dial_y + balance_y) // 2), "actual +Y Raycaster line of sight", font=FONT_18, fill=(111, 235, 184))
    draw.text((760, 138), f"samples: {line_of_sight['sampleCount']}", font=FONT_18, fill=(238, 244, 249))
    draw.text((760, 170), f"mechanism visible: {line_of_sight['intendedMechanismVisibleRate']:.6f}", font=FONT_18, fill=(238, 244, 249))
    draw.text((760, 202), f"bearing retained: {line_of_sight['protectedBearingLandRetained']}", font=FONT_18, fill=(238, 244, 249))
    draw.text((760, 234), f"plate window/opening: {audit['cutout']['plateWindowToDialOpeningRatio']:.6f}", font=FONT_18, fill=(238, 244, 249))
    image.save(EVIDENCE / output, format="PNG")


def labelled_frame(name: str, label: str, size: tuple[int, int] = (640, 360)) -> Image.Image:
    source = open_source(name)
    source.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, (7, 13, 23))
    canvas.paste(source, ((canvas.width - source.width) // 2, (canvas.height - source.height) // 2))
    draw = ImageDraw.Draw(canvas, "RGBA")
    draw.rectangle((0, 0, canvas.width, 48), fill=(4, 9, 18, 216))
    draw.text((16, 12), label, font=FONT_22, fill=(246, 250, 255))
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


def image_metric(path: Path, source: str) -> dict:
    image = Image.open(path).convert("RGB")
    colors = image.getcolors(maxcolors=image.width * image.height)
    total = image.width * image.height
    dominant = max((count for count, _ in colors), default=0) if colors else None
    return {
        "file": path.name,
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "uniqueRgbCount": len(colors) if colors else f">{total}",
        "dominantColorRatio": dominant / total if dominant is not None else None,
        "luminanceVariance": ImageStat.Stat(image.convert("L")).var[0],
        "source": source,
    }


def main() -> None:
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    REPORTS.mkdir(parents=True, exist_ok=True)

    for name in ["panel-open-browser.png", "panel-collapsed-browser.png", "part-selection-ui.png"]:
        normalize_browser_screenshot(name)

    copy_base_capture("desktop-front.png", "before-phase3b2-front.png")
    copy_base_capture("desktop-oblique-front.png", "before-phase3b2-oblique-front.png")
    copy_base_capture("desktop-side.png", "before-phase3b2-side.png")
    copy_base_capture("desktop-back.png", "before-phase3b2-back.png")
    copy_base_capture("desktop-oblique-back.png", "before-phase3b2-oblique-back.png")

    required = {
        "desktop-front.png": DESKTOP_SIZE,
        "desktop-oblique-front.png": DESKTOP_SIZE,
        "desktop-side.png": DESKTOP_SIZE,
        "desktop-back.png": DESKTOP_SIZE,
        "desktop-oblique-back.png": DESKTOP_SIZE,
        "opacity-50.png": DESKTOP_SIZE,
        "opacity-16.png": DESKTOP_SIZE,
        "crown-position-2.png": DESKTOP_SIZE,
        "mobile-390-front.png": MOBILE_SIZE,
        "mobile-390-oblique-front.png": MOBILE_SIZE,
        "mobile-390-side.png": MOBILE_SIZE,
        "mobile-390-opacity-16.png": MOBILE_SIZE,
        "normal-base-phase3b2.png": DESKTOP_SIZE,
        "normal-branch.png": DESKTOP_SIZE,
    }
    for name, expected in required.items():
        open_source(name, expected)

    # Position 1 uses the actual side capture. It is copied as a distinct review
    # source because position 2 was captured separately in the Browser.
    open_source("desktop-side.png", DESKTOP_SIZE).save(EVIDENCE / "crown-position-1.png", format="PNG")

    board("comparison-front.png", [
        ("before-revision-front.png", "Initial Phase 3C.1", "human-review rejected"),
        ("desktop-front.png", "Revised Phase 3C.1", "warm ivory + silver hierarchy"),
    ])
    board("comparison-oblique-front.png", [
        ("before-revision-oblique-front.png", "Initial Phase 3C.1", "dark dial / weak hierarchy"),
        ("desktop-oblique-front.png", "Revised Phase 3C.1", "ivory dial + dome + profiled rim"),
    ])
    board("comparison-side.png", [
        ("before-revision-side.png", "Initial Phase 3C.1", "dome visually weak"),
        ("desktop-side.png", "Revised Phase 3C.1", "stronger dome / same 8.695 envelope"),
    ])
    board("comparison-back.png", [
        ("before-revision-back.png", "Initial Phase 3C.1", "rear geometry"),
        ("desktop-back.png", "Revised Phase 3C.1", "protected rear geometry unchanged"),
    ])
    board("comparison-oblique-back.png", [
        ("before-revision-oblique-back.png", "Initial Phase 3C.1", "existing attachment structure"),
        ("desktop-oblique-back.png", "Revised Phase 3C.1", "silver compensation / structure preserved"),
    ])
    board("opacity-board.png", [
        ("desktop-front.png", "100%", "candidate watch head"),
        ("opacity-50.png", "50%", "structural opacity"),
        ("opacity-16.png", "16%", "internal selection retained"),
        ("part-selection-ui.png", "Selection", "highlight + HUD + learning sync"),
    ])
    board(
        "mobile-board.png",
        [
            ("mobile-390-front.png", "390×844 front", "actual WebGL capture"),
            ("mobile-390-oblique-front.png", "390×844 oblique", "actual WebGL capture"),
            ("mobile-390-side.png", "390×844 side", "actual WebGL capture"),
            ("mobile-390-opacity-16.png", "390×844 at 16%", "internal relationship"),
        ],
        columns=2,
        cell_size=(390, 844),
    )
    board("panel-board.png", [
        ("panel-collapsed-browser.png", "Panel collapsed", "actual in-app Browser 664×814"),
        ("panel-open-browser.png", "Panel open", "actual in-app Browser 664×814"),
    ], cell_size=(664, 814))

    open_heart_box = (752, 267, 864, 379)
    annotate_full(
        "desktop-front.png",
        "actual-balance-position.png",
        "Actual balance projection",
        [
            "balance world center: X 7.700 / Y 1.730 / Z 1.800",
            "dial projection: X 7.700 / Z 1.800",
            "clock angle from 12: 76.842457° (actual geometry)",
            "reference-image nominal placement was not used",
        ],
        ellipse=open_heart_box,
        arrows=[((960, 245), (808, 323), "actual balance / open-heart center")],
    )
    annotate_full(
        "desktop-front.png",
        "dial-plane-projection.png",
        "Dial-plane projection and protected display",
        [
            "opening diameter 6.600 / edge ring 0.320",
            "opening area ratio 3.5559% (limit 10%)",
            "small-second clearance 3.1894",
            "nearest index clearance 1.3605",
        ],
        ellipse=open_heart_box,
    )
    annotate_full(
        "desktop-front.png",
        "line-of-sight.png",
        "Actual +Y Raycaster line of sight",
        [
            "709 samples across physical circular aperture",
            "intended mechanism first-hit rate 0.165021",
            "balance first-hit rate 0.133992",
            "mechanism moved/hidden: false / false",
        ],
        ellipse=open_heart_box,
        arrows=[((954, 262), (808, 323), "+Y samples through actual aperture")],
    )
    annotate_full(
        "desktop-front.png",
        "open-heart-candidate.png",
        "Limited open-heart candidate",
        [
            "twin plate windows preserve central shock bearing",
            "window radius 1.320 / center offset 1.900",
            "bearing-land clearance 0.100",
            "not a tourbillon and not a full-skeleton presentation",
        ],
        ellipse=open_heart_box,
    )
    profile_diagram("obstruction-section.png")

    closeup("desktop-front.png", "open-heart-close.png", (690, 210, 930, 450), "Open-heart close-up", [
        "physical dial aperture + polished edge ring",
        "actual balance and hairspring line of sight",
    ])
    closeup("desktop-front.png", "small-second-close.png", (500, 385, 780, 665), "6 o'clock small seconds", [
        "lighter recessed face / 12 major + 48 minor marks",
        "blue-steel-tone hand #2A5572",
        "S86 center and fourth-arbor coupling unchanged",
    ])
    closeup("desktop-front.png", "indices-close.png", (410, 90, 870, 360), "Polished bar indices", [
        "faceted 1.400 × 0.320 × 0.190 bars",
        "double marker at 12 / 6 omitted for small seconds",
        "S86 index circle 25.456 unchanged",
    ])
    closeup("desktop-front.png", "hands-close.png", (430, 190, 850, 555), "Faceted polished hands", [
        "minute 12.040 / hour 8.600 / small second 3.268",
        "shared tapered silhouette with raised center ridge",
        "all three remain 1:1 coupled to their physical drivers",
    ])
    closeup("desktop-side.png", "domed-crystal-side.png", (300, 100, 980, 620), "Strengthened dome crystal", [
        "protected Y envelope -3.460 to -2.860",
        "outer profile: -3.460 / -3.450 / -3.405 / -3.295 / -3.120 / -3.000",
        "existing camera, light, shadow, tone mapping unchanged",
    ])
    closeup("crown-position-1.png", "crown-position-1-close.png", (650, 170, 1090, 610), "Crown position 1", [
        "Phase 3B.1 absolute placement and gap preserved",
    ])
    closeup("crown-position-2.png", "crown-position-2-close.png", (650, 170, 1090, 610), "Crown position 2", [
        "time setting and no-drift placement preserved",
    ])

    board("open-heart-before-after.png", [
        ("before-revision-front.png", "Before revision", "simple ring / dark dial"),
        ("desktop-front.png", "Revised", "profiled silver rim / warm ivory"),
    ])
    board("comparison-open-heart.png", [
        ("before-revision-open-heart-close.png", "Initial open heart", "human-review rejected"),
        ("open-heart-close.png", "Revised open heart", "profiled closed metal rim"),
    ])
    board("comparison-indices.png", [
        ("before-revision-indices-close.png", "Initial indices / minute track", "short bars and line marks"),
        ("indices-close.png", "Revised indices / minute dots", "faceted bars + circular dots"),
    ])
    board("comparison-hands.png", [
        ("before-revision-hands-close.png", "Initial hands", "flat thin silhouette"),
        ("hands-close.png", "Revised hands", "tapered facets + center ridge"),
    ])
    board("comparison-small-second.png", [
        ("before-revision-small-second-close.png", "Initial small seconds", "low hierarchy"),
        ("small-second-close.png", "Revised small seconds", "lighter recess + blue hand"),
    ])
    board("comparison-domed-crystal.png", [
        ("before-revision-domed-crystal-side.png", "Initial crystal", "dome hard to read"),
        ("domed-crystal-side.png", "Revised crystal", "stronger protected profile"),
    ])
    board("comparison-crown.png", [
        ("crown-position-1-close.png", "Position 1", "protected Phase 3B.1 placement"),
        ("crown-position-2-close.png", "Position 2", "absolute no-drift placement"),
    ])

    annotate_full(
        "desktop-front.png",
        "revision-reference-alignment.png",
        "Reference-aligned revision (not a geometry copy)",
        [
            "warm ivory #BCAB8E / small seconds #CCB89F",
            "educational polished steel visibility compensation",
            "faceted bars + double 12 + circular minute dots",
            "faceted silver hands + blue small-second hand",
            "stronger dome within the protected 8.695 envelope",
        ],
        ellipse=open_heart_box,
    )
    annotate_full(
        "desktop-front.png",
        "issue2-shadow-boundary.png",
        "Issue #2 separation — inherited rectangular shadow boundary",
        [
            "boundary intentionally retained in normal rendering",
            "lighting / shadow map / transparent / depthWrite unchanged",
            "100→99 and 55→54 continuity remain deferred to Issue #2",
        ],
        arrows=[((80, 170), (600, 290), "known rectangular boundary")],
    )
    closeup(
        "desktop-front.png",
        "dial-outside-shadow-close.png",
        (300, 65, 665, 310),
        "Dial region outside the inherited shadow",
        [
            "warm ivory without emissive or white-out",
            "round minute dots and faceted bars remain readable",
        ],
    )
    closeup(
        "desktop-side.png",
        "silver-case-side.png",
        (240, 90, 1040, 630),
        "Silver case midtone — protected lighting",
        [
            "educational visibility compensation only",
            "light, shadow, environment, exposure, and D2c3 unchanged",
        ],
    )
    closeup(
        "desktop-oblique-front.png",
        "domed-crystal-oblique.png",
        (250, 40, 1030, 620),
        "Domed crystal — oblique view",
        [
            "curvature is visible without changing the total case thickness",
            "bezel interface and protected clear diameter are unchanged",
        ],
    )

    make_gif("video-01-watch-head-views.gif", [
        ("desktop-front.png", "front"),
        ("desktop-oblique-front.png", "oblique front"),
        ("desktop-side.png", "side"),
        ("desktop-oblique-back.png", "oblique back"),
        ("desktop-back.png", "back"),
    ])
    make_gif("video-02-dial-close-review.gif", [
        ("indices-close.png", "faceted bars + minute dots"),
        ("hands-close.png", "faceted silver hands"),
        ("small-second-close.png", "lighter small seconds"),
    ])
    make_gif("video-03-open-heart-review.gif", [
        ("before-revision-front.png", "initial candidate rejected"),
        ("desktop-front.png", "revised candidate"),
        ("open-heart-close.png", "open-heart close"),
    ])
    make_gif("video-04-small-second-review.gif", [
        ("before-revision-small-second-close.png", "initial small seconds"),
        ("small-second-close.png", "revised small seconds"),
        ("desktop-front.png", "revised whole dial"),
    ])
    make_gif("video-05-hands-review.gif", [
        ("before-revision-hands-close.png", "initial hands"),
        ("hands-close.png", "revised faceted hands"),
        ("desktop-front.png", "10:10:30 coupling"),
    ])
    make_gif("video-06-crystal-side-review.gif", [
        ("before-revision-domed-crystal-side.png", "initial dome"),
        ("domed-crystal-side.png", "revised dome"),
        ("desktop-oblique-front.png", "oblique curvature"),
    ])
    make_gif("video-07-crown-position-cycle.gif", [
        ("crown-position-1.png", "position 1"),
        ("crown-position-2.png", "position 2"),
        ("crown-position-1.png", "position 1 restored"),
    ])
    make_gif("video-08-mobile-review.gif", [
        ("mobile-390-front.png", "390×844 front"),
        ("mobile-390-oblique-front.png", "390×844 oblique"),
        ("mobile-390-side.png", "390×844 side"),
        ("mobile-390-opacity-16.png", "390×844 at 16%"),
    ])

    raw_names = [
        "desktop-front.png", "desktop-oblique-front.png", "desktop-side.png",
        "desktop-back.png", "desktop-oblique-back.png", "opacity-50.png",
        "opacity-16.png", "crown-position-2.png", "mobile-390-front.png",
        "mobile-390-oblique-front.png", "mobile-390-side.png",
        "mobile-390-opacity-16.png", "normal-base-phase3b2.png", "normal-branch.png",
    ]
    image_report = {
        "sourceImplementationCommit": "11c37f22936c5606673c80628cc1422d620fa7e2",
        "sourceBaseCommit": "98d83781aa7aa001836a0d57f1ad6e3d058a15c4",
        "mainCommit": "293626f13a50224924f8e3ac229a1fc4077ad7a7",
        "sourceBranch": "feature/final-exterior-balanced-phase3c1-watch-head",
        "appVersion": "v3.15.0",
        "captureMode": "same-origin browser harness and actual WebGL canvas capture",
        "rawCaptureCreationByThisScript": False,
        "images": [image_metric(EVIDENCE / name, "actual runtime capture") for name in raw_names],
        "browserScreenshots": [
            image_metric(EVIDENCE / name, "actual in-app Browser screenshot")
            for name in ["panel-open-browser.png", "panel-collapsed-browser.png", "part-selection-ui.png"]
        ],
    }
    for metric in image_report["images"]:
        if isinstance(metric["uniqueRgbCount"], int) and metric["uniqueRgbCount"] < 500:
            raise RuntimeError(f"flat runtime capture: {metric}")
        if metric["luminanceVariance"] <= 20:
            raise RuntimeError(f"insufficient runtime pixel variance: {metric}")
        if metric["dominantColorRatio"] is not None and metric["dominantColorRatio"] >= 0.96:
            raise RuntimeError(f"dominant background capture: {metric}")
    (REPORTS / "image-evidence-report.json").write_text(
        json.dumps(image_report, ensure_ascii=False, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
