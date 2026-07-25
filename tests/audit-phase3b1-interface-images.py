#!/usr/bin/env python3

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageStat


PNG_EXPECTED = {
    "interface-before-unselected-back.png": (1280, 720),
    "interface-before-oblique-back.png": (1280, 720),
    "interface-before-side.png": (1280, 720),
    "interface-after-unselected-back.png": (1280, 720),
    "interface-after-selected-back.png": (1280, 720),
    "interface-after-oblique-back.png": (1280, 720),
    "interface-after-side.png": (1280, 720),
    "interface-after-opacity-50.png": (1280, 720),
    "interface-after-opacity-16.png": (1280, 720),
    "interface-after-mobile-390-back.png": (390, 844),
    "interface-after-mobile-390-selected-back.png": (390, 844),
    "interface-after-mobile-390-opacity-50.png": (390, 844),
    "interface-diagnostic-wireframe.png": (1280, 720),
    "interface-diagnostic-normal.png": (1280, 720),
}

GIF_EXPECTED = {
    "interface-rotation-back-unselected.gif": (640, 360),
    "interface-rotation-back-selected.gif": (640, 360),
    "interface-rotation-back-opacity-50.gif": (640, 360),
    "interface-rotation-front-bezel.gif": (640, 360),
    "interface-rotation-mobile-390-back.gif": (390, 844),
}


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def image_distribution(image):
    rgb = image.convert("RGB")
    colors = rgb.getcolors(maxcolors=rgb.width * rgb.height)
    if colors is None:
        unique = rgb.width * rgb.height
        dominant = None
    else:
        unique = len(colors)
        dominant = max(count for count, _ in colors)
    luminance = rgb.convert("L")
    return {
        "uniqueRgbCount": unique,
        "dominantColorRatio":
            None if dominant is None else dominant / (rgb.width * rgb.height),
        "luminanceVariance": ImageStat.Stat(luminance).var[0],
    }


def audit_png(path, expected):
    if path.read_bytes()[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path.name}: PNG signature mismatch")
    with Image.open(path) as image:
        image.load()
        if image.size != expected:
            raise ValueError(f"{path.name}: expected {expected}, got {image.size}")
        distribution = image_distribution(image)
    if distribution["uniqueRgbCount"] < 256:
        raise ValueError(f"{path.name}: insufficient color distribution")
    if (
        distribution["dominantColorRatio"] is not None
        and distribution["dominantColorRatio"] >= 0.98
    ):
        raise ValueError(f"{path.name}: dominant color indicates a blank capture")
    if distribution["luminanceVariance"] <= 1:
        raise ValueError(f"{path.name}: insufficient luminance variance")
    return {
        "file": path.name,
        "width": expected[0],
        "height": expected[1],
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        **distribution,
    }


def audit_gif(path, expected):
    if path.read_bytes()[:6] != b"GIF89a":
        raise ValueError(f"{path.name}: GIF signature mismatch")
    with Image.open(path) as image:
        if image.size != expected:
            raise ValueError(f"{path.name}: expected {expected}, got {image.size}")
        frames = []
        frame_hashes = []
        adjacent_mean_differences = []
        previous = None
        for index in range(image.n_frames):
            image.seek(index)
            frame = image.convert("RGB")
            digest = hashlib.sha256(frame.tobytes()).hexdigest()
            frame_hashes.append(digest)
            frames.append(image_distribution(frame))
            if previous is not None:
                difference = ImageChops.difference(previous, frame).convert("L")
                adjacent_mean_differences.append(ImageStat.Stat(difference).mean[0])
            previous = frame
    if len(frames) != 32:
        raise ValueError(f"{path.name}: expected 32 frames, got {len(frames)}")
    if len(set(frame_hashes)) != 32:
        raise ValueError(f"{path.name}: repeated frames do not prove rotation")
    if min(adjacent_mean_differences) <= 0:
        raise ValueError(f"{path.name}: adjacent frame did not change")
    return {
        "file": path.name,
        "width": expected[0],
        "height": expected[1],
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "frameCount": len(frames),
        "uniqueDecodedFrameCount": len(set(frame_hashes)),
        "adjacentMeanDifference": {
            "minimum": min(adjacent_mean_differences),
            "maximum": max(adjacent_mean_differences),
            "average": sum(adjacent_mean_differences)
            / len(adjacent_mean_differences),
        },
        "minimumFrameUniqueRgbCount": min(
            item["uniqueRgbCount"] for item in frames
        ),
        "minimumFrameLuminanceVariance": min(
            item["luminanceVariance"] for item in frames
        ),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence_directory", type=Path)
    args = parser.parse_args()
    evidence = args.evidence_directory
    png = {
        name: audit_png(evidence / name, dimensions)
        for name, dimensions in PNG_EXPECTED.items()
    }
    gifs = {
        name: audit_gif(evidence / name, dimensions)
        for name, dimensions in GIF_EXPECTED.items()
    }
    report = {
        "schemaVersion": 1,
        "metadata": {
            "sourceBaseCommit":
                "293626f13a50224924f8e3ac229a1fc4077ad7a7",
            "sourceApprovedStartCommit":
                "8d0946bcf4bb9afbeacf06f89c8ae1882cf8cef9",
            "sourceImplementationCommit":
                "a4e12477525ec12d7fbb569e81f442b46d572fef",
            "sourceCaptureCommit":
                "02952fc7ca5b44e762327fd4342401ed719e5777",
            "sourceBranch": "feature/final-exterior-balanced-phase3b1",
            "appVersion": "v3.15.0",
            "candidateStatus": "IMPLEMENTATION_CANDIDATE_NOT_DEFAULT",
        },
        "status": "PASSED",
        "png": png,
        "gifs": gifs,
        "checks": {
            "pngSignatures": True,
            "pngDimensions": True,
            "pngDecoded": True,
            "runtimePixelDistribution": True,
            "gifSignatures": True,
            "gifDimensions": True,
            "gifDecoded": True,
            "gifFrameCount": True,
            "gifAllFramesDistinct": True,
        },
    }
    output = evidence / "reports/exterior-interface-image-audit.json"
    output.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
