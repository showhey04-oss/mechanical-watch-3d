# Prototype freeze known-defect evidence

- source main: `eb4595e040786e0e2115165d36a9cc39e08b2038`
- app: `v3.15.0`
- capture: Installed Chrome + transient HTTP response instrumentation
- tracked product source changes: 0
- floating-object classification: `IDENTIFIED_PRODUCT_OBJECT`

`scene-outlier-inventory.json` contains the full visible default scene (729 Object3D records), the full legacy scene (553 records), world bounds, material/render attributes, source references and the runtime scenario matrix.

The audit does not start from product Object names. It filters the complete visible scene for exterior ownership, at least 50 model-unit distance from movement bounds, silver-material luminance at least 0.75, longitudinal Y extent at least 8, and exclusion of proxy/diagnostic/helper flags. Exactly two candidates remain; their runtime names resolve to `Phase 3C.2 尾錠枠` and `Phase 3C.2 つく棒`. Exterior OFF hides both; legacy contains neither.

Visual ownership is independently corroborated by the preserved Phase 3C.2 runtime [buckle detail](../final-exterior-design-phase3c2/images/buckle-detail.png), [silver hardware close-up](../final-exterior-design-phase3c2/images/hardware-silver-closeup.png), and [buckle frame/tang/bar rotation](../final-exterior-design-phase3c2/videos/05-buckle-frame-tang-bar.gif). Their SHA-256 records are embedded in the scene report. Together with the 2/0 default/legacy scene filter, these establish legitimate buckle assembly ownership without a name allowlist. The current prototype fix is **not performed**.
