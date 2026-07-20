# Refactor A.3 browser evidence

This directory contains screenshots captured from the real browser/WebGL build at
`http://127.0.0.1:4173/`. Numerical rotation, phase, interference, hand-coupling,
and transition results are documented in `docs/REFACTOR_A3_SUMMARY.md`.

The paired captures are backed by the 39/39 passing browser integration run.
Representative measured Object3D increments were:

- position 1 normal: cannon `-0.0268543`, minute `+0.00895145`, setting 2
  `-0.0100704`, setting 1 `+0.0100704`, transfer `-0.0179029`, while setting
  input/stem/sliding/crown were all exactly `0`;
- position 2 positive input `+4.41896`: transfer `-4.41896`, setting 1
  `+2.485665`, setting 2 `-2.485665`, minute `+2.20948`, cannon/minute hand
  `-6.62844`, while centre/fourth/seconds were all exactly `0`;
- all three actual tube/arbor-end to hand-boss mount distances were `0`, and the
  largest angular coupling error was `1.65 × 10^-13` rad;
- wind and set forbidden-intersection counts were both `0`.

| File | Evidence |
| --- | --- |
| `01-dial-overview.jpg` | A.3 dial-side overview |
| `02-cannon-minute-close.jpg` | Direct 12/36 cannon-pinion to minute-wheel mesh |
| `03-minute-pinion-hour-close.jpg` | Direct 10/40 minute-pinion to hour-wheel mesh |
| `04-position1-setting-before.jpg` | Position 1 permanent setting train, first sample |
| `05-position1-setting-after.jpg` | Position 1 permanent setting train, later sample |
| `06-position1-setting-input-static.jpg` | Detached setting-input clutch in position 1 |
| `07-position2-before.jpg` | Position 2 setting input, first sample |
| `08-position2-after.jpg` | Position 2 setting input, later sample |
| `09-cannon-tube-minute-hand.jpg` | Cannon tube ending at minute-hand boss |
| `10-hour-pipe-hour-hand.jpg` | Hour pipe ending at hour-hand boss |
| `11-fourth-arbor-seconds-hand.jpg` | Fourth-arbor extension ending at seconds-hand boss |
| `12-transition-no-jump.jpg` | Position transition state after continuity check |
| `13-transition-position1-before.jpg` | Paused position 1 reference immediately before the state switch |
| `14-transition-position2-after.jpg` | Same camera and unchanged permanent-wheel pose immediately after position 2 engagement |
