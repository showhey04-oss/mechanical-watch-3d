#!/usr/bin/env python3

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


NAVY = (14, 22, 31)
PANEL = (24, 35, 48)
TEXT = (238, 244, 250)
MUTED = (167, 184, 199)
CYAN = (79, 206, 232)
GREEN = (83, 213, 139)
AMBER = (247, 194, 88)
RED = (245, 105, 111)
BLUE = (99, 151, 255)


def font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc" if bold
        else "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf" if bold
        else "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
        else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ]
    for candidate in candidates:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


F20 = font(20)
F24 = font(24)
F28 = font(28, True)
F34 = font(34, True)
F42 = font(42, True)


def load_rgb(path, expected=None):
    image = Image.open(path).convert("RGB")
    if expected is not None and image.size != expected:
        raise ValueError(f"{path.name}: expected {expected}, got {image.size}")
    return image


def save_png(image, path):
    image.save(path, format="PNG", optimize=True)


def label(draw, xy, text, fill=TEXT, title=False, anchor=None):
    draw.text(xy, text, font=F28 if title else F20, fill=fill, anchor=anchor)


def comparison_board(before, after, title, before_label, after_label):
    width, height = before.size
    if after.size != (width, height):
        raise ValueError("comparison inputs must have matching dimensions")
    header = 76
    board = Image.new("RGB", (width * 2, height + header), NAVY)
    board.paste(before, (0, header))
    board.paste(after, (width, header))
    draw = ImageDraw.Draw(board)
    draw.line((width, header, width, height + header), fill=CYAN, width=3)
    label(draw, (24, 19), title, title=True)
    label(draw, (width - 24, 24), before_label, fill=AMBER, anchor="ra")
    label(draw, (width + 24, 24), after_label, fill=GREEN)
    return board


def section_canvas(title, subtitle):
    image = Image.new("RGB", (1280, 720), NAVY)
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((30, 30, 1250, 690), 24, fill=PANEL, outline=(68, 88, 107), width=2)
    label(draw, (62, 58), title, title=True)
    label(draw, (64, 102), subtitle, fill=MUTED)
    return image, draw


def map_point(radius, y, r_min, r_max, y_min, y_max):
    x = 130 + (radius - r_min) / (r_max - r_min) * 1010
    py = 610 - (y - y_min) / (y_max - y_min) * 420
    return x, py


def draw_profile(draw, points, r_min, r_max, y_min, y_max, color, width=5):
    mapped = [map_point(radius, y, r_min, r_max, y_min, y_max) for radius, y in points]
    draw.line(mapped, fill=color, width=width, joint="curve")
    for point in mapped:
        draw.ellipse((point[0] - 6, point[1] - 6, point[0] + 6, point[1] + 6), fill=color)
    return mapped


def axis(draw, r_min, r_max, y_min, y_max):
    left, right, top, bottom = 130, 1140, 190, 610
    draw.line((left, bottom, right, bottom), fill=MUTED, width=2)
    draw.line((left, top, left, bottom), fill=MUTED, width=2)
    label(draw, (right, bottom + 28), "radius", fill=MUTED, anchor="ra")
    label(draw, (left - 18, top), "Y", fill=MUTED, anchor="ra")
    for index in range(6):
        radius = r_min + (r_max - r_min) * index / 5
        x, _ = map_point(radius, y_min, r_min, r_max, y_min, y_max)
        draw.line((x, bottom - 6, x, bottom + 6), fill=MUTED)
        label(draw, (x, bottom + 14), f"{radius:.3f}", fill=MUTED, anchor="ma")
    for index in range(5):
        y = y_min + (y_max - y_min) * index / 4
        _, py = map_point(r_min, y, r_min, r_max, y_min, y_max)
        draw.line((left - 6, py, left + 6, py), fill=MUTED)
        label(draw, (left - 12, py), f"{y:.3f}", fill=MUTED, anchor="ra")


def bezel_section():
    image, draw = section_canvas(
        "Bezel ↔ case body interface",
        "EDUCATIONAL_RENDERING_CLEARANCE: axial reveal replaces area-bearing coplanar overlap",
    )
    r_min, r_max, y_min, y_max = 14.6, 19.7, -3.32, -2.78
    axis(draw, r_min, r_max, y_min, y_max)
    before = [(14.9, -2.86), (14.9, -3.24), (15.3, -3.24), (18.5, -2.89), (19.4, -2.86)]
    after = [(14.9, -2.86), (14.9, -3.24), (15.3, -3.24), (18.5, -2.90), (19.4, -2.88)]
    body = [(18.9, -2.86), (19.45, -2.86)]
    draw_profile(draw, before, r_min, r_max, y_min, y_max, RED, 3)
    draw_profile(draw, after, r_min, r_max, y_min, y_max, GREEN, 6)
    draw_profile(draw, body, r_min, r_max, y_min, y_max, BLUE, 6)
    label(draw, (760, 146), "before: coplanar width 0.500", fill=RED)
    label(draw, (760, 172), "after: min gap 0.017778 / overlap area 0", fill=GREEN)
    label(draw, (760, 198), "outer axial edge break 0.020", fill=CYAN)
    label(draw, (760, 224), "opening 29.800 / crystal clear 30.600 unchanged", fill=TEXT)
    return image


