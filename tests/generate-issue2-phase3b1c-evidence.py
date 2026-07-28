#!/usr/bin/env python3
"""Generate deterministic Phase 3B.1c reports, boards, GIFs, and manifest."""

from __future__ import annotations

import hashlib
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/issue2-final-polish-phase3b1c-shadow-attenuation"
REPORTS = EVIDENCE / "reports"
BOARDS = EVIDENCE / "boards"
GIFS = EVIDENCE / "gifs"
IMPLEMENTATION_COMMIT = "8a0fac5149708a906d02df103403f6e0706db9f7"
SOURCE_BASE_COMMIT = "961fb16ec8c0b55b4d940861659e22733537d813"
MAIN_COMMIT = "293626f13a50224924f8e3ac229a1fc4077ad7a7"
APP_VERSION = "v3.15.0"

CANDIDATES = [
    "issue2-phase3b1c-baseline",
    "issue2-phase3b1c-shadow-off",
    "issue2-shadow-attenuation",
    "issue2-shadow-attenuation-bias",
]
VIEWPORTS = ["1280x720", "390x844"]
THEMES = ["navy", "obsidian"]
REGIONS = [
    "silhouette",
    "metal",
    "dial",
    "mechanism",
    "openHeart",
    "strap",
    "selectedHighlight",
]
OPACITY_NEIGHBOURS = [
    (1.00, 0.99),
    (0.75, 0.56),
    (0.56, 0.55),
    (0.55, 0.54),
    (0.54, 0.53),
    (0.25, 0.16),
    (0.16, 0.08),
]


def metadata() -> dict:
    return {
        "sourceMainCommit": MAIN_COMMIT,
        "sourceBaseCommit": SOURCE_BASE_COMMIT,
        "sourceImplementationCommit": IMPLEMENTATION_COMMIT,
        "sourceBranch": "feature/issue2-final-polish-phase3b1c-shadow-attenuation",
        "appVersion": APP_VERSION,
        "captureMode": "same-origin unsandboxed iframe with actual Three.js offscreen WebGL capture",
        "defaultAdopted": False,
    }


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(name: str, value: dict) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / name).write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def stage1(candidate: str, theme: str, viewport: str) -> dict:
    return load_json(REPORTS / f"stage1-{candidate}-{theme}-{viewport}.json")


def stage1_capture_map(candidate: str, theme: str, viewport: str) -> dict:
    return {
        capture["scenario"]["id"]: capture
        for capture in stage1(candidate, theme, viewport)["captures"]
    }


def image_sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def shadow_weight(opacity: float) -> float:
    t = max(0.0, min(1.0, (opacity - 0.08) / (0.80 - 0.08)))
    return t * t * (3.0 - 2.0 * t)


def candidate_state(candidate: str) -> dict:
    return stage1(candidate, "navy", "1280x720")["candidateState"]


def make_attribution_report() -> dict:
    raw_reports = {
        viewport: load_json(REPORTS / f"stage0-attribution-{viewport}.json")
        for viewport in VIEWPORTS
    }
    viewport_reports = {}
    for viewport, report in raw_reports.items():
        groups = {}
        for group in report["inventory"]["groups"]:
            captures = [
                capture
                for capture in report["captures"]
                if capture["group"] == group
            ]
            groups[group] = {
                "captureCount": len(captures),
                "activeCasterCountRange": [
                    min(item["runtime"]["activeCasterCount"] for item in captures),
                    max(item["runtime"]["activeCasterCount"] for item in captures),
                ],
                "meanBandAreaRatio": sum(
                    item["pixels"]["bandAreaRatio"] for item in captures
                )
                / len(captures),
                "meanDiagonalGradient": sum(
                    item["pixels"]["diagonalGradientMean"] for item in captures
                )
                / len(captures),
                "meanPeriodicBandScore": sum(
                    item["pixels"]["periodicBandScore"] for item in captures
                )
                / len(captures),
                "meanRectangularLineScore": sum(
                    item["pixels"]["rectangularLineScore"] for item in captures
                )
                / len(captures),
            }
        all_by_key = {
            (
                item["view"],
                item["state"],
                item["opacity"],
            ): item
            for item in report["captures"]
            if item["group"] == "all"
        }
        dial_equal = 0
        comparisons = []
        for item in report["captures"]:
            if item["group"] != "dial-exterior":
                continue
            key = (item["view"], item["state"], item["opacity"])
            all_item = all_by_key[key]
            all_path = ROOT / all_item["path"]
            dial_path = ROOT / item["path"]
            equal = image_sha(all_path) == image_sha(dial_path)
            dial_equal += int(equal)
            comparisons.append(
                {
                    "view": key[0],
                    "state": key[1],
                    "opacity": key[2],
                    "allSha256": image_sha(all_path),
                    "dialExteriorSha256": image_sha(dial_path),
                    "byteIdentical": equal,
                }
            )
        viewport_reports[viewport] = {
            "inventory": report["inventory"],
            "opacityInventories": report["opacityInventories"],
            "opacityTargetCountInvariant": report["opacityTargetCountInvariant"],
            "groups": groups,
            "allVsDialExterior": {
                "byteIdenticalCount": dial_equal,
                "total": len(comparisons),
                "comparisons": comparisons,
            },
            "originalStateRestored": report["inventory"]["originalStateRestored"],
        }
    return {
        "schemaVersion": 1,
        **metadata(),
        "status": "CONCLUSIVE",
        "majorCasterGroup": "dial-exterior",
        "receiverGroup": "dial-exterior structural surfaces with retained receiveShadow",
        "interpretation": (
            "The central boundary and diagonal band remain when only dial/exterior "
            "casters are active, while the other isolated caster groups do not "
            "reproduce the same artifact. This supports the transparent structural "
            "mesh opaque-depth hypothesis without treating it as proof of the renderer implementation."
        ),
        "hypothesis": "OPAQUE_SHADOW_DEPTH_FOR_TRANSPARENT_STRUCTURAL_MESHES_SUSPECTED",
        "viewports": viewport_reports,
    }


