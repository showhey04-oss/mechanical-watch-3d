# Pre-capture minute-wheel arbor hotfix evidence

This directory records the single visible minute-wheel arbor / dial interference fixed before final video and screenshot capture. It is a pre-capture local geometry hotfix, not broad geometry cleanup.

## Provenance

- Repository: `showhey04-oss/mechanical-watch-3d`
- Source base commit: `f22526d600279e6368a73f5673b98938d18b25c1`
- Implementation commit: `e417811994b032440dc73db8e899699492215c31`
- Branch: `codex/pre-capture-minute-wheel-arbor-hotfix`
- App version: `v3.15.0`
- Fixed state: 10:10:30, paused, panel collapsed, reset camera

## Captures

All four captures are actual browser-rendered model images. The before captures came from a detached worktree at the source base commit; the after captures came from the implementation working tree. JPEG browser outputs were losslessly decoded and saved as true PNG files without synthesizing or retouching the scene.

- `captures/before-default-desktop.png`: source base, 1280x720.
- `captures/after-default-desktop.png`: hotfix, 1280x720.
- `captures/before-default-mobile-390.png`: source base, 390x844.
- `captures/after-default-mobile-390.png`: hotfix, 390x844.

The completed-watch difference is local to the central arbor: 16x16 pixels at desktop and 16x8 pixels at mobile. Legacy before/after screenshots were byte exact and therefore are recorded as hashes in `reports/regression-summary.json`, rather than duplicated here.

## Reports

- `reports/hotfix-summary.json`: object identity, measured cause, and corrected clearance.
- `reports/regression-summary.json`: Node, runtime, browser smoke, pixel locality, and legacy parity.
- `reports/independent-review.json`: read-only independent review disposition.
- `human-review.json`: Human acceptance of the rendered result at product Head `07f47533920fcfb57ef8760c7bd6443a96eeaeb0`.
- `evidence-manifest.json`: closed-world byte and SHA-256 inventory; the manifest excludes itself.

## Human acceptance

Human confirmed that the minute-wheel arbor no longer protrudes through the dial and that the dial surface, hour and minute hands, small seconds, open-heart area, and overall initial screen have no visible regression. Overall decision: `PASS`. The record authorizes Ready and merge only; tag, Release, and branch deletion remain unauthorized.
