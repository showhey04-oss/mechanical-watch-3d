#!/usr/bin/env python3
"""Build Phase 3B.1 comparison boards from real browser screenshots."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageDraw


APP_WIDTH = 1280
APP_HEIGHT = 720
HARNESS_TOP = 62
HEADER_HEIGHT = 52


def read_baseline(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGB")
    if image.size != (APP_WIDTH, APP_HEIGHT + HARNESS_TOP):
        raise ValueError(f"unexpected baseline harness size: {image.size}")
    return image.crop((0, HARNESS_TOP, APP_WIDTH, HARNESS_TOP + APP_HEIGHT))


def read_candidate(path: Path) -> Image.Image:
    image = Image.open(path).convert("RGB")
    if image.size != (APP_WIDTH, APP_HEIGHT):
        raise ValueError(f"unexpected candidate size: {image.size}")
    return image


def build_board(baseline: Image.Image, candidate: Image.Image, output: Path) -> None:
    board = Image.new(
        "RGB",
        (APP_WIDTH * 2, APP_HEIGHT + HEADER_HEIGHT),
        (13, 16, 21),
    )
    board.paste(baseline, (0, HEADER_HEIGHT))
    board.paste(candidate, (APP_WIDTH, HEADER_HEIGHT))
    draw = ImageDraw.Draw(board)
    draw.rectangle((0, 0, APP_WIDTH - 1, HEADER_HEIGHT - 1), fill=(28, 33, 42))
    draw.rectangle(
        (APP_WIDTH, 0, APP_WIDTH * 2 - 1, HEADER_HEIGHT - 1),
        fill=(42, 50, 62),
    )
    draw.text((22, 18), "v3.15.0 main baseline (no exterior)", fill=(235, 239, 244))
    draw.text(
        (APP_WIDTH + 22, 18),
        "E-BALANCED query candidate (not default)",
        fill=(235, 239, 244),
    )
    draw.line(
        (APP_WIDTH, 0, APP_WIDTH, APP_HEIGHT + HEADER_HEIGHT),
        fill=(201, 166, 92),
        width=2,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    board.save(output, format="PNG", optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--baseline-front", type=Path, required=True)
    parser.add_argument("--baseline-side", type=Path, required=True)
    parser.add_argument("--evidence-dir", type=Path, required=True)
    args = parser.parse_args()

    build_board(
        read_baseline(args.baseline_front),
        read_candidate(args.evidence_dir / "desktop-front.png"),
        args.evidence_dir / "baseline-vs-balanced-front.png",
    )
    build_board(
        read_baseline(args.baseline_side),
        read_candidate(args.evidence_dir / "desktop-side.png"),
        args.evidence_dir / "baseline-vs-balanced-side.png",
    )


if __name__ == "__main__":
    main()
