# Physical-iPhone time input overflow fix

## Conclusion

PR #29 keeps the native `type="time"` control as the picker, focus target, and accessibility source. R1 fixed text clipping but failed the physical-iPhone outer-frame review. R2 moved the visible frame to `.timeInputShell` and passed the physical iPhone review. R3 added a centered, normalized `HH:MM:SS` visual layer while preserving the R2 shell and native picker, and Human review passed on iPhone 16／iOS 26.5.2／Safari portrait.

Formal state:

- `PR29_R1_PHYSICAL_IPHONE_REVIEW_FAILED`
- `PR29_R2_CORE_OVERFLOW_FIX_HUMAN_ACCEPTED`
- `PR29_R3_HHMMSS_CENTERED_VISUAL_POLISH_AUTHORIZED`
- `PR29_R3_NONBLOCKING_POLISH_BEFORE_MERGE`
- `PR29_R3_PHYSICAL_IPHONE_HUMAN_REVIEW_PASSED`
- `PR29_R3_HUMAN_ACCEPTED`
- `IPHONE_TIME_INPUT_RIGHT_EDGE_OVERFLOW_CLOSED`
- `PR29_MERGED_TO_MAIN`

PR #29 is Merged／Closed at merge commit `25f852a0218486f695a5e2b88c7fc9b665c8c362`. The Human-reviewed product Head is `cf1751265410a160715db2bd9566b1703d916bac`.

## Provenance

- Base main commit: `155275d0aaeb968fd83d6dfe15313e259f2bb064`
- R1 review Head: `6e2be3b5714ae329309c581a07d351b6ebaaf621`
- R2 implementation commit: `e6f65ecdd67bde5b66d95587b2f195268e0171d8`
- R3 start Head: `4a375c8818c1c73b50f47c34bb3cb47ec23e5776`
- R3 implementation commit: `b08e9762ff1557ad88ebef966bf9ee006f5fd644`
- Branch: `fix/iphone-time-input-overflow`
- APP_VERSION: `v3.15.0` (unchanged)

## Human history

R1 failed because the native Safari visual frame painted through the right inset even though its DOM rectangle passed. Its exact failure record remains in `reports/human-review-r1.json`.

R2 passed on iPhone 16 / iOS 26.5.2 / Safari portrait: both side borders, all four radii, approximately symmetric margins, value right edge, native picker, post-picker frame/value, specified/current time application, and zero horizontal scrolling were accepted. The exact record is `reports/human-review-r2.json`.

The R3 Human request was isolated from the core overflow fix and is now accepted:

1. display normalized `HH:MM:SS`, including `:00` after a minute-precision picker result;
2. center the visible time horizontally and vertically.

## R3 implementation

```html
<div class="timeInputShell full">
  <span id="timeInputVisual" class="timeInputVisual" aria-hidden="true">10:08:30</span>
  <input id="timeInput" type="time" step="1" value="10:08:30" aria-label="表示時刻">
</div>
```

- `.timeInputShell` remains the border, background, corner, paint-containment, and `:focus-within` owner.
- `.timeInputVisual` is centered with CSS Grid, uses tabular numerals, has `pointer-events:none`, and is excluded from the accessibility tree.
- The native input remains `type="time"`, `step="1"`, `appearance:auto`, the full 44px mobile target, and the only authoritative value/focus/picker control.
- Only the native painted text is transparent; the input itself is not `opacity:0`, is not `appearance:none`, and is not replaced by a custom picker.
- `formatTimeInputVisual()` converts a valid value to normalized `HH:MM:SS`; `10:15` becomes `10:15:00`, seconds are retained, and invalid/empty values show `--:--:--`.
- `syncTimeInputVisual()` runs through editor updates and the existing `input`, `change`, and `blur` path, including current-time, Live Sync, and diagnostic changes. The existing application logic remains authoritative and unchanged.

## Automated verification

| Area | Result |
|---|---|
| Installed Chrome layout, 7 viewports × 2 routes | 14/14 |
| Playwright WebKit layout, 7 viewports × 2 routes | 14/14 |
| Native Safari 26.5.2 layout, 7 requested viewports × 2 routes | 14/14 |
| Maximum horizontal / vertical center error | 0px / 0px (limit 1px) |
| Maximum shell inset difference | 0px (limit 1px) |
| Horizontal overflow stages | 0 |
| Minute / second visual normalization | `10:15:00` / `13:37:42` |
| Chrome + WebKit UI / HUD | 6/6 |
| Chrome + WebKit default / legacy time flow | 4/4 |
| Native Safari scoped default / legacy time flow | 2/2 |
| Console error / warning / runtime error / unhandled rejection | 0 / 0 / 0 / 0 |
| PR #29-specific Node tests | 12/12; fail 0; skip 0 |
| Full branch Node suite | 475/477; 2 exact inherited documentation-state failures |
| PR #28 fixed Head Node suite | 465/465 |
| Candidate-specific comprehensive-browser failures | 0 |

Native Safari kept `type="time"`, `appearance:auto`, the accessible name `表示時刻`, a 44px target, and the centered inert overlay. Its trusted keyboard input path produced native `input`/`change` events and preserved hand coupling, current-time, Live Sync, panel, and tab behavior. macOS Native Safari's modal picker is not fully operable through this WebDriver environment; that automation limitation remains historical, while R2 picker operation and the complete R3 visual/time flow were subsequently accepted by Human review on the physical iPhone. SafariDriver's full-page and element PNG endpoints returned single-color images in this run, so those invalid R3 PNGs are excluded rather than presented as visual evidence.

The comprehensive desktop and 390×844 harnesses retain the same five inherited A.5 lighting/A.6 absolute-performance IDs recorded at R2. No PR #29-specific browser failure was added and no threshold was changed.

## Accessibility and protected scope

The native input remains focusable and clickable, keeps the accessible name `表示時刻`, and continues to own picker semantics. The visual span is `aria-hidden` and pointer-inert. Focus remains visible on the shell. No custom picker, Geometry, mechanism, rendering, camera, audio, APP_VERSION, or test-threshold change is included.

## Human R3 acceptance

The fixed-commit Human review passed all five checks:

1. visible value is `HH:MM:SS`;
2. vertical centering;
3. horizontal centering;
4. native picker opens;
5. picker result, specified-time application, and current-time application remain correct.

The exact record is `docs/evidence/iphone-time-input-overflow/reports/human-review-r3.json`. Product code was not changed after the reviewed Head; the acceptance record and completion documents are added through PR #28.
