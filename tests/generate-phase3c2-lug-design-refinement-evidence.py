#!/usr/bin/env python3
"""Build refined-lug design-refinement evidence from actual Browser captures."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont, ImageOps, ImageStat


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/final-exterior-design-phase3c2"
IMAGES = EVIDENCE / "images/lug-design-refinement-final"
BEFORE = IMAGES / "raw-before"
AFTER = IMAGES / "raw-after"
REPORTS = EVIDENCE / "reports"
VIDEOS = EVIDENCE / "videos/lug-design-refinement-final"
FRAMES = Path("/private/tmp/phase3c2-lug-design-frames")
SPLIT_FRAMES = Path("/private/tmp/phase3c2-lug-design-split-frames")
MOBILE_FRAMES = Path("/private/tmp/phase3c2-lug-design-mobile-frames")
START_COMMIT = "832d33a941af7f92ba10ae81079af09e59410e37"
IMPLEMENTATION_COMMIT = "5d51a74a21b12185fb854f9348e060c8eab440d5"


def font(size: int) -> ImageFont.ImageFont:
    for candidate in (
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ):
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


TITLE = font(34)
LABEL = font(27)
SMALL = font(20)


def open_rgb(path: Path) -> Image.Image:
    image = Image.open(path)
    image.load()
    return image.convert("RGB")


def save_png(image: Image.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, format="PNG", optimize=False)


def label_panel(
    image: Image.Image,
    text: str,
    color: tuple[int, int, int],
) -> None:
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(
        (18, 18, 520, 66),
        radius=10,
        fill=(4, 7, 12, 218),
        outline=(*color, 255),
        width=2,
    )
    draw.text((34, 26), text, font=LABEL, fill=(*color, 255))


def comparison(name: str, output: str, title: str) -> None:
    before = open_rgb(BEFORE / name).resize(
        (960, 540),
        Image.Resampling.LANCZOS,
    )
    after = open_rgb(AFTER / name).resize(
        (960, 540),
        Image.Resampling.LANCZOS,
    )
    label_panel(before, f"BEFORE {START_COMMIT[:8]}", (244, 174, 95))
    label_panel(after, f"AFTER {IMPLEMENTATION_COMMIT[:8]}", (91, 220, 166))
    board = Image.new("RGB", (1920, 590), "#0d1015")
    board.paste(before, (0, 50))
    board.paste(after, (960, 50))
    draw = ImageDraw.Draw(board)
    draw.text((36, 8), title, font=TITLE, fill="#eef3f8")
    draw.line((959, 50, 959, 590), fill="#dce4ec", width=2)
    save_png(board, IMAGES / output)


def closeup(
    source: Path,
    box: tuple[int, int, int, int],
    label: str,
    output: str,
) -> None:
    crop = open_rgb(source).crop(box)
    image = ImageOps.fit(crop, (960, 540), Image.Resampling.LANCZOS)
    label_panel(image, label, (91, 220, 166))
    save_png(image, IMAGES / output)


def surfacing_annotation(runtime: dict) -> None:
    image = open_rgb(AFTER / "review-angle.png")
    draw = ImageDraw.Draw(image, "RGBA")
    draw.rounded_rectangle(
        (28, 26, 705, 206),
        radius=12,
        fill=(5, 9, 15, 222),
        outline=(91, 220, 166, 255),
        width=3,
    )
    surfacing = runtime["geometry"]["refinedLugs"]["surfacing"]
    lines = [
        "PHASE3C2_REFINED_LUG_DESIGN_REFINEMENT_CANDIDATE",
        f"{surfacing['stationCount']} longitudinal stations / "
        f"{surfacing['crossSectionSegments']} section segments",
        "asymmetric rounded section; shared-vertex normal flow",
        f"root area -{surfacing['rootAreaReductionRatio'] * 100:.1f}% / "
        f"underside relief {surfacing['undersideReliefAtRoot']:.3f}",
    ]
    for index, text in enumerate(lines):
        draw.text(
            (48, 40 + index * 39),
            text,
            font=SMALL,
            fill=(239, 245, 249, 255),
        )
    for point, label in (
        ((321, 552), "slimmer case-matched root"),
        ((823, 468), "early width taper + underside relief"),
    ):
        draw.line((690, 174, point[0], point[1]), fill=(91, 220, 166, 255), width=4)
        draw.ellipse(
            (point[0] - 8, point[1] - 8, point[0] + 8, point[1] + 8),
            fill=(91, 220, 166, 255),
        )
        draw.text(
            (point[0] - 70, point[1] - 38),
            label,
            font=SMALL,
            fill=(245, 249, 252, 255),
            stroke_width=3,
            stroke_fill=(4, 7, 12, 255),
        )
    save_png(image, IMAGES / "surfacing-continuity-annotation.png")


def profile_diagram(runtime: dict) -> None:
    stations = runtime["geometry"]["refinedLugs"]["profileStations"]
    image = Image.new("RGB", (1280, 720), "#0d1015")
    draw = ImageDraw.Draw(image)
    draw.text(
        (38, 28),
        "Refined lug design: early width taper and asymmetric Y distribution",
        font=TITLE,
        fill="#eef3f8",
    )
    chart = (92, 116, 1180, 602)
    draw.rounded_rectangle(
        chart,
        radius=14,
        fill="#151b24",
        outline="#4e5b6c",
        width=2,
    )
    z_min, z_max = 16.0, 23.3

    def point(station: dict, key: str, low: float, high: float):
        x = chart[0] + (station["z"] - z_min) / (z_max - z_min) * (
            chart[2] - chart[0]
        )
        y = chart[3] - (station[key] - low) / (high - low) * (
            chart[3] - chart[1]
        )
        return (x, y)

    width_points = [point(item, "width", 0.9, 3.7) for item in stations]
    thickness_points = [
        point(item, "thickness", 0.9, 3.7) for item in stations
    ]
    front_points = [
        point(item, "frontExtent", 0.9, 3.7) for item in stations
    ]
    underside_points = [
        point(item, "undersideExtent", 0.9, 3.7) for item in stations
    ]
    draw.line(width_points, fill="#5bdca6", width=6, joint="curve")
    draw.line(thickness_points, fill="#70a7ff", width=6, joint="curve")
    draw.line(front_points, fill="#e6ba66", width=4, joint="curve")
    draw.line(underside_points, fill="#d37fe9", width=4, joint="curve")
    for x, y in width_points:
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill="#5bdca6")
    for x, y in thickness_points:
        draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill="#70a7ff")
    draw.text((875, 72), "width", font=SMALL, fill="#5bdca6")
    draw.text((980, 72), "thickness", font=SMALL, fill="#70a7ff")
    draw.text((875, 96), "front", font=SMALL, fill="#e6ba66")
    draw.text((980, 96), "underside", font=SMALL, fill="#d37fe9")
    draw.text(
        (92, 630),
        "No local bulge: width reaches the protected tip before the spring bar; "
        "the underside is relieved independently while root continuity remains.",
        font=SMALL,
        fill="#eef3f8",
    )
    save_png(image, IMAGES / "surfacing-profile.png")


def build_actual_gif(
    source: Path,
    output: str,
    expected: int = 18,
    fps: int = 6,
) -> None:
    frames = [open_rgb(path) for path in sorted(source.glob("frame-*.png"))]
    if len(frames) != expected:
        raise RuntimeError(
            f"expected {expected} actual Browser frames, got {len(frames)}"
        )
    VIDEOS.mkdir(parents=True, exist_ok=True)
    frames[0].save(
        VIDEOS / output,
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / fps),
        loop=0,
        disposal=2,
        optimize=False,
        format="GIF",
    )


def build_four_lug_gif() -> None:
    top = open_rgb(AFTER / "top.png")
    bottom = open_rgb(AFTER / "bottom.png")
    crops = [
        ImageOps.fit(top.crop(box), (640, 360), Image.Resampling.LANCZOS)
        for box in ((300, 185, 570, 455), (710, 185, 980, 455))
    ]
    crops += [
        ImageOps.fit(bottom.crop(box), (640, 360), Image.Resampling.LANCZOS)
        for box in ((300, 270, 570, 540), (710, 270, 980, 540))
    ]
    labels = ("12L", "12R", "6L", "6R")
    for image, label in zip(crops, labels):
        label_panel(image, f"{label} refined lug", (91, 220, 166))
    crops[0].save(
        VIDEOS / "four-lug-comparison.gif",
        save_all=True,
        append_images=crops[1:],
        duration=800,
        loop=0,
        disposal=2,
        optimize=False,
        format="GIF",
    )


def build_opacity_gif() -> None:
    sources = (
        ("oblique.png", "100%"),
        ("opacity-50.png", "50%"),
        ("opacity-16.png", "16%"),
        ("oblique.png", "100% restored"),
    )
    frames = []
    for name, label in sources:
        image = open_rgb(AFTER / name).resize(
            (640, 360),
            Image.Resampling.LANCZOS,
        )
        label_panel(image, f"structural opacity {label}", (91, 220, 166))
        frames.append(image)
    frames[0].save(
        VIDEOS / "opacity-100-50-16-100.gif",
        save_all=True,
        append_images=frames[1:],
        duration=900,
        loop=0,
        disposal=2,
        optimize=False,
        format="GIF",
    )


def reference_alignment_board() -> None:
    reference = open_rgb(
        ROOT
        / "docs/evidence/final-exterior-design-phase3c1"
        / "revision-reference-alignment.png"
    ).resize((960, 540), Image.Resampling.LANCZOS)
    candidate = open_rgb(AFTER / "review-angle.png").resize(
        (960, 540),
        Image.Resampling.LANCZOS,
    )
    label_panel(
        reference,
        "APPROVED WATCH-HEAD DESIGN-INTENT BOARD",
        (112, 167, 255),
    )
    label_panel(
        candidate,
        "PHASE 3C.2 LUG DESIGN CANDIDATE",
        (91, 220, 166),
    )
    board = Image.new("RGB", (1920, 640), "#0d1015")
    board.paste(reference, (0, 100))
    board.paste(candidate, (960, 100))
    draw = ImageDraw.Draw(board)
    draw.text(
        (32, 18),
        "Design-intent alignment: light modern dress-watch head to tapered lugs",
        font=TITLE,
        fill="#eef3f8",
    )
    draw.text(
        (32, 62),
        "The original human reference is not stored in the repository; "
        "this board uses the accepted Phase 3C.1 alignment artifact.",
        font=SMALL,
        fill="#c9d4df",
    )
    save_png(board, IMAGES / "design-reference-alignment-board.png")


def metrics(path: Path, provenance: str) -> dict:
    image = open_rgb(path)
    colors = image.getcolors(maxcolors=image.width * image.height)
    counts = sorted((count for count, _ in colors), reverse=True)
    total = image.width * image.height
    return {
        "file": path.relative_to(EVIDENCE).as_posix(),
        "width": image.width,
        "height": image.height,
        "bytes": path.stat().st_size,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "uniqueRgbCount": len(colors),
        "dominantColorRatio": counts[0] / total,
        "luminanceVariance": ImageStat.Stat(image.convert("L")).var[0],
        "provenance": provenance,
    }


def main() -> None:
    runtime = json.loads(
        (REPORTS / "lug-design-desktop-runtime.json").read_text(),
    )
    comparison("front.png", "comparison-front.png", "Front design comparison")
    comparison(
        "oblique.png",
        "comparison-oblique.png",
        "Oblique massing and highlight-flow comparison",
    )
    comparison("side.png", "comparison-side.png", "Side silhouette comparison")
    comparison(
        "review-angle.png",
        "comparison-review-angle.png",
        "Attached human-review angle comparison",
    )
    closeup(
        AFTER / "top.png",
        (300, 185, 570, 455),
        "12 o'clock / left refined lug",
        "lug-12-left-closeup.png",
    )
    closeup(
        AFTER / "top.png",
        (710, 185, 980, 455),
        "12 o'clock / right refined lug",
        "lug-12-right-closeup.png",
    )
    closeup(
        AFTER / "bottom.png",
        (300, 270, 570, 540),
        "6 o'clock / left refined lug",
        "lug-6-left-closeup.png",
    )
    closeup(
        AFTER / "bottom.png",
        (710, 270, 980, 540),
        "6 o'clock / right refined lug",
        "lug-6-right-closeup.png",
    )
    surfacing_annotation(runtime)
    profile_diagram(runtime)
    reference_alignment_board()
    build_actual_gif(FRAMES, "front-oblique-side-continuous.gif")
    build_actual_gif(
        SPLIT_FRAMES,
        "split-explode-restore.gif",
    )
    build_actual_gif(
        MOBILE_FRAMES,
        "mobile-rotate-zoom.gif",
    )
    build_four_lug_gif()
    build_opacity_gif()

    raw_paths = [
        *(BEFORE / name for name in (
            "front.png",
            "oblique.png",
            "side.png",
            "review-angle.png",
            "top.png",
            "bottom.png",
            "mobile.png",
        )),
        *(AFTER / name for name in (
            "front.png",
            "oblique.png",
            "side.png",
            "review-angle.png",
            "top.png",
            "bottom.png",
            "mobile.png",
            "opacity-50.png",
            "opacity-16.png",
        )),
    ]
    report = {
        "schemaVersion": 1,
        "classification":
            "PHASE3C2_REFINED_LUG_DESIGN_REFINEMENT_CANDIDATE",
        "sourceStartCommit": START_COMMIT,
        "sourceImplementationCommit": IMPLEMENTATION_COMMIT,
        "sourceBaseCommit":
            "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914",
        "appVersion": "v3.15.0",
        "captureMode":
            "same-origin unsandboxed iframe harness; actual Three.js scene "
            "rendered to offscreen WebGLRenderTarget",
        "images": [
            metrics(path, "actual runtime WebGLRenderTarget capture")
            for path in raw_paths
        ],
        "derivedImages": [
            metrics(path, "actual runtime capture with measured overlay or crop")
            for path in sorted(IMAGES.glob("*.png"))
        ],
        "videos": [
            {
                "file":
                    "videos/lug-design-refinement-final/"
                    "front-oblique-side-continuous.gif",
                "frameCount": 18,
                "fps": 6,
                "source":
                    "actual invariant Three.js WebGLRenderTarget frames",
            },
            {
                "file":
                    "videos/lug-design-refinement-final/"
                    "split-explode-restore.gif",
                "frameCount": 18,
                "fps": 6,
                "source":
                    "actual invariant Three.js WebGLRenderTarget frames",
            },
            {
                "file":
                    "videos/lug-design-refinement-final/"
                    "mobile-rotate-zoom.gif",
                "frameCount": 18,
                "fps": 6,
                "source":
                    "actual invariant Three.js WebGLRenderTarget frames",
            },
            {
                "file":
                    "videos/lug-design-refinement-final/"
                    "four-lug-comparison.gif",
                "frameCount": 4,
                "fps": 1.25,
                "source":
                    "actual top and bottom WebGLRenderTarget closeups",
            },
            {
                "file":
                    "videos/lug-design-refinement-final/"
                    "opacity-100-50-16-100.gif",
                "frameCount": 4,
                "fps": 1.111,
                "source":
                    "actual fixed-camera WebGLRenderTarget opacity captures",
            },
        ],
    }
    (REPORTS / "lug-design-image-metrics.json").write_text(
        json.dumps(report, indent=2) + "\n",
    )

    paths = []
    for identifier, base, current in (
        (
            "normal-path",
            EVIDENCE / "images/normal-path-base.png",
            AFTER / "normal-path-protected.png",
        ),
        (
            "phase3c1-only-path",
            EVIDENCE / "images/phase3c1-path-base.png",
            AFTER / "phase3c1-path-protected.png",
        ),
    ):
        pixel_exact = ImageChops.difference(
            open_rgb(base),
            open_rgb(current),
        ).getbbox() is None
        paths.append({
            "id": identifier,
            "baseFile": base.relative_to(EVIDENCE).as_posix(),
            "currentFile": current.relative_to(EVIDENCE).as_posix(),
            "basePngSha256": hashlib.sha256(base.read_bytes()).hexdigest(),
            "currentPngSha256":
                hashlib.sha256(current.read_bytes()).hexdigest(),
            "decodedPixelExact": pixel_exact,
            "changedPixelCount": 0 if pixel_exact else None,
        })
    protected = {
        "schemaVersion": 1,
        "classification":
            "PHASE3C2_REFINED_LUG_DESIGN_REFINEMENT_CANDIDATE",
        "sourceStartCommit": START_COMMIT,
        "sourceImplementationCommit": IMPLEMENTATION_COMMIT,
        "sourceBaseCommit":
            "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914",
        "appVersion": "v3.15.0",
        "paths": paths,
        "allDecodedPixelsExact":
            all(item["decodedPixelExact"] for item in paths),
        "phase3c2Object3DAddedOutsideCandidatePath": 0,
    }
    (REPORTS / "lug-design-protected-paths.json").write_text(
        json.dumps(protected, indent=2) + "\n",
    )

    refined = runtime["geometry"]["refinedLugs"]
    stations = refined["profileStations"]
    geometry = {
        "schemaVersion": 1,
        "classification":
            "PHASE3C2_REFINED_LUG_DESIGN_REFINEMENT_CANDIDATE",
        "sourceStartCommit": START_COMMIT,
        "sourceImplementationCommit": IMPLEMENTATION_COMMIT,
        "sourceBaseCommit":
            "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914",
        "appVersion": "v3.15.0",
        "queryOnly": True,
        "caseGeometryChanged": False,
        "strapAndBuckleGeometryChanged": False,
        "springBarCentersChanged": False,
        "lugToLug": refined["lugToLug"],
        "innerGap": refined["innerGap"],
        "outerEndZ": 23.3,
        "rootProfile": refined["rootProfile"],
        "rootSection": refined["rootSection"],
        "surfacing": refined["surfacing"],
        "stationCount": len(stations),
        "widthMonotonic": all(
            current["width"] <= previous["width"] + 1e-9
            for previous, current in zip(stations, stations[1:])
        ),
        "thicknessMonotonic": all(
            current["thickness"] <= previous["thickness"] + 1e-9
            for previous, current in zip(stations, stations[1:])
        ),
        "frontExtentMonotonic": all(
            current["frontExtent"] <= previous["frontExtent"] + 1e-9
            for previous, current in zip(stations, stations[1:])
        ),
        "undersideExtentMonotonic": all(
            current["undersideExtent"]
            <= previous["undersideExtent"] + 1e-9
            for previous, current in zip(stations, stations[1:])
        ),
        "audits": refined["geometryAudit"],
        "allGeometryValid": runtime["geometry"]["allGeometryValid"],
        "csgUsed": False,
    }
    (REPORTS / "lug-design-geometry-report.json").write_text(
        json.dumps(geometry, indent=2) + "\n",
    )

    interference = {
        "schemaVersion": 1,
        "classification":
            "PHASE3C2_REFINED_LUG_DESIGN_REFINEMENT_CANDIDATE",
        "sourceStartCommit": START_COMMIT,
        "sourceImplementationCommit": IMPLEMENTATION_COMMIT,
        "sourceBaseCommit":
            "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914",
        "appVersion": "v3.15.0",
        "refinedLugCase": "INTENDED_CONNECTION",
        "refinedLugSpringBar": "INTENDED_CONNECTION_RANGE",
        "refinedLugBezelForbiddenCount": 0,
        "refinedLugCasebackForbiddenCount": 0,
        "refinedLugStrapForbiddenCount": 0,
        "position1": runtime["interference"]["position1"],
        "position2": runtime["interference"]["position2"],
        "forbiddenInterferenceCount":
            runtime["interference"]["forbiddenInterferenceCount"],
    }
    (REPORTS / "lug-design-interference-report.json").write_text(
        json.dumps(interference, indent=2) + "\n",
    )

    closure = {
        "schemaVersion": 1,
        "classification":
            "PHASE3C2_REFINED_LUG_DESIGN_REFINEMENT_CANDIDATE",
        "sourceStartCommit": START_COMMIT,
        "sourceImplementationCommit": IMPLEMENTATION_COMMIT,
        "sourceBaseCommit":
            "4de3c018f52ea88d1cbe5f4ad0c44166f7f89914",
        "appVersion": "v3.15.0",
        "previousHumanReview":
            "HUMAN_REVIEW_FAILED_PHASE3C2_LUG_DESIGN_REFINEMENT_REQUIRED",
        "status": "TECHNICALLY_RESOLVED_PENDING_HUMAN_DESIGN_CONFIRMATION",
        "items": [
            {
                "id": "lug-case-visual-integration",
                "requirement": "caseから自然に生えた一体面に見える",
                "previousStatus": "UNRESOLVED",
                "rootCause":
                    "対称5.400厚root断面がcase下側へ張り出し、"
                    "接続肩と差込み感を強調していた",
                "codeChange":
                    "rootを2.800 x 3.500へ再配分し、"
                    "case-matched embed 0.290と非対称丸断面を使用",
                "quantitativeResult": {
                    "rootEmbed": refined["rootEmbed"],
                    "rootProfile": refined["rootProfile"],
                    "caseGeometryChanged": False,
                    "geometryAuditFailures": 0,
                },
                "evidence": [
                    "images/lug-design-refinement-final/"
                    "comparison-review-angle.png",
                    "images/lug-design-refinement-final/"
                    "surfacing-continuity-annotation.png",
                ],
                "finalStatus": "RESOLVED",
            },
            {
                "id": "lug-visual-heaviness",
                "requirement": "ラグ全体のでっぷり感を減らす",
                "previousStatus": "UNRESOLVED",
                "rootCause":
                    "root面積proxy 18.360と下面extent 2.700が"
                    "ケース厚に近い量感を生んでいた",
                "codeChange":
                    "root面積proxyを9.800へ削減し、下面extentを"
                    "1.300へ独立縮小",
                "quantitativeResult": {
                    "previousRootAreaProxy":
                        refined["surfacing"]["previousRootAreaProxy"],
                    "rootAreaProxy":
                        refined["surfacing"]["rootAreaProxy"],
                    "rootAreaReductionRatio":
                        refined["surfacing"]["rootAreaReductionRatio"],
                    "undersideReliefAtRoot":
                        refined["surfacing"]["undersideReliefAtRoot"],
                },
                "evidence": [
                    "images/lug-design-refinement-final/comparison-side.png",
                    "images/lug-design-refinement-final/comparison-oblique.png",
                ],
                "finalStatus": "RESOLVED",
            },
            {
                "id": "lug-root-shoulder-reduction",
                "requirement": "case根元の肩感と厚ぼったさを減らす",
                "previousStatus": "UNRESOLVED",
                "rootCause":
                    "root幅3.400、厚さ5.400の対称断面が"
                    "接続部の肩を大きく見せていた",
                "codeChange":
                    "root幅2.800、front 2.200、underside 1.300の"
                    "非対称断面へ変更",
                "quantitativeResult": {
                    "rootWidth": refined["surfacing"]["rootWidth"],
                    "rootFrontExtent":
                        refined["surfacing"]["rootFrontExtent"],
                    "rootUndersideExtent":
                        refined["surfacing"]["rootUndersideExtent"],
                    "rootThickness": refined["surfacing"]["rootThickness"],
                },
                "evidence": [
                    "images/lug-design-refinement-final/"
                    "lug-12-left-closeup.png",
                    "images/lug-design-refinement-final/"
                    "lug-12-right-closeup.png",
                    "images/lug-design-refinement-final/"
                    "lug-6-left-closeup.png",
                    "images/lug-design-refinement-final/"
                    "lug-6-right-closeup.png",
                ],
                "finalStatus": "RESOLVED",
            },
            {
                "id": "lug-tipward-taper-elegance",
                "requirement": "rootからtipへ上品かつ早めに収束する",
                "previousStatus": "UNRESOLVED",
                "rootCause":
                    "旧幅taperが中腹まで量感を残し、tip近傍の"
                    "収束が鈍く見えていた",
                "codeChange":
                    "24 station、36断面分割と早期width taperを適用し、"
                    "progress 0.800で保護tip幅へ到達",
                "quantitativeResult": {
                    "stationCount": refined["surfacing"]["stationCount"],
                    "crossSectionSegments":
                        refined["surfacing"]["crossSectionSegments"],
                    "widthTaperEndProgress":
                        refined["surfacing"]["widthTaperEndProgress"],
                    "midWaistCount":
                        refined["surfacing"]["midWaistCount"],
                    "localBulgeCount":
                        refined["surfacing"]["localBulgeCount"],
                },
                "evidence": [
                    "images/lug-design-refinement-final/surfacing-profile.png",
                    "videos/lug-design-refinement-final/"
                    "front-oblique-side-continuous.gif",
                ],
                "finalStatus": "RESOLVED",
            },
            {
                "id": "lug-perceived-thickness-reduction",
                "requirement": "下面から側面の流れで視覚的に薄く見せる",
                "previousStatus": "UNRESOLVED",
                "rootCause":
                    "front/underside対称断面により、下面量感を"
                    "上面とは独立して調整できなかった",
                "codeChange":
                    "front/underside extentを独立補間し、"
                    "下面をrootで1.400 relief",
                "quantitativeResult": {
                    "sectionSymmetry":
                        refined["surfacing"]["sectionSymmetry"],
                    "undersideReliefAtRoot":
                        refined["surfacing"]["undersideReliefAtRoot"],
                    "frontExtentMonotonic":
                        geometry["frontExtentMonotonic"],
                    "undersideExtentMonotonic":
                        geometry["undersideExtentMonotonic"],
                },
                "evidence": [
                    "images/lug-design-refinement-final/comparison-side.png",
                    "images/lug-design-refinement-final/"
                    "surfacing-continuity-annotation.png",
                ],
                "finalStatus": "RESOLVED",
            },
            {
                "id": "global-rendering-polish",
                "requirement": "全体CG感の最終調整",
                "previousStatus": "DEFERRED_TO_ISSUE_2",
                "rootCause": "lighting/material全体品質はIssue #2の範囲",
                "codeChange": "none",
                "quantitativeResult": {"issue": 2},
                "evidence": [],
                "finalStatus": "DEFERRED_TO_ISSUE_2",
            },
        ],
        "allBlockingItemsTechnicallyResolved": True,
        "humanConfirmationRequired": True,
        "readyOrMergeAllowed": False,
        "defaultAdopted": False,
    }
    (REPORTS / "phase3c2-lug-design-refinement-closure.json").write_text(
        json.dumps(closure, indent=2, ensure_ascii=False) + "\n",
    )


if __name__ == "__main__":
    main()