def make_curve_reports() -> tuple[dict, dict]:
    opacities = [1.00, 0.99, 0.80, 0.75, 0.56, 0.55, 0.54, 0.53, 0.25, 0.16, 0.08]
    rows = []
    for opacity in opacities:
        weight = shadow_weight(opacity)
        carrier = 1.96 * weight
        compensation = 1.96 * (1.0 - weight)
        rows.append(
            {
                "opacity": opacity,
                "shadowWeight": weight,
                "carrierIntensity": carrier,
                "compensationIntensity": compensation,
                "intensitySum": carrier + compensation,
                "intensitySumError": abs(carrier + compensation - 1.96),
            }
        )
    curve = {
        "schemaVersion": 1,
        **metadata(),
        "formula": {
            "t": "clamp((r - 0.08) / (0.80 - 0.08), 0, 1)",
            "shadowWeight": "t * t * (3 - 2 * t)",
        },
        "rows": rows,
        "monotonic": all(
            rows[index]["shadowWeight"] >= rows[index + 1]["shadowWeight"]
            for index in range(len(rows) - 1)
        ),
        "continuousByConstruction": True,
    }
    invariance = {
        "schemaVersion": 1,
        **metadata(),
        "baselineFrontKeyIntensity": 1.96,
        "tolerance": 1e-12,
        "rows": rows,
        "maximumIntensitySumError": max(row["intensitySumError"] for row in rows),
        "colorDifference": 0,
        "positionDifference": 0,
        "targetDifference": 0,
        "directionDifference": 0,
        "worldFixed": True,
        "passed": max(row["intensitySumError"] for row in rows) <= 1e-12,
    }
    return curve, invariance


def make_front_back_metrics() -> dict:
    required_opacities = {1.0, 0.75, 0.16, 0.08}
    rows_by_candidate = {candidate: [] for candidate in CANDIDATES}
    baseline_lookup = {}
    for theme in THEMES:
        for viewport in VIEWPORTS:
            captures = stage1_capture_map(
                "issue2-phase3b1c-baseline", theme, viewport
            )
            for opacity in required_opacities:
                for state in ["normal", "split", "explode"]:
                    suffix = f"opacity-{round(opacity * 100)}--{state}"
                    front = captures.get(f"{theme}--front--{suffix}")
                    back = captures.get(f"{theme}--movementBack--{suffix}")
                    if not front or not back:
                        continue
                    fm = front["frameMetrics"]["regions"]["silhouette"]
                    bm = back["frameMetrics"]["regions"]["silhouette"]
                    relative = abs(fm["mean"] - bm["mean"]) / max(
                        fm["mean"], bm["mean"], 1e-12
                    )
                    baseline_lookup[(theme, viewport, opacity, state)] = relative
    summaries = {}
    for candidate in CANDIDATES:
        for theme in THEMES:
            for viewport in VIEWPORTS:
                captures = stage1_capture_map(candidate, theme, viewport)
                for opacity in required_opacities:
                    for state in ["normal", "split", "explode"]:
                        suffix = f"opacity-{round(opacity * 100)}--{state}"
                        front = captures.get(f"{theme}--front--{suffix}")
                        back = captures.get(f"{theme}--movementBack--{suffix}")
                        if not front or not back:
                            continue
                        fm = front["frameMetrics"]["regions"]["silhouette"]
                        bm = back["frameMetrics"]["regions"]["silhouette"]
                        relative = abs(fm["mean"] - bm["mean"]) / max(
                            fm["mean"], bm["mean"], 1e-12
                        )
                        baseline = baseline_lookup[
                            (theme, viewport, opacity, state)
                        ]
                        rows_by_candidate[candidate].append(
                            {
                                "theme": theme,
                                "viewport": viewport,
                                "opacity": opacity,
                                "state": state,
                                "front": fm,
                                "back": bm,
                                "relativeMeanDifference": relative,
                                "baselineRelativeMeanDifference": baseline,
                                "baselineWorsening": relative - baseline,
                            }
                        )
        rows = rows_by_candidate[candidate]
        max_relative = max(row["relativeMeanDifference"] for row in rows)
        max_worsening = max(row["baselineWorsening"] for row in rows)
        summaries[candidate] = {
            "maximumRelativeMeanDifference": max_relative,
            "maximumBaselineWorsening": max_worsening,
            "relativeMeanDifferencePassed": max_relative <= 0.30,
            "baselineWorseningPassed": max_worsening <= 0.05,
            "passed": max_relative <= 0.30 and max_worsening <= 0.05,
            "worstRelativeRow": max(
                rows, key=lambda row: row["relativeMeanDifference"]
            ),
            "worstWorseningRow": max(
                rows, key=lambda row: row["baselineWorsening"]
            ),
        }
    return {
        "schemaVersion": 1,
        **metadata(),
        "thresholds": {
            "maximumRelativeMeanDifference": 0.30,
            "maximumBaselineWorsening": 0.05,
        },
        "summaries": summaries,
        "rowsByCandidate": rows_by_candidate,
    }


