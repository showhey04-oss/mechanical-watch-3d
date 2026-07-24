#!/usr/bin/env python3
"""Re-encode in-app Browser runtime screenshots as real PNG files."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image


RUNTIME_IMAGES = (
    "desktop-front.png",
    "desktop-back.png",
    "desktop-side.png",
    "mobile-390-front.png",
    "mobile-390-side.png",
    "crown-position-1.png",
    "crown-position-2.png",
    "opacity-100-front.png",
    "opacity-50-front.png",
    "opacity-16-front.png",
    "case-body-selection.png",
    "opacity-16-internal-selection.png",
    "desktop-oblique-front.png",
    "before-profile-desktop-side.png",
    "before-profile-desktop-oblique-front.png",
)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence_dir", type=Path)
    args = parser.parse_args()
    for name in RUNTIME_IMAGES:
        path = args.evidence_dir / name
        with Image.open(path) as source:
            pixels = source.convert("RGB")
        pixels.save(path, format="PNG", optimize=True)


if __name__ == "__main__":
    main()
