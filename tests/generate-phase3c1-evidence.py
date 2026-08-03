#!/usr/bin/env python3
"""Build Phase 3C.1 review evidence from actual browser captures.

The raw Three.js captures are prerequisites. This script never synthesizes
desktop/mobile runtime images; it only normalizes actual Browser screenshots,
copies the approved Phase 3B.2 comparison captures, and derives annotated
boards, close-ups, diagrams, and review GIFs from those sources.
"""

from __future__ import annotations

import hashlib
import io
import json
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageStat


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/final-exterior-design-phase3c1"
REPORTS = EVIDENCE / "reports"
BASE_EVIDENCE = ROOT / "docs/evidence/final-exterior-balanced-phase3b2"
DESKTOP_SIZE = (1280, 720)
MOBILE_SIZE = (390, 844)
SOURCE_IMPLEMENTATION_COMMIT = "50d651bea6d91b4be978e9e3b40a73053497c104"
SOURCE_BASE_COMMIT = "98d83781aa7aa001836a0d57f1ad6e3d058a15c4"
THIRD_CANDIDATE_COMMIT = "658ee82ec902184a325862cdb878a38205376206"


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


def copy_git_capture(commit: str, source_name: str, target_name: str) -> None:
    source_path = (
        f"docs/evidence/final-exterior-design-phase3c1/{source_name}"
    )
    completed = subprocess.run(
        ["git", "show", f"{commit}:{source_path}"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
    )
    image = Image.open(io.BytesIO(completed.stdout))
    image.load()
    image.convert("RGB").save(EVIDENCE / target_name, format="PNG")


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


def comparison_crop_board(
    output: str,
    items: list[tuple[str, tuple[int, int, int, int], str, str]],
    cell_size: tuple[int, int] = (640, 360),
) -> None:
    canvas = Image.new("RGB", (cell_size[0] * len(items), cell_size[1]), (7, 13, 23))
    for index, (name, crop, title, subtitle) in enumerate(items):
        source = open_source(name, DESKTOP_SIZE).crop(crop)
        source.thumbnail(cell_size, Image.Resampling.LANCZOS)
        cell = Image.new("RGB", cell_size, (7, 13, 23))
        cell.paste(source, ((cell.width - source.width) // 2, (cell.height - source.height) // 2))
        canvas.paste(
            labelled_panel(cell, title, subtitle),
            (index * cell_size[0], 0),
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

    for name in [
        "panel-open-browser.png",
        "panel-collapsed-browser.png",
        "part-selection-ui.png",
        "index-selection-ui.png",
        "hand-selection-ui.png",
        "crystal-selection-ui.png",
        "opacity16-internal-selection-ui.png",
    ]:
        normalize_browser_screenshot(name)

    copy_base_capture("desktop-front.png", "before-phase3b2-front.png")
    copy_base_capture("desktop-oblique-front.png", "before-phase3b2-oblique-front.png")
    copy_base_capture("desktop-side.png", "before-phase3b2-side.png")
    copy_base_capture("desktop-back.png", "before-phase3b2-back.png")
    copy_base_capture("desktop-oblique-back.png", "before-phase3b2-oblique-back.png")
    for source_name in [
        "desktop-front.png",
        "desktop-oblique-front.png",
        "desktop-side.png",
        "desktop-back.png",
        "desktop-oblique-back.png",
    ]:
        copy_git_capture(
            THIRD_CANDIDATE_COMMIT,
            source_name,
            f"before-fourth-{source_name.removeprefix('desktop-')}",
        )

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
        "display-normal.png": DESKTOP_SIZE,
        "display-split-100.png": DESKTOP_SIZE,
        "display-explode-100.png": DESKTOP_SIZE,
        "display-restored.png": DESKTOP_SIZE,
        "normal-base-phase3b2.png": DESKTOP_SIZE,
        "normal-branch.png": DESKTOP_SIZE,
        "crystal-hidden-front.png": DESKTOP_SIZE,
        "exterior-off.png": DESKTOP_SIZE,
        "exterior-internal-selection.png": DESKTOP_SIZE,
        "exterior-split-off.png": DESKTOP_SIZE,
        "exterior-explode-off.png": DESKTOP_SIZE,
        "exterior-opacity16-off.png": DESKTOP_SIZE,
        "exterior-off-hands-t0.png": DESKTOP_SIZE,
        "exterior-off-hands-t1.png": DESKTOP_SIZE,
        "exterior-off-hands-t2.png": DESKTOP_SIZE,
        "exterior-off-crown-position1.png": DESKTOP_SIZE,
        "exterior-off-crown-position2.png": DESKTOP_SIZE,
        "index-selection-ui.png": DESKTOP_SIZE,
        "hand-selection-ui.png": DESKTOP_SIZE,
        "crystal-selection-ui.png": DESKTOP_SIZE,
        "opacity16-internal-selection-ui.png": DESKTOP_SIZE,
    }
    for name, expected in required.items():
        open_source(name, expected)

    # Position 1 uses the actual side capture. It is copied as a distinct review
    # source because position 2 was captured separately in the Browser.
    open_source("desktop-side.png", DESKTOP_SIZE).save(EVIDENCE / "crown-position-1.png", format="PNG")

    board("comparison-front.png", [
        ("before-fourth-front.png", "Third candidate", "human-review revision base"),
        ("desktop-front.png", "Fourth candidate", "stable silver + radius 14.2 track"),
    ])
    board("comparison-oblique-front.png", [
        ("before-fourth-oblique-front.png", "Third candidate", "transmissive dome / mixed highlights"),
        ("desktop-oblique-front.png", "Fourth candidate", "non-refractive dome / stable silver"),
    ])
    board("comparison-side.png", [
        ("before-fourth-side.png", "Third candidate", "transmissive dome"),
        ("desktop-side.png", "Fourth candidate", "same geometry / non-refractive material"),
    ])
    board("comparison-back.png", [
        ("before-fourth-back.png", "Third candidate", "accepted structure"),
        ("desktop-back.png", "Fourth candidate", "stable exterior silver clones"),
    ])
    board("comparison-oblique-back.png", [
        ("before-fourth-oblique-back.png", "Third candidate", "review baseline"),
        ("desktop-oblique-back.png", "Fourth candidate", "structure and mechanisms preserved"),
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
    board("display-transform-board.png", [
        ("display-normal.png", "Normal", "existing transform origin"),
        ("display-split-100.png", "Front/back split 100%", "FRONT -Y / BACK +Y / CORE centered"),
        ("display-explode-100.png", "Explode 100%", "existing explode directions and multipliers"),
        ("display-restored.png", "Restored", "position / quaternion / scale error <= 1e-7"),
    ])

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
        "6.600 opening / 7.120 outer / 0.260 radial rim",
        "actual balance and hairspring line of sight",
    ])
    closeup("desktop-front.png", "small-second-close.png", (500, 385, 780, 665), "6 o'clock small seconds", [
        "8.500 visual recess / narrow 0.080 bevel / no thick torus",
        "7.740 S86 mark circle / 12 major + 48 minor marks",
        "blue-steel-tone hand #2A5572",
        "S86 center and fourth-arbor coupling unchanged",
    ])
    closeup("desktop-front.png", "indices-close.png", (410, 90, 870, 360), "Polished bar indices", [
        "faceted 1.820 × 0.440 × 0.230 bars",
        "double marker at 12 / standard marker at 6",
        "60 equal-size minute dots on radius 14.200",
        "13 meshes / 6 o'clock forbidden interference count 0",
        "S86 index circle 25.456 unchanged",
    ])
    closeup("desktop-front.png", "hands-close.png", (430, 190, 850, 555), "Faceted polished hands", [
        "minute 12.040 / hour 8.600 / small second 3.268",
        "shared tapered silhouette with raised center ridge",
        "all three remain 1:1 coupled to their physical drivers",
    ])
    closeup("desktop-side.png", "domed-crystal-side.png", (300, 100, 980, 620), "Strengthened dome crystal", [
        "protected Y envelope -3.460 to -2.860",
        "geometry, profile, and depth state preserved",
        "MeshPhysical: opacity .10 / transmission 0 / roughness .025",
        "clearcoat 1.0 / clearcoat roughness .03 / env .35",
        "existing camera, light, shadow, tone mapping unchanged",
    ])
    closeup("crown-position-1.png", "crown-position-1-close.png", (650, 170, 1090, 610), "Crown position 1", [
        "Phase 3B.1 absolute placement and gap preserved",
    ])
    closeup("crown-position-2.png", "crown-position-2-close.png", (650, 170, 1090, 610), "Crown position 2", [
        "time setting and no-drift placement preserved",
    ])

    board("open-heart-before-after.png", [
        ("before-fourth-front.png", "Third candidate", "revision base"),
        ("desktop-front.png", "Fourth candidate", "geometry retained"),
    ])
    comparison_crop_board("comparison-open-heart.png", [
        ("before-fourth-front.png", (690, 210, 930, 450), "Third candidate", "accepted open-heart geometry"),
        ("desktop-front.png", (690, 210, 930, 450), "Fourth candidate", "same 7.120 fine rim"),
    ])
    comparison_crop_board("comparison-indices.png", [
        ("before-fourth-front.png", (410, 90, 870, 360), "Third candidate", "previous minute-track placement"),
        ("desktop-front.png", (410, 90, 870, 360), "Fourth candidate", "radius 14.200 / 60 equal dots"),
    ])
    comparison_crop_board("comparison-hands.png", [
        ("before-fourth-front.png", (430, 190, 850, 555), "Third candidate", "accepted hand geometry"),
        ("desktop-front.png", (430, 190, 850, 555), "Fourth candidate", "hand geometry/material unchanged"),
    ])
    comparison_crop_board("comparison-small-second.png", [
        ("before-fourth-front.png", (500, 385, 780, 665), "Third candidate", "accepted small seconds"),
        ("desktop-front.png", (500, 385, 780, 665), "Fourth candidate", "unchanged 8.500 recess"),
    ])
    comparison_crop_board("comparison-domed-crystal.png", [
        ("before-fourth-side.png", (300, 100, 980, 620), "Third candidate", "transmissive material"),
        ("desktop-side.png", (300, 100, 980, 620), "Fourth candidate", "non-refractive material / same profile"),
    ])
    board("comparison-crown.png", [
        ("crown-position-1-close.png", "Position 1", "protected Phase 3B.1 placement"),
        ("crown-position-2-close.png", "Position 2", "absolute no-drift placement"),
    ])

    annotate_full(
        "desktop-front.png",
        "revision-reference-alignment.png",
        "Phase 3C.1 fourth candidate (not default-adopted)",
        [
            "near-white ivory #F2EDE5 / small seconds #F5F1EA",
            "stable exterior silver #E7EAED / metalness .52 / roughness .20",
            "60 equal-size minute dots at radius 14.200",
            "8.500 small-second recess / 7.120 open-heart rim",
            "non-refractive dome within the protected 8.695 envelope",
        ],
        ellipse=open_heart_box,
    )
    annotate_full(
        "desktop-oblique-front.png",
        "unified-silver-material-audit.png",
        "Runtime stable exterior silver material audit",
        [
            "candidate-local clone on case / bezel / rehaut / lugs / caseback",
            "crown / tube / collar / spring bars / buckle also use #E7EAED",
            "metalness .52 / roughness .20 / env .35 exactly",
            "base Phase 3B.2 material UUIDs are not shared",
            "lighting / environment / exposure / tone mapping unchanged",
        ],
        arrows=[
            ((140, 265), (440, 405), "case / bezel / lug"),
            ((885, 220), (1025, 365), "crown"),
        ],
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
            "curvature and edge highlight retained without refraction",
            "bezel interface and protected clear diameter are unchanged",
        ],
    )

    comparison_crop_board("crystal-edge-comparison.png", [
        ("crystal-hidden-front.png", (250, 35, 1030, 645), "Crystal hidden", "diagnostic-only control"),
        ("desktop-front.png", (250, 35, 1030, 645), "Crystal visible", "edge contrast retained ≥ 90%"),
    ])
    closeup(
        "desktop-front.png",
        "minute-track-close.png",
        (350, 55, 930, 355),
        "Minute track — fourth candidate",
        [
            "radius 14.200 / 60 equal-size dots",
            "normal, 12 o'clock, and open-heart overlap count: 0",
        ],
    )
    annotate_full(
        "desktop-front.png",
        "six-index-front.png",
        "6 o'clock index — actual generated geometry",
        [
            "standard bar 1.820 × 0.440 × 0.230 at radius 12.728",
            "12 o'clock double + eleven standard positions = 13 meshes",
            "actual vertex audit: finite / closed / outward",
            "forbidden interference count: 0",
        ],
        arrows=[((450, 650), (640, 616), "6 o'clock standard bar")],
    )
    closeup(
        "desktop-front.png",
        "six-index-small-second-clearance.png",
        (430, 350, 850, 710),
        "6 o'clock index ↔ small seconds",
        [
            "index inner radius 11.818",
            "recess clearance 1.968 (required ≥ 1.500)",
            "small-second marks clearance 2.479975",
            "small-second hand sweep clearance 2.949939",
        ],
    )
    closeup(
        "desktop-front.png",
        "six-index-minute-clearance.png",
        (430, 350, 850, 710),
        "6 o'clock index ↔ minute dot / opening",
        [
            "major minute dot clearance 0.435226 (required ≥ 0.300)",
            "display opening clearance 1.260226 (required ≥ 0.300)",
            "no local dimension exception at 6 o'clock",
        ],
    )
    annotate_full(
        "exterior-off.png",
        "exterior-off-operational-parts.png",
        "Exterior OFF — operational parts stay visible",
        [
            "25 exterior-managed parts hidden",
            "minute / hour / small-second hands remain",
            "crown and all internal mechanisms remain",
            "OPEN_HEART_PRESENTATION_CUTOUT plate remains",
        ],
        arrows=[
            ((370, 205), (640, 365), "hands"),
            ((950, 410), (1035, 450), "crown"),
        ],
    )
    annotate_full(
        "panel-open-browser.png",
        "exterior-ui-label.png",
        "Learning tab display group",
        [
            'label: "外装"',
            "helper DOM count: 0",
            "tap target height: 44 px",
            "horizontal overflow: 0",
        ],
        arrows=[((80, 300), (276, 365), 'single label "外装"')],
    )
    annotate_full(
        "desktop-front.png",
        "dial-selection-four-points.png",
        "Blank-dial pointer audit — 4 / 4",
        [
            "dial priority 1 / crystal render priority 0",
            "indices + open-heart rim priority 2 / hands priority 3",
            "all four blank points selected the ivory dial",
            "global Raycaster and opacity threshold unchanged",
        ],
        arrows=[
            ((300, 210), (505, 280), "blank A"),
            ((860, 205), (775, 275), "blank B"),
            ((340, 520), (515, 485), "blank C"),
            ((910, 520), (775, 485), "blank D"),
        ],
    )
    annotate_full(
        "crystal-selection-ui.png",
        "crystal-side-selection.png",
        "Crystal side / edge selection",
        [
            "actual dome material remains opacity 0.10 and pickable",
            "local non-rendering outer-edge hit surface only",
            "global Raycaster ranking and threshold unchanged",
            "HUD and learning description synchronized",
        ],
    )
    annotate_full(
        "index-selection-ui.png",
        "index-selection.png",
        "Index selection",
        [
            "priority 2 wins on the bar surface",
            "6 o'clock is included in the registered index assembly",
            "highlight / HUD / learning description synchronized",
        ],
    )
    annotate_full(
        "hand-selection-ui.png",
        "hand-selection.png",
        "Hand selection",
        [
            "minute / hour / small-second priority remains 3",
            "hands remain FRONT-family members",
            "Exterior OFF does not remove operational hands",
        ],
    )
    annotate_full(
        "opacity16-internal-selection-ui.png",
        "opacity16-internal-selection.png",
        "Opacity 16% internal selection",
        [
            "setting wheel 2 remains selectable",
            "dial priority change does not steal internal selection",
            "existing opacity / depthWrite behavior is unchanged",
        ],
    )
    closeup(
        "desktop-oblique-front.png",
        "stable-silver-close.png",
        (220, 30, 1080, 650),
        "Stable exterior silver",
        [
            "#E7EAED / metalness .52 / roughness .20 / env .35",
            "candidate-local clones; no shared base material UUID",
        ],
    )
    board("exterior-group-board.png", [
        ("desktop-front.png", "Exterior ON", "watch-head and attachments visible"),
        ("exterior-off.png", "Exterior OFF", "internal mechanism remains"),
        ("display-split-100.png", "Split + ON", "existing split transform"),
        ("exterior-split-off.png", "Split + OFF", "restore-safe visibility mask"),
        ("display-explode-100.png", "Explode + ON", "existing explode transform"),
        ("exterior-explode-off.png", "Explode + OFF", "transform unchanged"),
        ("opacity-16.png", "Opacity 16% + ON", "interior selection preserved"),
        ("exterior-opacity16-off.png", "Opacity 16% + OFF", "no stale exterior selection"),
    ])

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
        ("before-fourth-front.png", "third candidate"),
        ("desktop-front.png", "fourth candidate"),
        ("open-heart-close.png", "open-heart close"),
    ])
    make_gif("video-04-small-second-review.gif", [
        ("before-fourth-front.png", "third candidate"),
        ("small-second-close.png", "fourth candidate"),
        ("desktop-front.png", "fourth-candidate dial"),
    ])
    make_gif("video-05-hands-review.gif", [
        ("before-fourth-front.png", "third candidate"),
        ("hands-close.png", "fourth candidate stable exterior silver"),
        ("desktop-front.png", "10:10:30 coupling"),
    ])
    make_gif("video-06-crystal-side-review.gif", [
        ("before-fourth-side.png", "third-candidate dome"),
        ("domed-crystal-side.png", "fourth-candidate non-refractive dome"),
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
    make_gif("video-09-split-explode-restore.gif", [
        ("display-normal.png", "normal"),
        ("display-split-100.png", "front/back split 100%"),
        ("display-explode-100.png", "explode 100%"),
        ("display-restored.png", "restored exactly"),
    ], duration=1500)
    make_gif("video-10-exterior-group.gif", [
        ("desktop-front.png", "exterior ON"),
        ("exterior-off.png", "exterior OFF"),
        ("display-split-100.png", "split + exterior ON"),
        ("exterior-split-off.png", "split + exterior OFF"),
        ("display-explode-100.png", "explode + exterior ON"),
        ("exterior-explode-off.png", "explode + exterior OFF"),
        ("opacity-16.png", "opacity 16% + exterior ON"),
        ("exterior-opacity16-off.png", "opacity 16% + exterior OFF"),
        ("desktop-front.png", "restored"),
    ], duration=700)
    make_gif("video-11-exterior-on-off-on.gif", [
        ("desktop-front.png", "exterior ON"),
        ("exterior-off.png", "exterior OFF — hands + crown remain"),
        ("desktop-front.png", "exterior ON restored"),
    ], duration=2000)
    make_gif("video-12-exterior-off-hand-motion.gif", [
        ("exterior-off-hands-t0.png", "10:10:30"),
        ("exterior-off-hands-t1.png", "10:11:30"),
        ("exterior-off-hands-t2.png", "10:12:30"),
    ], duration=2000)
    make_gif("video-13-exterior-off-crown-cycle.gif", [
        ("exterior-off-crown-position1.png", "position 1"),
        ("exterior-off-crown-position2.png", "position 2"),
        ("exterior-off-crown-position1.png", "position 1 restored"),
    ], duration=2000)
    make_gif("video-14-selection-sequence.gif", [
        ("part-selection-ui.png", "dial"),
        ("index-selection-ui.png", "index"),
        ("hand-selection-ui.png", "minute hand"),
    ], duration=2000)
    make_gif("video-15-split-explode-composition.gif", [
        ("desktop-front.png", "normal + exterior ON"),
        ("exterior-off.png", "normal + exterior OFF"),
        ("exterior-split-off.png", "split + exterior OFF"),
        ("exterior-explode-off.png", "explode + exterior OFF"),
        ("desktop-front.png", "restored"),
    ], duration=1200)

    raw_names = [
        "desktop-front.png", "desktop-oblique-front.png", "desktop-side.png",
        "desktop-back.png", "desktop-oblique-back.png", "opacity-50.png",
        "opacity-16.png", "crown-position-2.png", "mobile-390-front.png",
        "mobile-390-oblique-front.png", "mobile-390-side.png",
        "mobile-390-opacity-16.png", "normal-base-phase3b2.png", "normal-branch.png",
        "display-normal.png", "display-split-100.png",
        "display-explode-100.png", "display-restored.png",
        "crystal-hidden-front.png", "exterior-off.png",
        "exterior-internal-selection.png", "exterior-split-off.png",
        "exterior-explode-off.png", "exterior-opacity16-off.png",
        "exterior-off-hands-t0.png", "exterior-off-hands-t1.png",
        "exterior-off-hands-t2.png", "exterior-off-crown-position1.png",
        "exterior-off-crown-position2.png",
    ]
    image_report = {
        "sourceImplementationCommit": SOURCE_IMPLEMENTATION_COMMIT,
        "sourceBaseCommit": SOURCE_BASE_COMMIT,
        "mainCommit": "293626f13a50224924f8e3ac229a1fc4077ad7a7",
        "sourceBranch": "feature/final-exterior-balanced-phase3c1-watch-head",
        "appVersion": "v3.15.0",
        "captureMode": "same-origin browser harness and actual Three.js WebGLRenderTarget PNG capture",
        "rawCaptureCreationByThisScript": False,
        "images": [image_metric(EVIDENCE / name, "actual runtime capture") for name in raw_names],
        "browserScreenshots": [
            image_metric(EVIDENCE / name, "actual in-app Browser screenshot")
            for name in [
                "panel-open-browser.png",
                "panel-collapsed-browser.png",
                "part-selection-ui.png",
                "index-selection-ui.png",
                "hand-selection-ui.png",
                "crystal-selection-ui.png",
                "opacity16-internal-selection-ui.png",
            ]
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

    desktop_runtime = json.loads((REPORTS / "desktop-runtime.json").read_text())
    mobile_runtime = json.loads((REPORTS / "mobile-390-runtime.json").read_text())
    capture_states = {
        "desktop-front.png": {"viewport": "desktop", "camera": "front", "opacity": 1},
        "desktop-oblique-front.png": {"viewport": "desktop", "camera": "dialMechanism", "opacity": 1},
        "desktop-side.png": {"viewport": "desktop", "camera": "side", "opacity": 1},
        "desktop-back.png": {"viewport": "desktop", "camera": "back", "opacity": 1},
        "desktop-oblique-back.png": {"viewport": "desktop", "camera": "winding", "opacity": 1},
        "opacity-50.png": {"viewport": "desktop", "camera": "front", "opacity": 0.5},
        "opacity-16.png": {"viewport": "desktop", "camera": "front", "opacity": 0.16},
        "crown-position-2.png": {"viewport": "desktop", "camera": "winding", "crown": "set"},
        "mobile-390-front.png": {"viewport": "mobile390", "camera": "front", "opacity": 1},
        "mobile-390-oblique-front.png": {"viewport": "mobile390", "camera": "dialMechanism", "opacity": 1},
        "mobile-390-side.png": {"viewport": "mobile390", "camera": "side", "opacity": 1},
        "mobile-390-opacity-16.png": {"viewport": "mobile390", "camera": "front", "opacity": 0.16},
        "display-normal.png": {"viewport": "desktop", "camera": "side", "display": "normal"},
        "display-split-100.png": {"viewport": "desktop", "camera": "side", "display": "split"},
        "display-explode-100.png": {"viewport": "desktop", "camera": "side", "display": "explode"},
        "display-restored.png": {"viewport": "desktop", "camera": "side", "display": "restored"},
        "normal-base-phase3b2.png": {"viewport": "desktop", "camera": "front", "mode": "phase3b2-base"},
        "normal-branch.png": {"viewport": "desktop", "camera": "front", "mode": "normal-path"},
        "crystal-hidden-front.png": {"viewport": "desktop", "camera": "front", "crystal": "diagnostic-hidden"},
        "exterior-off.png": {"viewport": "desktop", "camera": "front", "exteriorGroup": "off"},
        "exterior-internal-selection.png": {"viewport": "desktop", "camera": "dialMechanism", "opacity": 0.16, "exteriorGroup": "off", "selection": "設定車2"},
        "exterior-split-off.png": {"viewport": "desktop", "camera": "side", "display": "split", "exteriorGroup": "off"},
        "exterior-explode-off.png": {"viewport": "desktop", "camera": "side", "display": "explode", "exteriorGroup": "off"},
        "exterior-opacity16-off.png": {"viewport": "desktop", "camera": "front", "opacity": 0.16, "exteriorGroup": "off"},
        "exterior-off-hands-t0.png": {"viewport": "desktop", "camera": "front", "time": "10:10:30", "exteriorGroup": "off"},
        "exterior-off-hands-t1.png": {"viewport": "desktop", "camera": "front", "time": "10:11:30", "exteriorGroup": "off"},
        "exterior-off-hands-t2.png": {"viewport": "desktop", "camera": "front", "time": "10:12:30", "exteriorGroup": "off"},
        "exterior-off-crown-position1.png": {"viewport": "desktop", "camera": "winding", "crown": "wind", "exteriorGroup": "off"},
        "exterior-off-crown-position2.png": {"viewport": "desktop", "camera": "winding", "crown": "set", "exteriorGroup": "off"},
    }
    capture_metadata = {
        "sourceImplementationCommit": SOURCE_IMPLEMENTATION_COMMIT,
        "sourceBaseCommit": SOURCE_BASE_COMMIT,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "captureMode": "same-origin browser harness and actual Three.js WebGLRenderTarget PNG capture",
        "harness": "tests/final-watch-head-phase3c1-fourth-capture.html",
        "query": "exterior=balanced&watchHead=phase3c1&dimensionAudit=1",
        "environments": {
            "desktop": desktop_runtime["environment"],
            "mobile390": mobile_runtime["environment"],
        },
        "captures": [
            {
                **next(
                    item for item in image_report["images"]
                    if item["file"] == name
                ),
                "state": state,
            }
            for name, state in capture_states.items()
        ],
    }
    (REPORTS / "capture-metadata.json").write_text(
        json.dumps(capture_metadata, ensure_ascii=False, indent=2) + "\n"
    )
    (REPORTS / "browser-capture-metadata.json").write_text(
        json.dumps(capture_metadata, ensure_ascii=False, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