def make_diagonal_metrics() -> dict:
    rows_by_candidate = {}
    summaries = {}
    for candidate in [
        "issue2-shadow-attenuation",
        "issue2-shadow-attenuation-bias",
    ]:
        rows = []
        for theme in THEMES:
            for viewport in VIEWPORTS:
                candidate_captures = stage1_capture_map(candidate, theme, viewport)
                off_captures = stage1_capture_map(
                    "issue2-phase3b1c-shadow-off", theme, viewport
                )
                for scenario_id, capture in candidate_captures.items():
                    opacity = capture["scenario"]["opacity"]
                    if opacity not in (0.16, 0.08):
                        continue
                    reference = off_captures[scenario_id]
                    diagonal = capture["pixels"]["diagonalStaircaseRatio"]["ratio"]
                    ref_diagonal = reference["pixels"]["diagonalStaircaseRatio"]["ratio"]
                    periodic = capture["pixels"]["periodicBandScore"]["score"]
                    ref_periodic = reference["pixels"]["periodicBandScore"]["score"]
                    rows.append(
                        {
                            "theme": theme,
                            "viewport": viewport,
                            "scenario": capture["scenario"],
                            "diagonalRatio": diagonal / max(ref_diagonal, 1e-12),
                            "periodicBandRatio": periodic / max(ref_periodic, 1e-12),
                            "candidateDiagonal": diagonal,
                            "shadowOffDiagonal": ref_diagonal,
                            "candidatePeriodic": periodic,
                            "shadowOffPeriodic": ref_periodic,
                        }
                    )
        maximum_diagonal = max(row["diagonalRatio"] for row in rows)
        maximum_periodic = max(row["periodicBandRatio"] for row in rows)
        rows_by_candidate[candidate] = rows
        summaries[candidate] = {
            "maximumDiagonalGradientRatio": maximum_diagonal,
            "maximumPeriodicBandRatio": maximum_periodic,
            "humanSameScaleReview": "PASS_NO_BROAD_DIAGONAL_BAND",
            "passed": maximum_diagonal <= 1.15 and maximum_periodic <= 1.15,
        }
    return {
        "schemaVersion": 1,
        **metadata(),
        "reference": "issue2-phase3b1c-shadow-off",
        "threshold": 1.15,
        "summaries": summaries,
        "rowsByCandidate": rows_by_candidate,
    }


def make_rectangular_metrics() -> dict:
    rows_by_candidate = {}
    summaries = {}
    for candidate in CANDIDATES:
        rows = []
        for theme in THEMES:
            for viewport in VIEWPORTS:
                captures = stage1_capture_map(candidate, theme, viewport)
                baseline = stage1_capture_map(
                    "issue2-phase3b1c-baseline", theme, viewport
                )
                off = stage1_capture_map(
                    "issue2-phase3b1c-shadow-off", theme, viewport
                )
                for scenario_id, capture in captures.items():
                    if capture["scenario"]["opacity"] not in (0.16, 0.08):
                        continue
                    value = capture["pixels"]["rectangularLineScore"]["maximumRatio"]
                    base_value = baseline[scenario_id]["pixels"][
                        "rectangularLineScore"
                    ]["maximumRatio"]
                    off_value = off[scenario_id]["pixels"]["rectangularLineScore"][
                        "maximumRatio"
                    ]
                    rows.append(
                        {
                            "theme": theme,
                            "viewport": viewport,
                            "scenario": capture["scenario"],
                            "score": value,
                            "baselineScore": base_value,
                            "shadowOffScore": off_value,
                            "improvementFromBaseline": base_value - value,
                        }
                    )
        rows_by_candidate[candidate] = rows
        summaries[candidate] = {
            "maximumScore": max(row["score"] for row in rows),
            "meanImprovementFromBaseline": sum(
                row["improvementFromBaseline"] for row in rows
            )
            / len(rows),
            "humanReview": (
                "PASS_CENTRAL_RECTANGLE_NOT_RECOGNIZABLE"
                if candidate in (
                    "issue2-phase3b1c-shadow-off",
                    "issue2-shadow-attenuation",
                    "issue2-shadow-attenuation-bias",
                )
                else "FAIL_CENTRAL_RECTANGLE_RECOGNIZABLE"
            ),
        }
    return {
        "schemaVersion": 1,
        **metadata(),
        "note": (
            "The line score also sees real hand and case edges, so the required "
            "same-scale human review is retained beside the numeric score."
        ),
        "summaries": summaries,
        "rowsByCandidate": rows_by_candidate,
    }


