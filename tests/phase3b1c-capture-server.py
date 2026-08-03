#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_PREFIX = Path(
    "docs/evidence/issue2-final-polish-phase3b1c-shadow-attenuation"
)


class Handler(SimpleHTTPRequestHandler):
    def do_POST(self):
        if urlparse(self.path).path != "/__phase3b1c_upload":
            self.send_error(404)
            return
        requested = unquote(self.headers.get("X-Evidence-Path", ""))
        relative = Path(requested)
        if (
            relative.is_absolute()
            or ".." in relative.parts
            or relative.parts[: len(EVIDENCE_PREFIX.parts)]
            != EVIDENCE_PREFIX.parts
        ):
            self.send_error(400, "invalid evidence path")
            return
        length = int(self.headers.get("Content-Length", "0"))
        payload = self.rfile.read(length)
        destination = ROOT / relative
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(destination.suffix + ".tmp")
        temporary.write_bytes(payload)
        temporary.replace(destination)
        response = json.dumps({
            "path": relative.as_posix(),
            "bytes": len(payload),
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--port", type=int, default=8000)
    arguments = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", arguments.port), Handler)
    print(
        "Phase 3B.1c capture server: "
        f"http://127.0.0.1:{arguments.port}"
    )
    server.serve_forever()
