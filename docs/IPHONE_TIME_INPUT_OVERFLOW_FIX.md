# Physical-iPhone time input right-edge overflow fix

## Conclusion

The physical-iPhone right-edge clipping reported for the native time input is addressed by a small, mobile-only sizing correction. The native `type="time"` picker, time parsing, hand coupling, crown time-setting flow, UI structure, rendering, mechanism, and audio behavior are unchanged.

The implementation remains a Draft candidate. Desktop automation cannot reproduce the physical-iPhone native subcontrol clipping, and two unrelated Node assertions inherited from the exact main base are still failing. For that reason this report does not claim full-suite completion and does not provide a physical-iPhone confirmation URL.

## Baseline and implementation

- Base main commit: `155275d0aaeb968fd83d6dfe15313e259f2bb064`
- Implementation commit: `aca123f9dc3fd2d5bf0f9365beb56347cb1042cb`
- Candidate branch: `fix/iphone-time-input-overflow`
- APP_VERSION: `v3.15.0` (unchanged)
- Classification: `IOS_TIME_INPUT_INTRINSIC_MIN_WIDTH`
- Detailed classification: `IOS_NATIVE_TIME_INPUT_FOCUS_PRESENTATION`

## Cause

Physical-iPhone review observed clipping or overflow at the right edge of the native time value. The baseline mobile control used a computed font near 13.333px and a 39px native height, while the WebKit value subcontrol had no explicit shrink guard.

Installed Chrome, Playwright WebKit, and macOS Native Safari kept the outer input rectangle inside the grid and viewport before the fix. Therefore the desktop automation did **not** reproduce the exact physical-iPhone symptom. The conclusion is bounded to the observed physical-device defect and the confirmed native-control sizing conditions; it does not claim that the macOS Safari outer box overflowed.

## Implementation

- Bound `.timeGrid` and `#timeInput` to the available logical inline size.
- Set `min-inline-size: 0`, `max-inline-size: 100%`, and `box-sizing: border-box` on the native input.
- Allow `::-webkit-date-and-time-value` to shrink within the native border box.
- On viewports below 900px, use a 16px input font and a 44px minimum control height.
- Preserve `appearance: auto`; the native picker is not replaced, clipped, scaled, or JavaScript-sized.
- Add read-only layout diagnostics for the input, grid, panel, safe-area offsets, visual viewport, and horizontal overflow.

## Automated results

| Area | Result |
|---|---|
| Installed Chrome layout, 5 widths × 2 routes | 10/10 |
| Playwright WebKit layout, 5 widths × 2 routes | 10/10 |
| Native Safari required widths 375/390/393/430 × 2 routes | 8/8 |
| Native Safari requested 320px | Environment-limited: macOS Safari enforced 336px; layout contract passed at actual width |
| Desktop UI / Mobile UI / Mobile HUD | Passed in Installed Chrome and Playwright WebKit |
| Time input, current-time button, Live Sync, crown position 2 and hand coupling | Passed on default and legacy routes in Installed Chrome, Playwright WebKit, and Native Safari |
| Console error / warning / runtime error / unhandled rejection | 0 / 0 / 0 / 0 |
| Desktop protected path | Pixel exact; before/after SHA-256 `b7e0f8582950d8769a5d15f4b0565ce2dfcb227592993a80b165ca92700504f0` |
| Targeted time-input and evidence tests | 8/8 |
| Full Node suite | 471/473 passed, 2 inherited main failures, 0 candidate-specific failures |

The inherited browser-harness failures have identical IDs on the fixed main baseline and this candidate: three A.5 lighting-contract assertions and two A.6 absolute performance assertions. There are no candidate-specific browser failure IDs.

The inherited Node failures concern final-completion/default-adoption documentation state. They are outside this independent UI fix and are aligned in Draft PR #28; this branch does not copy those unrelated changes.

## Decision

Automated layout and time-input behavior pass for the candidate, but the requested all-gates condition is not satisfied because of the two inherited main Node failures. The status is:

`LAYOUT_AND_TIME_INPUT_AUTOMATION_PASSED_WITH_INHERITED_MAIN_NODE_BLOCKER`

A physical-iPhone recheck remains required. No fixed-commit Human review URL is issued from this result, and the Draft PR must not be marked Ready or merged on the basis of this report alone.