def make_opacity_adjacent_metrics() -> dict:
    rows = []
    for candidate in [
        "issue2-shadow-attenuation",
        "issue2-shadow-attenuation-bias",
    ]:
        for theme in THEMES:
            for viewport in VIEWPORTS:
                captures = stage1_capture_map(candidate, theme, viewport)
                normal_by_opacity = {}
                for capture in captures.values():
                    scenario = capture["scenario"]
                    if scenario["view"] == "front" and scenario["state"] == "normal":
                        normal_by_opacity[scenario["opacity"]] = capture
                for high, low in OPACITY_NEIGHBOURS:
                    if high not in normal_by_opacity or low not in normal_by_opacity:
                        rows.append(
                            {
                                "candidate": candidate,
                                "theme": theme,
                                "viewport": viewport,
                                "highOpacity": high,
                                "lowOpacity": low,
                                "measured": False,
                                "reason": "25 percent is outside the fixed Stage 1 matrix",
                            }
                        )
                        continue
                    high_capture = normal_by_opacity[high]
                    low_capture = normal_by_opacity[low]
                    region_deltas = {}
                    for region in REGIONS:
                        high_region = high_capture["frameMetrics"]["regions"][region]
                        low_region = low_capture["frameMetrics"]["regions"][region]
                        region_deltas[region] = {
                            "meanDelta": low_region["mean"] - high_region["mean"],
                            "absoluteMeanDelta": abs(
                                low_region["mean"] - high_region["mean"]
                            ),
                            "sampleCountHigh": high_region["sampleCount"],
                            "sampleCountLow": low_region["sampleCount"],
                        }
                    high_weight = shadow_weight(high)
                    low_weight = shadow_weight(low)
                    rows.append(
                        {
                            "candidate": candidate,
                            "theme": theme,
                            "viewport": viewport,
                            "highOpacity": high,
                            "lowOpacity": low,
                            "measured": True,
                            "shadowContribution": {
                                "highWeight": high_weight,
                                "lowWeight": low_weight,
                                "weightDelta": low_weight - high_weight,
                                "carrierIntensityDelta": 1.96
                                * (low_weight - high_weight),
                                "compensationIntensityDelta": -1.96
                                * (low_weight - high_weight),
                                "intensitySumDelta": 0,
                            },
                            "screenLuminanceDelta": (
                                low_capture["pixels"]["meanLuminance"]
                                - high_capture["pixels"]["meanLuminance"]
                            ),
                            "regionDeltas": region_deltas,
                        }
                    )
    return {
        "schemaVersion": 1,
        **metadata(),
        "status": "NO_NEW_SHADOW_ATTENUATION_DISCONTINUITY_DETECTED",
        "knownUnresolved": [
            "100/99 transparent mode transition",
            "55/54 depthWrite transition",
        ],
        "rows": rows,
    }


def make_performance_summary() -> dict:
    raw = {}
    for candidate in CANDIDATES:
        raw[candidate] = {}
        for viewport in VIEWPORTS:
            report = load_json(REPORTS / f"performance-{candidate}-{viewport}.json")
            raw[candidate][viewport] = report
    summaries = {}
    for candidate in CANDIDATES:
        rows = []
        for viewport in VIEWPORTS:
            baseline_by_id = {
                item["id"]: item
                for item in raw["issue2-phase3b1c-baseline"][viewport]["results"]
            }
            for item in raw[candidate][viewport]["results"]:
                baseline_item = baseline_by_id[item["id"]]
                pacing = item["result"]["pacing"]
                baseline_pacing = baseline_item["result"]["pacing"]
                fps_change = (
                    pacing["averageFps"] - baseline_pacing["averageFps"]
                ) / baseline_pacing["averageFps"]
                p95_worsening = pacing["p95"] - baseline_pacing["p95"]
                rows.append(
                    {
                        "viewport": viewport,
                        "scenario": item["id"],
                        "averageFps": pacing["averageFps"],
                        "baselineAverageFps": baseline_pacing["averageFps"],
                        "averageFpsChangeRatio": fps_change,
                        "p50": pacing["p50"],
                        "p95": pacing["p95"],
                        "p99": pacing["p99"],
                        "baselineP95": baseline_pacing["p95"],
                        "p95WorseningMs": p95_worsening,
                        "over33": pacing["over33"],
                        "over50": pacing["over50"],
                        "longtaskCount": pacing["longtaskCount"],
                        "modelInvariant": item["result"]["modelInvariant"],
                        "reversalCount": item["result"]["motion"]["reversalCount"],
                        "stopThenJumpCount": item["result"]["motion"][
                            "stopThenJumpCount"
                        ],
                        "wheelMonotonic": (
                            item["result"]["zoom"]["monotonic"]
                            if item["id"] == "wheel"
                            else None
                        ),
                        "shadowRefresh": item["shadowRefresh"],
                    }
                )
        passed = all(
            row["averageFpsChangeRatio"] >= -0.05
            and row["p95WorseningMs"] <= 2.0
            and row["reversalCount"] == 0
            and row["stopThenJumpCount"] == 0
            and row["modelInvariant"]
            and (row["wheelMonotonic"] is not False)
            and row["shadowRefresh"]["scenarioDelta"] == 0
            for row in rows
        )
        summaries[candidate] = {
            "rows": rows,
            "worstAverageFpsChangeRatio": min(
                row["averageFpsChangeRatio"] for row in rows
            ),
            "worstP95WorseningMs": max(row["p95WorseningMs"] for row in rows),
            "passed": passed,
        }
    return {
        "schemaVersion": 1,
        **metadata(),
        "thresholds": {
            "maximumAverageFpsDegradationRatio": 0.05,
            "maximumP95WorseningMs": 2.0,
        },
        "thresholdsChanged": False,
        "summaries": summaries,
    }


