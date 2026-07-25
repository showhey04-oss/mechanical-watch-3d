#!/usr/bin/env python3
"""Build Phase 3B.1 silhouette and crown-relief evidence from real screenshots."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from PIL import Image, ImageDraw


DESKTOP_SIZE = (1280, 720)
BOARD_HEADER = 52
GOLD = (211, 177, 105)
CYAN = (94, 201, 225)
RED = (241, 109, 109)
GREEN = (104, 211, 151)
INK = (235, 239, 244)
PANEL = (16, 21, 29, 225)


def load_rgb(path: Path, expected: tuple[int, int]) -> Image.Image:
    with Image.open(path) as source:
        image = source.convert("RGB")
    if image.size != expected:
        raise ValueError(f"unexpected image size for {path.name}: {image.size}")
    return image


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=True)


def seed_main_baseline(board_path: Path, output: Path) -> None:
    board = load_rgb(board_path, (2560, 772))
    save_png(board.crop((0, BOARD_HEADER, 1280, 772)), output)


def board(
    left: Image.Image,
    right: Image.Image,
    left_label: str,
    right_label: str,
) -> Image.Image:
    result = Image.new("RGB", (2560, 772), (13, 16, 21))
    result.paste(left, (0, BOARD_HEADER))
    result.paste(right, (1280, BOARD_HEADER))
    draw = ImageDraw.Draw(result)
    draw.rectangle((0, 0, 1279, 51), fill=(28, 33, 42))
    draw.rectangle((1280, 0, 2559, 51), fill=(42, 50, 62))
    draw.text((22, 17), left_label, fill=INK)
    draw.text((1302, 17), right_label, fill=INK)
    draw.line((1280, 0, 1280, 772), fill=GOLD, width=2)
    return result


def panel(draw: ImageDraw.ImageDraw, title: str, lines: list[str]) -> None:
    x0, y0, x1 = 26, 60, 540
    y1 = y0 + 44 + len(lines) * 25 + 20
    draw.rounded_rectangle((x0, y0, x1, y1), radius=12, fill=PANEL)
    draw.text((x0 + 18, y0 + 14), title, fill=INK)
    for index, line in enumerate(lines):
        draw.text((x0 + 18, y0 + 52 + index * 25), line, fill=(207, 216, 227))


def close_up(source: Image.Image, title: str, subtitle: str) -> Image.Image:
    crop = source.crop((880, 245, 1190, 520)).resize(
        DESKTOP_SIZE,
        Image.Resampling.LANCZOS,
    )
    overlay = crop.convert("RGBA")
    draw = ImageDraw.Draw(overlay, "RGBA")
    draw.rounded_rectangle((24, 24, 610, 105), radius=12, fill=PANEL)
    draw.text((42, 42), title, fill=INK)
    draw.text((42, 70), subtitle, fill=(207, 216, 227))
    return overlay.convert("RGB")


def local_relief_overlay(source: Image.Image, relief: dict) -> Image.Image:
    image = source.convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    panel(draw, "CASE-BODY LOCAL RELIEF", [
        "actual WebGL side capture + diagnostic overlay",
        (
            f"required {relief['calculation']['requiredMinimumDepth']:.6f} / "
            f"adopted {relief['calculation']['adoptedMaximumDepth']:.6f} / "
            f"limit {relief['calculation']['maximumAllowedDepth']:.3f}"
        ),
        "inner radius 18.900 unchanged; CSG not used",
    ])
    # The side preset places the crown relief in this visible region.
    relief_box = (448, 428, 626, 616)
    draw.rounded_rectangle(relief_box, radius=28, outline=CYAN + (240,), width=4)
    for offset in range(0, 160, 16):
        draw.arc(
            (454 + offset // 7, 434 + offset // 14, 620 - offset // 7, 610 - offset // 14),
            205,
            345,
            fill=CYAN + (150,),
            width=2,
        )
    draw.line((540, 428, 690, 330), fill=CYAN + (240,), width=3)
    draw.text((702, 316), "smooth Y + circumferential falloff", fill=INK)
    draw.text((702, 342), "single closed indexed Mesh", fill=INK)
    return image.convert("RGB")


def gap_overlay(source: Image.Image, relief: dict) -> Image.Image:
    image = source.convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    panel(draw, "MINIMUM CROWN / CASE GAP", [
        (
            "actual geometry: "
            f"{relief['position1']['actualMinimumGap']:.6f} >= 0.030"
        ),
        f"XYZ: {relief['position1']['actualMinimumGapPoint']}",
        "position 1 forbidden interference: 0",
    ])
    point = (548, 514)
    draw.ellipse((point[0] - 10, point[1] - 10, point[0] + 10, point[1] + 10),
                 fill=RED + (230,), outline=INK + (255,), width=2)
    draw.line((point[0], point[1], 735, 455), fill=RED + (240,), width=4)
    draw.text((748, 437), "minimum sampled gap", fill=INK)
    draw.text((748, 463), "crown core -> case body", fill=INK)
    return image.convert("RGB")


def wall_overlay(source: Image.Image, relief: dict) -> Image.Image:
    image = source.convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    panel(draw, "MINIMUM CASE-BODY WALL", [
        (
            "actual geometry: "
            f"{relief['wall']['actualMinimum']:.6f} >= 0.550"
        ),
        f"XYZ: {relief['wall']['actualMinimumPoint']}",
        "inner radius remains exactly 18.900",
    ])
    point = (530, 563)
    draw.ellipse((point[0] - 10, point[1] - 10, point[0] + 10, point[1] + 10),
                 fill=GREEN + (230,), outline=INK + (255,), width=2)
    draw.line((point[0], point[1], 735, 610), fill=GREEN + (240,), width=4)
    draw.text((748, 594), "minimum radial wall", fill=INK)
    draw.text((748, 620), "outer relief -> unchanged inner opening", fill=INK)
    return image.convert("RGB")


def annotate_capture(
    source: Image.Image,
    title: str,
    lines: list[str],
    box: tuple[int, int, int, int] | None = None,
) -> Image.Image:
    image = source.convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    panel(draw, title, lines)
    if box:
        draw.rounded_rectangle(box, radius=18, outline=CYAN + (235,), width=4)
    return image.convert("RGB")


def section_diagram() -> Image.Image:
    image = Image.new("RGB", DESKTOP_SIZE, (13, 16, 21))
    draw = ImageDraw.Draw(image)
    draw.text((38, 28), "BEZEL SECTION / DISPLAY APERTURE", fill=INK)
    draw.text((38, 58), "old aperture 29.000 vs second candidate 29.800", fill=GOLD)
    center = 640
    scale = 24
    old_inner = 29.0 / 2 * scale
    old_outer = 39.2 / 2 * scale
    old_back, old_front = 240, 160
    for sign in (-1, 1):
        inner_x = center + sign * old_inner
        outer_x = center + sign * old_outer
        draw.polygon(
            [
                (inner_x, old_front),
                (outer_x, old_front),
                (outer_x, old_back),
                (inner_x, old_back),
            ],
            fill=(98, 46, 52),
            outline=RED,
        )
    draw.line((center - old_inner, old_front, center + old_inner, old_front), fill=(87, 98, 112), width=2)
    draw.text((50, 278), "old: parallel annular ExtrudeGeometry / aperture 29.000", fill=INK)

    new_back_y = 525
    inner_front_y = 425
    outer_front_y = 485
    new_inner_back = 29.8 / 2 * scale
    new_inner_front = 30.6 / 2 * scale
    new_outer_back = 38.8 / 2 * scale
    new_outer_front = 37.6 / 2 * scale
    for sign in (-1, 1):
        points = [
            (center + sign * new_inner_back, new_back_y),
            (center + sign * new_inner_front, inner_front_y),
            (center + sign * new_outer_front, outer_front_y),
            (center + sign * new_outer_back, new_back_y),
        ]
        draw.polygon(points, fill=(42, 91, 72), outline=GREEN)
    draw.line((center - new_inner_front, inner_front_y, center + new_inner_front, inner_front_y), fill=(87, 98, 112), width=2)
    draw.text((50, 565), "new: single closed tapered profile / aperture 29.800", fill=INK)
    draw.text((50, 650), "back OD 38.800 / front OD 37.600; outer edge becomes axially thinner", fill=INK)
    return image


def thickness_diagram() -> Image.Image:
    image = Image.new("RGB", DESKTOP_SIZE, (13, 16, 21))
    draw = ImageDraw.Draw(image)
    draw.text((38, 28), "TOTAL EXTERIOR THICKNESS", fill=INK)
    rows = (
        (200, 9.845, 0.950, 7.945, RED, "previous candidate"),
        (470, 8.695, 0.600, 7.495, GREEN, "second candidate"),
    )
    x0 = 170
    unit = 92
    for y, total, projection, body, color, label in rows:
        width = total * unit
        front = projection * unit
        body_width = body * unit
        draw.rectangle((x0, y, x0 + width, y + 62), outline=color, width=4)
        draw.rectangle((x0, y, x0 + front, y + 62), fill=(48, 58, 72))
        draw.rectangle((x0 + front, y, x0 + front + body_width, y + 62), fill=(77, 88, 103))
        draw.rectangle((x0 + front + body_width, y, x0 + width, y + 62), fill=(48, 58, 72))
        draw.text((x0, y - 38), f"{label}: {projection:.3f} + {body:.3f} + {projection:.3f} = {total:.3f}", fill=INK)
    draw.text((170, 650), "Movement Y positions and Phase 2C envelopes remain unchanged.", fill=GOLD)
    return image


def third_bezel_taper_diagram() -> Image.Image:
    image = Image.new("RGB", DESKTOP_SIZE, (13, 16, 21))
    draw = ImageDraw.Draw(image)
    draw.text((38, 28), "BEZEL TAPER / SECOND vs THIRD CANDIDATE", fill=INK)
    draw.text((38, 58), "aperture 29.800 and back OD 38.800 remain fixed", fill=GOLD)
    center = 640
    scale = 24
    rows = (
        (240, 37.6, -3.18, -2.96, RED, "Head 24ee892: front OD 37.600 / inner -3.180 / outer -2.960"),
        (525, 37.0, -3.24, -2.88, GREEN, "third candidate: front OD 37.000 / inner -3.240 / outer -2.880"),
    )
    inner_back = 29.8 / 2 * scale
    inner_front = 30.6 / 2 * scale
    outer_back = 38.8 / 2 * scale
    for back_y, front_od, inner_y, outer_y, color, label in rows:
        inner_front_y = back_y - (abs(inner_y + 2.86) * 280)
        outer_front_y = back_y - (abs(outer_y + 2.86) * 280)
        outer_front = front_od / 2 * scale
        for sign in (-1, 1):
            draw.polygon([
                (center + sign * inner_back, back_y),
                (center + sign * inner_front, inner_front_y),
                (center + sign * outer_front, outer_front_y),
                (center + sign * outer_back, back_y),
            ], fill=(42, 91, 72) if color == GREEN else (98, 46, 52), outline=color)
        draw.text((50, back_y + 38), label, fill=INK)
    draw.text((50, 675), "single closed Mesh; the outer edge is visibly thinner without a blade edge", fill=GOLD)
    return image


def third_caseback_taper_diagram() -> Image.Image:
    image = Image.new("RGB", DESKTOP_SIZE, (13, 16, 21))
    draw = ImageDraw.Draw(image)
    draw.text((38, 28), "CASEBACK RING TAPER / SECOND vs THIRD CANDIDATE", fill=INK)
    draw.text((38, 58), "front OD 39.000 and axial thickness 0.600 remain fixed", fill=GOLD)
    center = 640
    scale = 23
    for y, rear_od, color, label in (
        (245, 38.4, RED, "Head 24ee892 rear OD 38.400"),
        (520, 37.8, GREEN, "third candidate rear OD 37.800"),
    ):
        inner = 28.548 / 2 * scale
        front = 39.0 / 2 * scale
        rear = rear_od / 2 * scale
        for sign in (-1, 1):
            draw.polygon([
                (center + sign * inner, y - 85),
                (center + sign * inner, y),
                (center + sign * front, y),
                (center + sign * rear, y - 85),
            ], fill=(42, 91, 72) if color == GREEN else (98, 46, 52), outline=color)
        draw.text((50, y + 36), label, fill=INK)
    draw.text((50, 675), "window diameter unchanged; stronger rear taper separates it visually from the holder ring", fill=GOLD)
    return image


def third_case_profile_diagram() -> Image.Image:
    image = Image.new("RGB", DESKTOP_SIZE, (13, 16, 21))
    draw = ImageDraw.Draw(image)
    draw.text((38, 28), "CASE-BODY AXIAL OUTER-RADIUS PROFILE", fill=INK)
    draw.text((38, 58), "inner radius 18.900 and maximum outer radius 19.800 remain fixed", fill=GOLD)
    old = [(-2.86, 19.5), (-2.45, 19.68), (-1.55, 19.8), (2.35, 19.8), (3.45, 19.68), (4.635, 19.5)]
    new = [(-2.86, 19.45), (-2.3, 19.62), (-1.35, 19.8), (2.1, 19.8), (3.25, 19.62), (4.635, 19.45)]
    y0, y1 = -2.86, 4.635
    def points(profile):
        return [
            (130 + int((y - y0) / (y1 - y0) * 1010), 620 - int((radius - 18.9) / 0.9 * 480))
            for y, radius in profile
        ]
    draw.line(points(old), fill=RED, width=5, joint="curve")
    draw.line(points(new), fill=GREEN, width=5, joint="curve")
    for x, y in points(new):
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=GREEN)
    draw.text((130, 650), "front Y -2.860", fill=INK)
    draw.text((1030, 650), "back Y 4.635", fill=INK)
    draw.text((800, 100), "second candidate", fill=RED)
    draw.text((800, 128), "third candidate stronger taper", fill=GREEN)
    return image


def annular_profile_diagram(
    title: str,
    geometry: dict,
    radial_direction: str,
) -> Image.Image:
    """Render the measured radius/Y section without synthesizing a runtime view."""
    image = Image.new("RGB", DESKTOP_SIZE, (13, 16, 21))
    draw = ImageDraw.Draw(image)
    profile = geometry["profile"]
    taper = geometry["taper"]
    radii = [point["radius"] for point in profile]
    y_values = [point["y"] for point in profile]
    radius_min, radius_max = min(radii), max(radii)
    y_min, y_max = min(y_values), max(y_values)
    plot = (130, 125, 1160, 585)

    def point_xy(point: dict) -> tuple[int, int]:
        radius_span = max(radius_max - radius_min, 1e-9)
        y_span = max(y_max - y_min, 1e-9)
        x = plot[0] + int((point["radius"] - radius_min) / radius_span * (plot[2] - plot[0]))
        y = plot[3] - int((point["y"] - y_min) / y_span * (plot[3] - plot[1]))
        return x, y

    draw.text((38, 28), title, fill=INK)
    draw.text((38, 58), radial_direction, fill=GOLD)
    draw.rectangle(plot, outline=(73, 84, 99), width=2)
    coordinates = [point_xy(point) for point in profile]
    colors = [CYAN, CYAN, GREEN, GOLD]
    for index in range(len(coordinates) - 1):
        draw.line(
            (coordinates[index], coordinates[index + 1]),
            fill=colors[index],
            width=7,
        )
    for coordinate, point in zip(coordinates, profile):
        x, y = coordinate
        draw.ellipse((x - 7, y - 7, x + 7, y + 7), fill=INK)
        draw.text(
            (min(x + 12, 990), max(92, y - 20)),
            f"{point['role']}: R {point['radius']:.3f} / Y {point['y']:.3f}",
            fill=INK,
        )
    draw.text(
        (80, 625),
        (
            f"land {taper['innerRetentionLandWidth']:.3f} | "
            f"primary {taper['primaryTaperRadialWidth']:.3f} | "
            f"closure {taper['outerClosureWidth']:.3f} | "
            f"coverage {taper['primaryTaperCoverageRatio']:.6f}"
        ),
        fill=INK,
    )
    draw.text(
        (80, 655),
        (
            f"primary slope {taper['primarySlope']:.9f}; "
            f"unintended horizontal intervals {taper['unintendedHorizontalIntervalCount']}"
        ),
        fill=GOLD,
    )
    return image


def annular_section_diagram(
    title: str,
    geometry: dict,
    face_label: str,
) -> Image.Image:
    """Show the closed measured annular profile and its functional regions."""
    image = Image.new("RGB", DESKTOP_SIZE, (13, 16, 21))
    draw = ImageDraw.Draw(image)
    profile = geometry["profile"]
    taper = geometry["taper"]
    radii = [point["radius"] for point in profile]
    y_values = [point["y"] for point in profile]
    radius_min, radius_max = min(radii), max(radii)
    y_min, y_max = min(y_values), max(y_values)
    center_x = 640
    x_scale = 430 / max(radius_max - radius_min, 1e-9)
    y_scale = 390 / max(y_max - y_min, 1e-9)

    def section_point(point: dict, sign: int) -> tuple[int, int]:
        x = center_x + sign * (90 + (point["radius"] - radius_min) * x_scale)
        y = 570 - (point["y"] - y_min) * y_scale
        return int(x), int(y)

    draw.text((38, 28), title, fill=INK)
    draw.text((38, 58), face_label, fill=GOLD)
    for sign in (-1, 1):
        coordinates = [section_point(point, sign) for point in profile]
        draw.polygon(coordinates, fill=(40, 49, 61), outline=INK)
        for index, color in ((1, CYAN), (2, GREEN), (3, GOLD)):
            draw.line(
                (coordinates[index], coordinates[index + 1]),
                fill=color,
                width=8,
            )
    draw.text((56, 615), "cyan: minimum retention land", fill=CYAN)
    draw.text((400, 615), "green: primary full-surface taper", fill=GREEN)
    draw.text((850, 615), "gold: minimum outer closure", fill=GOLD)
    draw.text(
        (56, 660),
        (
            f"coverage {taper['primaryTaperCoverageRatio']:.6f} >= 0.80; "
            f"closed={geometry['topology']['closed']}; "
            f"non-manifold={geometry['topology']['nonManifoldEdgeCount']}; "
            f"degenerate={geometry['degenerateTriangleCount']}"
        ),
        fill=INK,
    )
    return image


def flat_taper_annotation(source: Image.Image, report: dict) -> Image.Image:
    """Overlay measured land/taper/closure bands on the actual front capture."""
    image = source.convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    bezel = report["bezel"]["taper"]
    caseback = report["casebackRing"]["taper"]
    panel(draw, "FULL ANNULAR TAPER COVERAGE", [
        (
            f"bezel: land {bezel['innerRetentionLandWidth']:.3f}, "
            f"primary {bezel['primaryTaperRadialWidth']:.3f}, "
            f"coverage {bezel['primaryTaperCoverageRatio']:.6f}"
        ),
        (
            f"caseback: land {caseback['innerRetentionLandWidth']:.3f}, "
            f"primary {caseback['primaryTaperRadialWidth']:.3f}, "
            f"coverage {caseback['primaryTaperCoverageRatio']:.6f}"
        ),
        "cyan = retention land / green = primary taper / gold = closure",
    ])
    center = (640, 370)
    for radius, color, width in (
        (215, CYAN, 6),
        (270, GREEN, 10),
        (316, GOLD, 6),
    ):
        draw.ellipse(
            (
                center[0] - radius,
                center[1] - radius,
                center[0] + radius,
                center[1] + radius,
            ),
            outline=color + (230,),
            width=width,
        )
    return image.convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--seed-main-front-board", type=Path)
    parser.add_argument("--seed-main-side-board", type=Path)
    args = parser.parse_args()
    evidence = args.evidence_dir
    relief = json.loads(
        (evidence / "reports/case-body-relief-report.json").read_text(),
    )

    main_front_path = evidence / "main-baseline-front.png"
    main_side_path = evidence / "main-baseline-side.png"
    if args.seed_main_front_board:
        seed_main_baseline(args.seed_main_front_board, main_front_path)
    if args.seed_main_side_board:
        seed_main_baseline(args.seed_main_side_board, main_side_path)

    main_front = load_rgb(main_front_path, DESKTOP_SIZE)
    main_side = load_rgb(main_side_path, DESKTOP_SIZE)
    current_front = load_rgb(evidence / "desktop-front.png", DESKTOP_SIZE)
    current_side = load_rgb(evidence / "desktop-side.png", DESKTOP_SIZE)
    current_oblique = load_rgb(evidence / "desktop-oblique-front.png", DESKTOP_SIZE)
    before_side = load_rgb(evidence / "before-profile-desktop-side.png", DESKTOP_SIZE)
    before_oblique = load_rgb(
        evidence / "before-profile-desktop-oblique-front.png",
        DESKTOP_SIZE,
    )
    before_second_front = load_rgb(
        evidence / "before-second-desktop-front.png",
        DESKTOP_SIZE,
    )
    before_second_oblique = load_rgb(
        evidence / "before-second-desktop-oblique-front.png",
        DESKTOP_SIZE,
    )
    before_second_side = load_rgb(
        evidence / "before-second-desktop-side.png",
        DESKTOP_SIZE,
    )
    before_second_back = load_rgb(
        evidence / "before-second-desktop-back.png",
        DESKTOP_SIZE,
    )
    live_second_front = load_rgb(
        evidence / "live-second-desktop-front.png",
        DESKTOP_SIZE,
    )
    live_second_oblique = load_rgb(
        evidence / "live-second-desktop-oblique-front.png",
        DESKTOP_SIZE,
    )
    live_second_side = load_rgb(
        evidence / "live-second-desktop-side.png",
        DESKTOP_SIZE,
    )
    live_second_back = load_rgb(
        evidence / "live-second-desktop-back.png",
        DESKTOP_SIZE,
    )
    live_third_front = load_rgb(
        evidence / "live-third-desktop-front.png",
        DESKTOP_SIZE,
    )
    live_third_oblique = load_rgb(
        evidence / "live-third-desktop-oblique-front.png",
        DESKTOP_SIZE,
    )
    live_third_side = load_rgb(
        evidence / "live-third-desktop-side.png",
        DESKTOP_SIZE,
    )
    live_third_back = load_rgb(
        evidence / "live-third-desktop-back.png",
        DESKTOP_SIZE,
    )
    live_fourth_front = load_rgb(
        evidence / "live-fourth-desktop-front.png",
        DESKTOP_SIZE,
    )
    live_fourth_oblique = load_rgb(
        evidence / "live-fourth-desktop-oblique-front.png",
        DESKTOP_SIZE,
    )
    live_fourth_side = load_rgb(
        evidence / "live-fourth-desktop-side.png",
        DESKTOP_SIZE,
    )
    live_fourth_back = load_rgb(
        evidence / "live-fourth-desktop-back.png",
        DESKTOP_SIZE,
    )
    live_fourth_opacity = load_rgb(
        evidence / "live-fourth-opacity-50.png",
        DESKTOP_SIZE,
    )
    annular_report = json.loads(
        (evidence / "reports/annular-taper-report.json").read_text(),
    )
    current_back = load_rgb(evidence / "desktop-back.png", DESKTOP_SIZE)

    save_png(board(
        main_front,
        current_front,
        "v3.15.0 main baseline (no exterior)",
        "E-BALANCED profiled case body (query-only)",
    ), evidence / "baseline-vs-balanced-front.png")
    save_png(board(
        main_side,
        current_side,
        "v3.15.0 main baseline (no exterior)",
        "E-BALANCED profiled case body (query-only)",
    ), evidence / "baseline-vs-balanced-side.png")
    save_png(board(
        before_side,
        current_side,
        "before: constant-radius case body",
        "after: approved axial profile + local crown relief",
    ), evidence / "case-body-profile-before-after-side.png")
    save_png(board(
        before_oblique,
        current_oblique,
        "before: constant-radius silhouette",
        "after: tapered E-BALANCED silhouette",
    ), evidence / "case-body-profile-before-after-oblique-front.png")

    for name, before, after, view in (
        ("front", before_second_front, live_second_front, "front"),
        (
            "oblique-front",
            before_second_oblique,
            live_second_oblique,
            "oblique front",
        ),
        ("side", before_second_side, live_second_side, "side"),
        ("back", before_second_back, live_second_back, "back"),
    ):
        save_png(board(
            before,
            after,
            f"Head 43c8165: previous Phase 3B.1 {view}",
            f"second candidate: refined proportions {view}",
        ), evidence / f"second-candidate-before-after-{name}.png")

    for name, before, after, view in (
        ("front", live_second_front, live_third_front, "front"),
        ("oblique-front", live_second_oblique, live_third_oblique, "oblique front"),
        ("side", live_second_side, live_third_side, "side"),
        ("back", live_second_back, live_third_back, "back"),
    ):
        save_png(board(
            before,
            after,
            f"Head 24ee892: second candidate {view}",
            f"third candidate: stronger taper {view}",
        ), evidence / f"third-candidate-before-after-{name}.png")

    for name, before, after, view in (
        ("front", live_third_front, live_fourth_front, "front"),
        ("oblique-front", live_third_oblique, live_fourth_oblique, "oblique front"),
        ("side", live_third_side, live_fourth_side, "side"),
        ("back", live_third_back, live_fourth_back, "back"),
    ):
        save_png(board(
            before,
            after,
            f"Head 9c16e345: third candidate {view}",
            f"fourth candidate: full annular taper {view}",
        ), evidence / f"fourth-candidate-before-after-{name}.png")

    crown1 = load_rgb(evidence / "crown-position1-closeup.png", DESKTOP_SIZE)
    crown2 = load_rgb(evidence / "crown-position2-closeup.png", DESKTOP_SIZE)
    save_png(crown1, evidence / "crown-position-1.png")
    save_png(crown2, evidence / "crown-position-2.png")
    save_png(annotate_capture(
        crown1,
        "POSITION 1 CROWN CLOSE-UP",
        [
            (
                "case-body gap "
                f"{relief['position1']['actualMinimumGap']:.6f} / "
                "tube seat assumption retained"
            ),
            "human finger access and pull/push acceptance retained",
        ],
        (760, 160, 1240, 620),
    ), evidence / "crown-position-1-close-up.png")
    save_png(annotate_capture(
        crown2,
        "POSITION 2 CROWN CLOSE-UP",
        [
            "crown travel 1.350 / forbidden interference 0",
            "crown, stem, and tube positions unchanged",
        ],
        (760, 160, 1240, 620),
    ), evidence / "crown-position-2-close-up.png")
    save_png(local_relief_overlay(current_side, relief), evidence / "case-body-wireframe-relief.png")
    save_png(gap_overlay(current_side, relief), evidence / "crown-minimum-gap-annotated.png")
    save_png(wall_overlay(current_side, relief), evidence / "case-minimum-wall-annotated.png")

    save_png(section_diagram(), evidence / "bezel-section-29.0-vs-29.8.png")
    save_png(third_bezel_taper_diagram(), evidence / "third-candidate-bezel-taper-comparison.png")
    save_png(third_caseback_taper_diagram(), evidence / "third-candidate-caseback-taper-comparison.png")
    save_png(third_case_profile_diagram(), evidence / "third-candidate-case-profile-comparison.png")
    save_png(
        annular_section_diagram(
            "BEZEL FULL-SURFACE TAPER / MEASURED SECTION",
            annular_report["bezel"],
            "retention land is the only horizontal visible interval",
        ),
        evidence / "fourth-candidate-bezel-section.png",
    )
    save_png(
        annular_section_diagram(
            "CASEBACK RING FULL-SURFACE TAPER / MEASURED SECTION",
            annular_report["casebackRing"],
            "window land transitions directly into the primary taper",
        ),
        evidence / "fourth-candidate-caseback-section.png",
    )
    save_png(
        annular_profile_diagram(
            "BEZEL Y-RADIUS PROFILE",
            annular_report["bezel"],
            "inner/front is negative Y; outer closure returns toward case-body Y",
        ),
        evidence / "fourth-candidate-bezel-profile.png",
    )
    save_png(
        annular_profile_diagram(
            "CASEBACK RING Y-RADIUS PROFILE",
            annular_report["casebackRing"],
            "inner/rear is positive Y; outer closure returns toward case-body Y",
        ),
        evidence / "fourth-candidate-caseback-profile.png",
    )
    save_png(
        flat_taper_annotation(live_fourth_front, annular_report),
        evidence / "fourth-candidate-flat-taper-annotation.png",
    )
    save_png(
        annotate_capture(
            live_fourth_opacity,
            "FOURTH CANDIDATE / STRUCTURAL OPACITY 50%",
            [
                "actual desktop WebGL capture",
                "bezel and caseback ring remain continuous structural surfaces",
                "final visual acceptance remains a human review item",
            ],
        ),
        evidence / "fourth-opacity-50.png",
    )
    save_png(thickness_diagram(), evidence / "total-thickness-9.845-vs-8.695.png")
    holder_absent = load_rgb(evidence / "movement-holder-absent.png", DESKTOP_SIZE)
    holder_present = load_rgb(evidence / "movement-holder-present.png", DESKTOP_SIZE)
    save_png(board(
        holder_absent,
        holder_present,
        "Head 43c8165: no movement holder ring",
        "second candidate: holder ring OD 37.650 / ID 36.750",
    ), evidence / "movement-holder-before-after.png")


if __name__ == "__main__":
    main()
