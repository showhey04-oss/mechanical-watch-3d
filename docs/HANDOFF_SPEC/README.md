# Mechanical Watch 3D successor handoff specification

This directory is the machine-readable v3.15.0 prototype contract extracted from main source `eb4595e040786e0e2115165d36a9cc39e08b2038`. It is a rebuild input, not manufacturing CAD and not authorization to copy historical implementation defects.

## Regeneration

1. Run the complete Node suite with JUnit output: `node --test --test-reporter=junit tests/*.test.mjs > /tmp/prototype-freeze-tests.xml`.
2. Run `node tools/freeze/build-query-index.mjs`.
3. Capture the scene and performance evidence with the read-only HTTP tooling documented in the evidence README files.
4. Run `node tools/freeze/extract-handoff-spec.mjs --junit /tmp/prototype-freeze-tests.xml`.
5. Run `node --test tests/*.test.mjs`.

## Derivation contracts

- Gear pitch diameter: `module × teeth`.
- External gear center distance: `(pitchDiameterA + pitchDiameterB) / 2`.
- Axial placement is Y; dial/front is negative Y.
- Phase offsets, rotation sign, axial mesh bands, and educational tooth-shape corrections are distinct from pitch geometry.
- Runtime scene and performance evidence is environment-qualified and does not replace physical-device evidence.

The handoff manifest excludes itself to avoid recursive hashing. No tag is created by this package; `prototype/final` remains `PENDING_PR30_MERGE`.