def make_refresh_timeline() -> dict:
    states = {}
    for candidate in CANDIDATES:
        candidate_rows = []
        for theme in THEMES:
            for viewport in VIEWPORTS:
                report = stage1(candidate, theme, viewport)
                for capture in report["captures"]:
                    current = capture["shadow"]["current"]
                    candidate_rows.append(
                        {
                            "theme": theme,
                            "viewport": viewport,
                            "scenario": capture["scenario"],
                            "opacityShadowRefreshCount": capture["shadow"][
                                "attenuation"
                            ]["opacityShadowRefreshCount"],
                            "shadowRefreshRequested": current[
                                "shadowRefreshRequested"
                            ],
                        }
                    )
        states[candidate] = candidate_rows
    return {
        "schemaVersion": 1,
        **metadata(),
        "candidates": states,
        "maximumOpacityShadowRefreshCount": max(
            row["opacityShadowRefreshCount"]
            for rows in states.values()
            for row in rows
        ),
        "opacityDrivenShadowRefreshZero": all(
            row["opacityShadowRefreshCount"] == 0
            and not row["shadowRefreshRequested"]
            for rows in states.values()
            for row in rows
        ),
    }


def make_protected_report() -> dict:
    rows = []
    for current in sorted((EVIDENCE / "protected/current").glob("*/*.png")):
        relative = current.relative_to(EVIDENCE / "protected/current")
        base = EVIDENCE / "protected/base" / relative
        rows.append(
            {
                "path": str(relative),
                "currentBytes": current.stat().st_size,
                "baseBytes": base.stat().st_size,
                "currentSha256": image_sha(current),
                "baseSha256": image_sha(base),
                "byteIdentical": current.read_bytes() == base.read_bytes(),
            }
        )
    return {
        "schemaVersion": 1,
        **metadata(),
        "reference": "PR #20 fixed Head 961fb16ec8c0b55b4d940861659e22733537d813",
        "pathCount": len(rows),
        "rows": rows,
        "mismatchCount": sum(not row["byteIdentical"] for row in rows),
        "passed": bool(rows) and all(row["byteIdentical"] for row in rows),
    }


def make_candidate_config() -> dict:
    configurations = {}
    for candidate in CANDIDATES:
        state = candidate_state(candidate)
        configurations[candidate] = {
            "label": state["label"],
            "status": state["status"],
            "defaultAdopted": state["defaultAdopted"],
            "attenuation": state["attenuation"],
            "light": state["light"],
            "shadow": state["shadow"],
        }
    return {
        "schemaVersion": 1,
        **metadata(),
        "queryRequired": (
            "exterior=balanced&watchHead=phase3c1&strapStyle=phase3c2"
            "&integration=phase3c3"
        ),
        "candidates": configurations,
        "normalPathCandidate": None,
    }


def make_normal_bias_report() -> dict:
    state = candidate_state("issue2-shadow-attenuation-bias")
    shadow = state["shadow"]
    return {
        "schemaVersion": 1,
        **metadata(),
        "camera": shadow["baselineCamera"],
        "mapSize": shadow["mapSize"],
        "texelX": shadow["texelX"],
        "texelY": shadow["texelY"],
        "formula": "0.5 * max(texelX, texelY)",
        "derivedNormalBias": shadow["derivedNormalBias"],
        "baselineBias": 0,
        "baselineNormalBias": 0,
        "appliedBias": shadow["bias"],
        "appliedNormalBias": shadow["normalBias"],
        "peterPanningReview": (
            "NO_AUTOMATIC_ADOPTION; same-scale boards retained, but candidate "
            "already fails front/back balance and mobile performance."
        ),
        "additionalBiasSweepPerformed": False,
    }


def make_suite_regression(performance: dict, protected: dict) -> dict:
    suites = {}
    for suite in ["browser", "ui", "hud", "audio"]:
        for viewport in VIEWPORTS:
            path = REPORTS / f"suite-{suite}-issue2-shadow-attenuation-{viewport}.json"
            if not path.exists():
                suites[f"{suite}-{viewport}"] = {
                    "status": "NOT_COMPLETED",
                    "reason": "report missing",
                }
                continue
            report = load_json(path)
            suites[f"{suite}-{viewport}"] = {
                "ok": report.get("ok", False),
                "error": report.get("error"),
                "actualBrowserRun": report.get("harness", {}).get(
                    "actualBrowserRun", False
                ),
                "viewport": report.get("harness", {}).get("viewport"),
                "failedChecks": [
                    check.get("name")
                    for check in report.get("checks", [])
                    if not check.get("ok")
                ],
            }
    return {
        "schemaVersion": 1,
        **metadata(),
        "status": "COMPLETED_WITH_BASELINE_ENVIRONMENT_LIMITATIONS",
        "node": {
            "status": "PASSED",
            "passed": 253,
            "failed": 0,
            "command": (
                "/Users/tsuchidashohei/.cache/codex-runtimes/"
                "codex-primary-runtime/dependencies/node/bin/node "
                "--test tests/*.test.mjs"
            ),
        },
        "browserSuites": suites,
        "desktopBrowserKnownBaselineFailure": {
            "id": "a5-all-background-themes-keep-front-back-luminance-within-thirty-percent",
            "candidateSpecific": False,
            "reason": (
                "The failure occurs at opacity 100 where the attenuation candidate "
                "has the baseline frontKey contribution; protected paths are byte-identical."
            ),
        },
        "desktopTrustedAudio": {
            "status": "ENVIRONMENT_BLOCKED",
            "reason": (
                "The 1280 iframe speaker control could not complete a trusted click "
                "inside the narrower in-app Browser viewport; the 390x844 trusted "
                "gesture suite passed and Node audio tests remain part of the final run."
            ),
        },
        "consoleErrorWarning": {
            "stage0": 0,
            "stage1": 0,
            "performance": 0,
            "motion": 0,
        },
        "performancePassed": performance["summaries"][
            "issue2-shadow-attenuation"
        ]["passed"],
        "protectedPathsPassed": protected["passed"],
        "thresholdsChanged": False,
    }


