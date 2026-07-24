#!/usr/bin/env python3
"""Build Phase 3B.1 silhouette and crown-relief evidence from real screenshots."""

from __future__ import annotations

import argparse
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


def local_relief_overlay(source: Image.Image) -> Image.Image:
    image = source.convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    panel(draw, "CASE-BODY LOCAL RELIEF", [
        "actual WebGL side capture + diagnostic overlay",
        "required 0.298836 / adopted 0.309461 / limit 0.330",
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


def gap_overlay(source: Image.Image) -> Image.Image:
    image = source.convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    panel(draw, "MINIMUM CROWN / CASE GAP", [
        "actual geometry: 0.030084 >= 0.030",
        "XYZ: [19.194916, -0.127315, -3.983456]",
        "position 1 forbidden interference: 0",
    ])
    point = (548, 514)
    draw.ellipse((point[0] - 10, point[1] - 10, point[0] + 10, point[1] + 10),
                 fill=RED + (230,), outline=INK + (255,), width=2)
    draw.line((point[0], point[1], 735, 455), fill=RED + (240,), width=4)
    draw.text((748, 437), "minimum sampled gap", fill=INK)
    draw.text((748, 463), "crown core -> case body", fill=INK)
    return image.convert("RGB")


def wall_overlay(source: Image.Image) -> Image.Image:
    image = source.convert("RGBA")
    draw = ImageDraw.Draw(image, "RGBA")
    panel(draw, "MINIMUM CASE-BODY WALL", [
        "actual geometry: 0.590539 >= 0.550",
        "XYZ: [19.184206, -1.050000, -3.442000]",
        "inner radius remains exactly 18.900",
    ])
    point = (530, 563)
    draw.ellipse((point[0] - 10, point[1] - 10, point[0] + 10, point[1] + 10),
                 fill=GREEN + (230,), outline=INK + (255,), width=2)
    draw.line((point[0], point[1], 735, 610), fill=GREEN + (240,), width=4)
    draw.text((748, 594), "minimum radial wall", fill=INK)
    draw.text((748, 620), "outer relief -> unchanged inner opening", fill=INK)
    return image.convert("RGB")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--evidence-dir", type=Path, required=True)
    parser.add_argument("--seed-main-front-board", type=Path)
    parser.add_argument("--seed-main-side-board", type=Path)
    args = parser.parse_args()
    evidence = args.evidence_dir

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

    crown1 = load_rgb(evidence / "crown-position-1.png", DESKTOP_SIZE)
    crown2 = load_rgb(evidence / "crown-position-2.png", DESKTOP_SIZE)
    save_png(close_up(
        crown1,
        "POSITION 1 CROWN CLOSE-UP",
        "case-body gap 0.030084 / tube seat assumption retained",
    ), evidence / "crown-position-1-close-up.png")
    save_png(close_up(
        crown2,
        "POSITION 2 CROWN CLOSE-UP",
        "crown travel 1.350 / forbidden interference 0",
    ), evidence / "crown-position-2-close-up.png")
    save_png(local_relief_overlay(current_side), evidence / "case-body-wireframe-relief.png")
    save_png(gap_overlay(current_side), evidence / "crown-minimum-gap-annotated.png")
    save_png(wall_overlay(current_side), evidence / "case-minimum-wall-annotated.png")


if __name__ == "__main__":
    main()
