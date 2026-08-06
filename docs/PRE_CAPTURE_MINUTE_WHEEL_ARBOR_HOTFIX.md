# Pre-capture minute-wheel arbor hotfix

## Conclusion

The completed-watch default route exposed the front end of the minute-wheel arbor through the Phase 3C.1 physical dial. The hotfix limits only that arbor's front end to 0.030 model unit behind the dial rear surface. This is a pre-capture local geometry hotfix, not broad geometry cleanup.

## Root cause

- Runtime object: `ミニッツホイール・軸・ほぞ`
- Source: `index.html`
- Classification: `ACTUAL_GEOMETRY_INTERSECTION_FROM_GENERIC_SYMMETRIC_ARBOR`
- Generic arbor front: Y = -2.394
- Physical dial: Y = -2.020 to -1.820
- Dial intersection depth: 0.200 model unit
- Visible front protrusion: 0.374 model unit

The minute wheel used the same symmetric `arborAssembly(2.10, ...)` as ordinary wheels. Its front pivot therefore crossed the full physical dial layer in the completed-watch composition. The issue was neither a camera artifact nor a visibility flag error.

## Local correction

For `watchHead=phase3c1` only, the minute-wheel arbor front end is limited to Y = -1.790, giving 0.030 model unit clearance behind the dial rear surface. The generic symmetric construction remains unchanged for legacy and other wheel arbors.

The hotfix does not change the minute-wheel centre, wheel or pinion working planes, tooth counts, gear ratios, hand centres, dial geometry, camera, rendering, transparency, lighting, audio, UI, or `APP_VERSION`.

## Verification

- Node: 520/520 passed; fail/skip/todo 0/0/0.
- Completed-watch runtime diagnostic: intersection 0.000; rear clearance 0.030.
- Desktop and 390x844 smoke: startup, hands, dial, part selection, HUD, learning-tab synchronization, time display, and background deselection passed.
- Console error/warning: 0/0 in the focused desktop and mobile smoke.
- Legacy route: byte-exact screenshots against the starting main Head at both 1280x720 and 390x844.
- Completed-watch image change is confined to the central arbor area: desktop 16x16 bounding box and mobile 16x8 bounding box.

The broader historical browser harness run on the hotfix branch reported five lighting-contract and in-app performance-environment failures. This evidence does not establish that those failures are pre-existing or caused by the hotfix, so they remain out of scope and are not reclassified as PASS. The focused smoke and legacy pixel-parity checks are the browser acceptance evidence for this local correction.

An independent read-only review found no critical, major, or minor implementation defect. It corrected the desktop changed-pixel count to 217 and required the broader-harness provenance wording above before approving Draft PR publication pending Human visual review.

## Human review

Before Ready or merge, compare the fixed-commit default route at desktop and physical iPhone size, concentrating on the hand stack and minute-wheel position near the dial centre. Confirm that the former protrusion is absent and that the dial, hands, selection, HUD, and time display remain natural.