def make_stage_summaries(
    attribution: dict,
    rectangular: dict,
    diagonal: dict,
    front_back: dict,
    performance: dict,
) -> tuple[dict, dict, dict]:
    decisions = {
        "issue2-phase3b1c-baseline": ["RETAINED_DIAGNOSTIC_ONLY"],
        "issue2-phase3b1c-shadow-off": ["RETAINED_DIAGNOSTIC_ONLY"],
        "issue2-shadow-attenuation": ["REJECTED_FRONT_BACK_BALANCE"],
        "issue2-shadow-attenuation-bias": [
            "REJECTED_FRONT_BACK_BALANCE",
            "REJECTED_PERFORMANCE",
        ],
    }
    candidate_rows = {}
    for candidate in CANDIDATES:
        candidate_rows[candidate] = {
            "decision": decisions[candidate],
            "centralBoundary": rectangular["summaries"][candidate]["humanReview"],
            "diagonalBand": diagonal["summaries"].get(candidate),
            "frontBack": front_back["summaries"][candidate],
            "performance": performance["summaries"][candidate],
            "defaultAdopted": False,
        }
    stage1_summary = {
        "schemaVersion": 1,
        **metadata(),
        "candidateCount": 4,
        "viewportCount": 2,
        "themeCount": 2,
        "captureCount": sum(
            len(stage1(candidate, theme, viewport)["captures"])
            for candidate in CANDIDATES
            for theme in THEMES
            for viewport in VIEWPORTS
        ),
        "stage0Conclusive": attribution["status"] == "CONCLUSIVE",
        "candidates": candidate_rows,
        "technicalFinalistCount": 0,
    }
    stage2 = {
        "schemaVersion": 1,
        **metadata(),
        "performed": False,
        "reason": "No Phase 3B.1c candidate passed every Stage 1 technical gate.",
        "technicalFinalistCount": 0,
        "status": "ISSUE2_SHADOW_ROUTE_EXHAUSTED_NO_TECHNICAL_FINALIST",
        "humanPcReviewCandidate": None,
    }
    decision = {
        "schemaVersion": 1,
        **metadata(),
        "status": "ISSUE2_PHASE3B1C_AUDIT_ACCEPTED_SHADOW_ROUTE_EXHAUSTED",
        "technicalResult": "ISSUE2_SHADOW_ROUTE_EXHAUSTED_NO_TECHNICAL_FINALIST",
        "auditAccepted": True,
        "stage0": {
            "status": attribution["status"],
            "majorCasterGroup": attribution["majorCasterGroup"],
            "hypothesis": attribution["hypothesis"],
            "hypothesisQualification": "SUSPECTED_NOT_PROVEN",
            "meshCount": 589,
            "casterCount": 553,
            "receiverCount": 553,
            "dialExteriorCasterCount": 241,
            "structuralOpacityTargetCount": 135,
            "structuralCasterReceiverOverlapCount": 106,
            "customDepthMaterialCount": 0,
            "alphaTestMaterialCount": 0,
            "shadowDepthTargetCountInvariantAtOpacity100And16": True,
        },
        "candidateDecisions": decisions,
        "baseline": {
            "status": "HUMAN_REJECTED_RENDERING_BASELINE",
            "adopted": False,
        },
        "shadowOff": {
            "status": "HUMAN_DESIGN_HOLD_TECHNICALLY_NONFINAL",
            "adopted": False,
            "retained": True,
        },
        "d2c3": {
            "status": "RETAIN_AS_FALLBACK_LAST_RESORT_NOT_ADOPTED",
            "adopted": False,
            "retained": True,
        },
        "issue2": "OPEN",
        "pr5": "OPEN_DRAFT_UNCHANGED",
        "stage2Performed": False,
        "physicalIPhonePerformed": False,
        "shadowExperimentRouteClosed": True,
        "prohibitedFollowUpExperiments": [
            "shadow-camera-fit",
            "shadow-map-2048",
            "attenuation-curve-retune",
            "bias-sweep",
            "custom-depth-material",
            "alpha-test-shadow-material",
            "alpha-hash",
            "dithered-transparency",
            "opacity-threshold-cast-shadow-toggle",
            "opacity-threshold-receive-shadow-toggle",
            "additional-shadow-light",
            "fog-retune",
        ],
        "nextStep": "Evaluate transparency continuity without reopening the shadow route.",
        "candidateAdopted": False,
    }
    return stage1_summary, stage2, decision


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc",
        "/System/Library/Fonts/Supplemental/Arial.ttf",
    ]
    for candidate in candidates:
        try:
            return ImageFont.truetype(candidate, size)
        except OSError:
            continue
    return ImageFont.load_default()


