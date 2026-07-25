#!/usr/bin/env python3

import argparse
from pathlib import Path

from PIL import Image


VIDEOS = {
    "interface-rotation-back-unselected": "interface-rotation-back-unselected.gif",
    "interface-rotation-back-selected": "interface-rotation-back-selected.gif",
    "interface-rotation-back-opacity-50": "interface-rotation-back-opacity-50.gif",
    "interface-rotation-front-bezel": "interface-rotation-front-bezel.gif",
    "interface-rotation-mobile-390-back": "interface-rotation-mobile-390-back.gif",
}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("frames_root", type=Path)
    parser.add_argument("evidence_directory", type=Path)
    args = parser.parse_args()
    for source_name, output_name in VIDEOS.items():
        frame_paths = sorted((args.frames_root / source_name).glob("frame-*.png"))
        if len(frame_paths) != 32:
            raise ValueError(f"{source_name}: expected 32 frames, got {len(frame_paths)}")
        frames = [Image.open(path).convert("RGB") for path in frame_paths]
        expected_size = (390, 844) if "mobile" in source_name else (640, 360)
        if any(frame.size != expected_size for frame in frames):
            raise ValueError(f"{source_name}: unexpected frame dimensions")
        palette = frames[0].convert("P", palette=Image.Palette.ADAPTIVE, colors=192)
        converted = [
            frame.quantize(palette=palette, dither=Image.Dither.FLOYDSTEINBERG)
            for frame in frames
        ]
        converted[0].save(
            args.evidence_directory / output_name,
            format="GIF",
            save_all=True,
            append_images=converted[1:],
            duration=200,
            loop=0,
            disposal=2,
            optimize=False,
        )


if __name__ == "__main__":
    main()
