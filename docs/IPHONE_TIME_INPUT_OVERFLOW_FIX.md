# Physical-iPhone time input right-edge overflow fix

## Conclusion

PR #29 R1 passed desktop layout automation but failed physical-iPhone review. R1 fixed the value-text clipping while the native Safari visual frame still painted through the right panel inset. The R2 candidate therefore makes a bounded ordinary HTML wrapper, `.timeInputShell`, the visible control frame and keeps the native `type="time"` element as the picker and focus target.

R2 automated layout, visual, functional, accessibility, and evidence gates pass. The status is `PR29_R2_AUTOMATED_GATES_PASSED_PENDING_PHYSICAL_IPHONE_REVIEW`; it is not a Human acceptance or completion decision. PR #29 remains Draft.

## Baseline and implementation

- Base main commit: `155275d0aaeb968fd83d6dfe15313e259f2bb064`
- R1 start Head: `6e2be3b5714ae329309c581a07d351b6ebaaf621`
- R2 implementation commit: `e6f65ecdd67bde5b66d95587b2f195268e0171d8`
- Candidate branch: `fix/iphone-time-input-overflow`
- APP_VERSION: `v3.15.0` (unchanged)
- Confirmed visual classification: `IOS_NATIVE_TIME_INPUT_VISUAL_FRAME_OVERFLOW`
- Diagnostic boundary: `NATIVE_CONTROL_PAINT_EXTENT_NOT_CAPTURED_BY_DOM_RECT`

## R1 physical-iPhone result

The Human result is preserved as a failure and is not overwritten by R2 automation.

| Check | iPhone 16 / iOS 26.5.2 / Safari portrait |
|---|---|
| Outer frame inside viewport | NG |
| Value text visible | OK |
| Native picker | OK |
| After-picker value text | OK |
| After-picker outer frame | NG |
| Specified time applied | OK |
| Current time and no horizontal scroll | OK |
| Overall | FAIL |

Formal classifications:

- `PR29_R1_PHYSICAL_IPHONE_REVIEW_FAILED`
- `PR29_R1_TEXT_CLIPPING_RESOLVED`
- `PR29_R1_NATIVE_VISUAL_FRAME_OVERFLOW_REMAINS`
- `PR29_R1_DOM_RECT_GATE_FALSE_NEGATIVE`
- `BODY_COMPLETION_BLOCKER_REMAINS`
- `PR29_R2_REQUIRED`

## Cause

R1 bounded the input DOM rectangle and WebKit value subcontrol. Installed Chrome, Playwright WebKit, and macOS Native Safari all reported the input rectangle inside the grid, panel body, and viewport. The physical iPhone nevertheless showed the native border/background extending to the right screen edge while the text remained readable. The DOM rectangle was therefore not a reliable proxy for the native control's painted frame.

The exact WebKit internals are not asserted. The confirmed product-facing cause is that the native control remained the visual-frame owner even though its DOM layout rectangle passed.

## R2 implementation

```html
<div class="timeInputShell full">
  <input id="timeInput" type="time" step="1" value="10:08:30" aria-label="表示時刻">
</div>
```

- Move `.full` from the native input to `.timeInputShell`.
- Let the shell own the border, background, radius, focus outline, and `overflow: hidden` paint boundary.
- Keep the native input at `inline-size: 100%`, with zero border, zero radius, and transparent background.
- Preserve `appearance: auto`, `-webkit-appearance: auto`, `type="time"`, step seconds, pointer/focus/keyboard behavior, and the native picker.
- Keep the mobile 16px font and 44px native input height.
- Keep the value subcontrol shrink guard.
- Extend `getTimeInputLayoutReport()` with the shell rectangle/styles, symmetric insets, shell overflow, input containment, and `visualFrameOwner: "timeInputShell"`.

No right-side subtraction, negative margin, transform scaling, viewport-specific width, JavaScript sizing, custom picker, panel padding change, or safe-area change is used.

## Automated results

| Area | Result |
|---|---|
| Installed Chrome shell layout, 7 viewports × 2 routes | 14/14 |
| Playwright WebKit shell layout, 7 viewports × 2 routes | 14/14 |
| Native Safari shell layout, 7 requested viewports × 2 routes | 14/14 |
| Maximum measured shell inset difference | 0px (limit 1px) |
| Shell/document horizontal overflow | 0 / 0 |
| Chrome UI, HUD, specified time, current time, Live Sync, crown position 2 | Passed |
| WebKit UI, HUD, specified time, current time, Live Sync, crown position 2 | Passed |
| Native Safari default/legacy time flows and trusted `type="time"` click | 2/2 |
| Native Safari/Chrome visual frame capture | Left/right border and radius visible; time text visible; action-button edges aligned |
| Console error / warning / runtime error / unhandled rejection | 0 / 0 / 0 / 0 |
| PR #29-specific Node tests | 9/9; failures/skips 0/0 |
| Full branch Node suite | 472/474; 2 exact-main inherited documentation failures |
| PR #28 Head Node suite | 465/465 |
| Candidate-specific browser failure IDs | 0 |
| Manifest | missing / unexpected / SHA mismatch = 0 / 0 / 0 |
| Independent review | Critical / Major / Minor = 0 / 0 / 0 |

macOS Safari enforces an actual 336px inner width when 320px is requested. The R2 shell passed both that environment-limited 336px result and the explicit 336px scenario. macOS Native Safari captures are not treated as physical-iPhone acceptance.

The browser integration harness still reports the same inherited A.5 lighting-contract and A.6 absolute-performance IDs on both exact main and R2. Candidate-specific browser failures are zero. Thresholds were not changed.

## Protected behavior

Time parsing, specified-time application, current-time application, Live Sync, crown position 2, stopped seconds, hand coupling, panel tabs, bottom-sheet behavior, HUD, keyboard semantics, Geometry, mechanism, rendering, camera, audio, APP_VERSION, and test thresholds are unchanged.

## Decision and Human gate

R2 automation permits a fixed-commit physical-iPhone review URL after the evidence commit is pushed, but does not claim acceptance. The required Human checks are both borders, both radii, approximately symmetric side margins, readable value text, native picker, after-picker frame/text, specified-time application, current-time application, and no horizontal scroll.

Until that review passes, `BODY_COMPLETION_BLOCKER_REMAINS`; PR #29 must stay Draft and unmerged.