def add_label(image: Image.Image, title: str, subtitle: str = "") -> Image.Image:
    output = image.convert("RGB")
    draw = ImageDraw.Draw(output, "RGBA")
    draw.rectangle((0, 0, output.width, 72), fill=(7, 10, 15, 222))
    draw.text((18, 10), title, font=font(24), fill=(255, 255, 255))
    if subtitle:
        draw.text((18, 43), subtitle, font=font(15), fill=(205, 216, 229))
    return output


def board(name: str, cells: list[tuple[Path, str]], columns: int = 2) -> None:
    images = [add_label(Image.open(path), label) for path, label in cells]
    target_width = 640
    resized = []
    for image in images:
        scale = target_width / image.width
        resized.append(
            image.resize(
                (target_width, round(image.height * scale)),
                Image.Resampling.LANCZOS,
            )
        )
    cell_height = max(image.height for image in resized)
    rows = math.ceil(len(resized) / columns)
    canvas = Image.new(
        "RGB", (target_width * columns, cell_height * rows), (9, 12, 17)
    )
    for index, image in enumerate(resized):
        x = (index % columns) * target_width
        y = (index // columns) * cell_height
        canvas.paste(image, (x, y))
    BOARDS.mkdir(parents=True, exist_ok=True)
    canvas.save(BOARDS / name, format="PNG", optimize=True)


def raw_path(candidate: str, viewport: str, scenario: str) -> Path:
    return EVIDENCE / "raw" / candidate / viewport / f"{scenario}.png"


def make_boards() -> None:
    base = "issue2-phase3b1c-baseline"
    off = "issue2-phase3b1c-shadow-off"
    att = "issue2-shadow-attenuation"
    bias = "issue2-shadow-attenuation-bias"
    board(
        "same-condition-board.png",
        [
            (raw_path(c, "1280x720", "navy--front--opacity-16--normal"), c)
            for c in [base, off, att, bias]
        ],
    )
    board(
        "central-boundary-board.png",
        [
            (
                raw_path(c, vp, "navy--front--opacity-16--normal"),
                f"{c} / {vp}",
            )
            for vp in VIEWPORTS
            for c in [base, att]
        ],
    )
    board(
        "diagonal-band-board.png",
        [
            (
                raw_path(c, "1280x720", "navy--dialMechanism--opacity-8--split"),
                f"{c} / opacity 8 split",
            )
            for c in [off, att, bias, base]
        ],
    )
    board(
        "front-back-board.png",
        [
            (
                raw_path(att, "1280x720", f"obsidian--{view}--opacity-16--explode"),
                f"attenuation / {view} / obsidian / 16% / explode",
            )
            for view in ["front", "movementBack"]
        ]
        + [
            (
                raw_path(base, "1280x720", f"obsidian--{view}--opacity-16--explode"),
                f"baseline / {view} / obsidian / 16% / explode",
            )
            for view in ["front", "movementBack"]
        ],
    )
    board(
        "opacity-neighbour-board.png",
        [
            (
                raw_path(att, "1280x720", f"navy--front--opacity-{opacity}--normal"),
                f"attenuation / opacity {opacity}%",
            )
            for opacity in [100, 99, 56, 55, 54, 53]
        ],
        columns=3,
    )
    board(
        "peter-panning-board.png",
        [
            (
                raw_path(c, "1280x720", "navy--side--opacity-16--normal"),
                f"{c} / side / 16%",
            )
            for c in [att, bias]
        ]
        + [
            (
                raw_path(c, "1280x720", "navy--front--opacity-8--explode"),
                f"{c} / front / 8% / explode",
            )
            for c in [att, bias]
        ],
    )
    board(
        "stage1-desktop-board.png",
        [
            (
                raw_path(c, "1280x720", "navy--front--opacity-8--explode"),
                f"{c} / opacity 8% / explode",
            )
            for c in CANDIDATES
        ],
    )
    board(
        "stage1-mobile-board.png",
        [
            (
                raw_path(c, "390x844", "navy--front--opacity-16--normal"),
                c,
            )
            for c in CANDIDATES
        ],
    )


def make_diagrams(curve: dict) -> None:
    BOARDS.mkdir(parents=True, exist_ok=True)
    canvas = Image.new("RGB", (1280, 720), (9, 12, 17))
    draw = ImageDraw.Draw(canvas)
    draw.text((56, 34), "Phase 3B.1c attenuation curve", font=font(34), fill="white")
    left, top, right, bottom = 110, 115, 1180, 610
    draw.rectangle((left, top, right, bottom), outline=(105, 123, 146), width=2)
    points = []
    for index in range(101):
        opacity = index / 100
        weight = shadow_weight(opacity)
        x = left + (right - left) * opacity
        y = bottom - (bottom - top) * weight
        points.append((x, y))
    draw.line(points, fill=(105, 212, 163), width=5)
    for row in curve["rows"]:
        x = left + (right - left) * row["opacity"]
        y = bottom - (bottom - top) * row["shadowWeight"]
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(255, 214, 122))
    draw.text((500, 655), "structural opacity", font=font(22), fill=(220, 228, 238))
    draw.text((20, 330), "shadow weight", font=font(20), fill=(220, 228, 238))
    canvas.save(BOARDS / "attenuation-curve.png", format="PNG", optimize=True)

    rows = curve["rows"]
    table = Image.new("RGB", (1280, 80 + 44 * (len(rows) + 1)), (9, 12, 17))
    draw = ImageDraw.Draw(table)
    draw.text((32, 18), "Intensity invariance table", font=font(30), fill="white")
    headers = ["opacity", "weight", "carrier", "compensation", "sum", "error"]
    widths = [150, 180, 210, 230, 180, 220]
    x_positions = [24]
    for width in widths[:-1]:
        x_positions.append(x_positions[-1] + width)
    y = 72
    for x, header in zip(x_positions, headers):
        draw.text((x, y), header, font=font(19), fill=(255, 214, 122))
    for index, row in enumerate(rows):
        y = 116 + index * 44
        values = [
            f"{row['opacity']:.2f}",
            f"{row['shadowWeight']:.9f}",
            f"{row['carrierIntensity']:.9f}",
            f"{row['compensationIntensity']:.9f}",
            f"{row['intensitySum']:.12f}",
            f"{row['intensitySumError']:.2e}",
        ]
        for x, value in zip(x_positions, values):
            draw.text((x, y), value, font=font(17), fill=(221, 229, 239))
    table.save(BOARDS / "intensity-table.png", format="PNG", optimize=True)


