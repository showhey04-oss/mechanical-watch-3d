# Home Screen Icon

## Purpose

Register the Human-selected Mechanical Watch 3D icon for iPhone Home Screen use without changing the application implementation.

## Files

- `apple-touch-icon.png`
- `apple-touch-icon-180x180.png`

Both files are 180×180 PNG images and contain the same approved artwork. They are placed in the published document root, and `index.html` explicitly references `./apple-touch-icon.png` with a relative `apple-touch-icon` link. This resolves from both the GitHub Pages project path and a fixed-commit URL without relying only on Safari's document-root discovery.

## Scope

- APP_VERSION remains `v3.15.0`.
- No Geometry, mechanism, rendering, camera, UI behavior, audio, query route, manifest, service worker, offline support, or PWA behavior is changed.
- No Web App Manifest or Service Worker is added; this change does not convert the application into a PWA.
- Existing `prototype/final` and `prototype/public-final` tags remain unchanged.

## Verification

After publication on GitHub Pages, remove the previously added Home Screen item on iPhone, open the public URL in Safari, and add it to the Home Screen again. Existing Home Screen icons may remain cached until they are removed and re-added.
