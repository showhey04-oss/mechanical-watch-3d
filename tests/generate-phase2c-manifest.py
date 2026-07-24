from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE = ROOT / "docs/evidence/movement-dial-y-stack-phase2c"
MANIFEST = EVIDENCE / "evidence-manifest.json"


def main() -> None:
    files = sorted(path for path in EVIDENCE.rglob("*") if path.is_file() and path != MANIFEST)
    entries = []
    for path in files:
        data = path.read_bytes()
        entries.append(
            {
                "path": path.relative_to(EVIDENCE).as_posix(),
                "bytes": len(data),
                "sha256": hashlib.sha256(data).hexdigest(),
            }
        )
    manifest = {
        "schemaVersion": 1,
        "sourceBaseCommit": "81752950b2b8f9501399576f64faad238b1e4f13",
        "sourceAuditCommit": "da473d7d569f1b43b9d6adc04087a0a8011e9951",
        "captureImplementationCommit": "c8d59606810026a69ddef1a9a7c4e68bd379cf51",
        "sourceBranch": "audit/y-layer-stack-phase2c",
        "appVersion": "v3.15.0",
        "captureMode": "same-origin unsandboxed iframe harness - actual Three.js scene rendered to offscreen WebGLRenderTarget",
        "files": entries,
        "missing": [],
        "unexpected": [],
        "shaMismatch": [],
    }
    MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")


if __name__ == "__main__":
    main()