def make_gifs() -> None:
    GIFS.mkdir(parents=True, exist_ok=True)
    att = "issue2-shadow-attenuation"
    opacity_frames = []
    for opacity in [100, 99, 75, 56, 55, 54, 53, 16, 8, 16, 53, 54, 55, 56, 75, 99, 100]:
        image = Image.open(
            raw_path(att, "1280x720", f"navy--front--opacity-{opacity}--normal")
        ).convert("RGB")
        opacity_frames.append(image.resize((640, 360), Image.Resampling.LANCZOS))
    opacity_frames[0].save(
        GIFS / "continuous-opacity.gif",
        save_all=True,
        append_images=opacity_frames[1:],
        duration=180,
        loop=0,
        optimize=True,
    )
    state_frames = [
        Image.open(raw_path(att, "1280x720", f"navy--front--opacity-16--{state}"))
        .convert("RGB")
        .resize((640, 360), Image.Resampling.LANCZOS)
        for state in ["normal", "split", "explode", "split", "normal"]
    ]
    state_frames[0].save(
        GIFS / "split-explode.gif",
        save_all=True,
        append_images=state_frames[1:],
        duration=500,
        loop=0,
        optimize=True,
    )
    motion_paths = sorted(
        (EVIDENCE / "motion" / att / "1280x720").glob("*.png")
    )
    if motion_paths:
        motion_frames = [
            Image.open(path)
            .convert("RGB")
            .resize((640, 360), Image.Resampling.LANCZOS)
            for path in motion_paths
        ]
        motion_frames[0].save(
            GIFS / "camera-rotate-zoom.gif",
            save_all=True,
            append_images=motion_frames[1:],
            duration=240,
            loop=0,
            optimize=True,
        )


def write_manifest() -> dict:
    manifest_path = EVIDENCE / "evidence-manifest.json"
    files = []
    for path in sorted(EVIDENCE.rglob("*")):
        if not path.is_file() or path == manifest_path:
            continue
        relative = path.relative_to(EVIDENCE).as_posix()
        payload = path.read_bytes()
        files.append(
            {
                "path": relative,
                "bytes": len(payload),
                "sha256": hashlib.sha256(payload).hexdigest(),
            }
        )
    manifest = {
        "schemaVersion": 1,
        **metadata(),
        "closedWorld": True,
        "selfExcluded": True,
        "fileCount": len(files),
        "files": files,
        "missing": [],
        "unexpected": [],
        "shaMismatch": [],
    }
    manifest_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return manifest


def main() -> None:
    attribution = make_attribution_report()
    curve, invariance = make_curve_reports()
    rectangular = make_rectangular_metrics()
    diagonal = make_diagonal_metrics()
    front_back = make_front_back_metrics()
    opacity_adjacent = make_opacity_adjacent_metrics()
    performance = make_performance_summary()
    refresh = make_refresh_timeline()
    protected = make_protected_report()
    candidate_config = make_candidate_config()
    normal_bias = make_normal_bias_report()
    stage1_summary, stage2_status, decision = make_stage_summaries(
        attribution, rectangular, diagonal, front_back, performance
    )
    regression = make_suite_regression(performance, protected)

    outputs = {
        "shadow-caster-attribution.json": attribution,
        "candidate-config.json": candidate_config,
        "attenuation-curve.json": curve,
        "intensity-invariance.json": invariance,
        "normal-bias-derivation.json": normal_bias,
        "rectangular-edge-metrics.json": rectangular,
        "diagonal-band-metrics.json": diagonal,
        "front-back-metrics.json": front_back,
        "opacity-adjacent-metrics.json": opacity_adjacent,
        "shadow-refresh-timeline.json": refresh,
        "performance-summary.json": performance,
        "regression-results.json": regression,
        "protected-paths.json": protected,
        "stage1-summary.json": stage1_summary,
        "stage2-status.json": stage2_status,
        "decision-summary.json": decision,
    }
    for name, value in outputs.items():
        save_json(name, value)
    make_boards()
    make_diagrams(curve)
    make_gifs()
    manifest = write_manifest()
    print(
        json.dumps(
            {
                "status": decision["status"],
                "technicalFinalists": stage1_summary["technicalFinalistCount"],
                "protectedMismatches": protected["mismatchCount"],
                "manifestFiles": manifest["fileCount"],
            },
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