def caseback_body_section():
    image, draw = section_canvas(
        "Case body ↔ caseback ring interface",
        "The full annular taper is preserved; a narrow axial reveal separates the closure surfaces",
    )
    r_min, r_max, y_min, y_max = 14.0, 19.8, 4.55, 5.32
    axis(draw, r_min, r_max, y_min, y_max)
    before = [(14.274, 4.635), (14.274, 5.235), (14.474, 5.235), (18.9, 4.685), (19.5, 4.635)]
    after = [(14.294, 4.655), (14.294, 5.235), (14.474, 5.235), (18.9, 4.695), (19.5, 4.655)]
    body = [(18.9, 4.635), (19.45, 4.635)]
    draw_profile(draw, before, r_min, r_max, y_min, y_max, RED, 3)
    draw_profile(draw, after, r_min, r_max, y_min, y_max, GREEN, 6)
    draw_profile(draw, body, r_min, r_max, y_min, y_max, BLUE, 6)
    label(draw, (720, 146), "before: coplanar width 0.550", fill=RED)
    label(draw, (720, 172), "after: min gap 0.017695 / overlap area 0", fill=GREEN)
    label(draw, (720, 198), "outer axial edge break 0.040", fill=CYAN)
    label(draw, (720, 224), "total case thickness 8.695 unchanged", fill=TEXT)
    return image


def caseback_window_section():
    image, draw = section_canvas(
        "Caseback ring ↔ transparent window interface",
        "The visible rear opening stays 28.548 while the hidden side cylinder receives radial relief",
    )
    r_min, r_max, y_min, y_max = 14.15, 14.40, 4.55, 5.30
    axis(draw, r_min, r_max, y_min, y_max)
    before_ring = [(14.274, 4.635), (14.274, 5.235)]
    after_ring = [(14.294, 4.655), (14.294, 5.235)]
    window = [(14.274, 4.835), (14.274, 5.215)]
    draw_profile(draw, before_ring, r_min, r_max, y_min, y_max, RED, 4)
    draw_profile(draw, after_ring, r_min, r_max, y_min, y_max, GREEN, 7)
    draw_profile(draw, window, r_min, r_max, y_min, y_max, CYAN, 6)
    label(draw, (620, 146), "before: same cylinder axial overlap 0.380", fill=RED)
    label(draw, (620, 172), "after: radial clearance 0.020 / cylinder overlap 0", fill=GREEN)
    label(draw, (620, 198), "visible rear radius 14.274 unchanged", fill=TEXT)
    label(draw, (620, 224), "depthWrite / depthTest / renderOrder unchanged", fill=MUTED)
    return image


def convert_selected_jpeg(evidence):
    source = evidence / "interface-before-selected-back.jpg"
    target = evidence / "interface-before-selected-back.png"
    if source.exists():
        save_png(load_rgb(source, (1280, 720)), target)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence_directory", type=Path)
    args = parser.parse_args()
    evidence = args.evidence_directory

    convert_selected_jpeg(evidence)
    before_back = load_rgb(evidence / "interface-before-unselected-back.png", (1280, 720))
    after_back = load_rgb(evidence / "interface-after-unselected-back.png", (1280, 720))
    before_oblique = load_rgb(evidence / "interface-before-oblique-back.png", (1280, 720))
    after_oblique = load_rgb(evidence / "interface-after-oblique-back.png", (1280, 720))
    before_side = load_rgb(evidence / "interface-before-side.png", (1280, 720))
    after_side = load_rgb(evidence / "interface-after-side.png", (1280, 720))

    save_png(
        comparison_board(
            before_back,
            after_back,
            "Movement back: interface stability before / after",
            "approved start 8d0946b",
            "interface fix a4e1247",
        ),
        evidence / "interface-before-after-back.png",
    )
    save_png(
        comparison_board(
            before_oblique,
            after_oblique,
            "Oblique movement back: taper and edge continuity",
            "approved start 8d0946b",
            "interface fix a4e1247",
        ),
        evidence / "interface-before-after-oblique-back.png",
    )
    save_png(
        comparison_board(
            before_side,
            after_side,
            "Side: total thickness and exterior profile remain fixed",
            "approved start 8d0946b",
            "interface fix a4e1247",
        ),
        evidence / "interface-before-after-side.png",
    )
    save_png(bezel_section(), evidence / "interface-section-bezel-case-body.png")
    save_png(caseback_body_section(), evidence / "interface-section-case-body-caseback.png")
    save_png(caseback_window_section(), evidence / "interface-section-caseback-window.png")


if __name__ == "__main__":
    main()
