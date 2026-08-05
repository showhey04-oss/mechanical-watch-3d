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

## Human acceptance

Human accepted reviewed Head `ba4ff5d4c44405ded14a7301b0e96dad8e0d068e` on iPhone 16 with iOS 26.5.2 Safari. The Home Screen preview and installed icon displayed the approved artwork without a white border or composition clipping, remained legible at the Home Screen size, launched the application normally, and introduced no observed display or interaction regression.

The machine-readable acceptance record is stored in `docs/evidence/home-screen-icon/human-review.json`. This acceptance authorizes PR #32 Ready conversion and merge, but does not authorize tag creation or a GitHub Release.
