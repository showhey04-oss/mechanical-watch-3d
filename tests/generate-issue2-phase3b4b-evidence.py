#!/usr/bin/env python3
"""Build Phase 3B.4b boards, GIFs, and the closed-world manifest."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = (
    ROOT
    / "docs"
    / "evidence"
    / "issue2-final-polish-phase3b4b-ios-multitouch-stability"
)
RAW = EVIDENCE / "raw"
MOTION = EVIDENCE / "motion"
BOARDS = EVIDENCE / "boards"
MANIFEST = EVIDENCE / "evidence-manifest.json"
SOURCE_BASE_COMMIT = "ece9d99c4e0ff95afd155475ef963e2984c5d05f"
SOURCE_AUDIT_COMMIT = "fac59b714d66215ee0c60b688c0201fea1d9fde4"


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    path = Path("/System/Library/Fonts/Supplemental/Arial.ttf")
    return ImageFont.truetype(str(path), size) if path.exists() else ImageFont.load_default()


def labeled(image: Image.Image, title: str) -> Image.Image:
    result = Image.new("RGB", (image.width, image.height + 54), "#11151b")
    result.paste(image.convert("RGB"), (0, 54))
    draw = ImageDraw.Draw(result)
    draw.text((18, 15), title, fill="#f1f5f9", font=font(22))
    return result


def normalize_capture_pngs() -> None:
    """Preserve captured pixels while making the .png evidence encoding truthful."""
    for directory in (RAW, MOTION):
        for path in sorted(directory.glob("*.png")):
            with Image.open(path) as source:
                pixels = source.convert("RGB")
            pixels.save(path, "PNG")


def make_board(names: list[str], titles: list[str], output: str) -> None:
    panels = [labeled(Image.open(RAW / name), title) for name, title in zip(names, titles)]
    height = max(panel.height for panel in panels)
    board = Image.new("RGB", (sum(panel.width for panel in panels), height), "#11151b")
    x = 0
    for panel in panels:
        board.paste(panel, (x, 0))
        x += panel.width
    board.save(BOARDS / output, "PNG")


def make_motion(prefix: str, duration: int) -> None:
    frames = [
        Image.open(MOTION / f"{prefix}-{index:02d}.png").convert(
            "P",
            palette=Image.Palette.ADAPTIVE,
        )
        for index in range(3)
    ]
    frames[0].save(
        MOTION / f"{prefix}-operation.gif",
        save_all=True,
        append_images=frames[1:] + [frames[1], frames[0]],
        duration=duration,
        loop=0,
        optimize=False,
    )


def make_state_flow() -> None:
    canvas = Image.new("RGB", (1500, 650), "#11151b")
    draw = ImageDraw.Draw(canvas)
    title_font = font(30)
    body_font = font(20)
    draw.text((36, 28), "Phase 3B.4b event-driven input recovery", fill="#f8fafc", font=title_font)
    nodes = [
        ("idle", "0 active pointers"),
        ("one finger", "rotate baseline"),
        ("two fingers", "new centroid / pinch / angle"),
        ("one finger", "discard two-finger baseline"),
        ("idle", "all input state cleared"),
    ]
    x_positions = [55, 340, 625, 910, 1195]
    for x, (name, detail) in zip(x_positions, nodes):
        draw.rounded_rectangle((x, 160, x + 245, 285), 18, fill="#1e293b", outline="#7dd3fc", width=3)
        draw.text((x + 18, 185), name, fill="#f8fafc", font=title_font)
        draw.text((x + 18, 238), detail, fill="#cbd5e1", font=body_font)
    for left, right in zip(x_positions, x_positions[1:]):
        draw.line((left + 245, 222, right, 222), fill="#fbbf24", width=5)
        draw.polygon([(right, 222), (right - 16, 212), (right - 16, 232)], fill="#fbbf24")
    reset_reasons = [
        "pointercancel",
        "lostpointercapture",
        "pointer ID reuse",
        "window blur",
        "visibility hidden",
        "pagehide / pageshow",
    ]
    draw.rounded_rectangle((250, 390, 1250, 570), 20, fill="#172554", outline="#818cf8", width=3)
    draw.text((285, 415), "Event-driven reset reasons", fill="#e0e7ff", font=title_font)
    draw.text((285, 475), "  •  ".join(reset_reasons), fill="#c7d2fe", font=body_font)
    canvas.save(BOARDS / "input-state-flow.png", "PNG")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_manifest() -> None:
    files = sorted(
        path
        for path in EVIDENCE.rglob("*")
        if path.is_file() and path != MANIFEST
    )
    entries = [
        {
            "path": path.relative_to(EVIDENCE).as_posix(),
            "bytes": path.stat().st_size,
            "sha256": sha256(path),
        }
        for path in files
    ]
    payload = {
        "schemaVersion": 1,
        "phase": "ISSUE2-PHASE3B4B-IOS-MULTITOUCH-STABILITY",
        "sourceBaseCommit": SOURCE_BASE_COMMIT,
        "sourceAuditCommit": SOURCE_AUDIT_COMMIT,
        "closedWorld": True,
        "entryCount": len(entries),
        "entries": entries,
        "missing": [],
        "unexpected": [],
        "shaMismatch": [],
    }
    MANIFEST.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n")


def main() -> None:
    BOARDS.mkdir(parents=True, exist_ok=True)
    normalize_capture_pngs()
    make_board(
        [
            "mobile-a-diagnostics-no-framing.png",
            "mobile-b-diagnostics-framing.png",
            "mobile-stability.png",
        ],
        [
            "A: current input / no framing",
            "B: current input / framing",
            "C: stability input / framing",
        ],
        "mobile-a-b-c.png",
    )
    make_board(
        ["desktop-stability.png", "mobile-stability.png"],
        ["Desktop 1280 x 720", "Mobile 390 x 844"],
        "desktop-mobile-stability.png",
    )
    make_motion("desktop", 650)
    make_motion("mobile", 650)
    make_state_flow()
    write_manifest()


if __name__ == "__main__":
    main()
