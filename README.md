# sandsong

A Chladni plate in the browser. Sweep a tone across a square plate covered in
sand. At each resonance the grains run from the shaking regions and settle on
the lines that stay still.

**Live demo:** https://fushanbobfan.github.io/sandsong/

No build step and no dependencies. The plate model, sand, renderer, tone and
share-link codec are plain ES modules covered by a Node test suite; only
`src/main.js` touches the DOM.

## Quick start

Open `index.html` through any static server, or run:

```bash
npm run serve
# then visit http://localhost:8080
```

Run the tests with `npm test` (Node 20 or newer).

## How it works

**Modes.** Each standing wave on the plate is labelled by two whole numbers
n ≤ m and a sign, and has the shape

    z(x, y) = cos(nπu)·cos(mπv) ± cos(mπu)·cos(nπv)

with u and v running from 0 to 1 across the plate. This is the classic
approximation Chladni figures are drawn from. The "+" partner is symmetric
about the diagonal; the "−" partner always has a nodal line along it.

**Frequencies.** Bending waves make natural frequencies grow roughly with
n² + m². Taken literally that ladder has many exact ties, such as (0,5) and
(3,4), and each "+" mode ties with its "−" partner. Real plates split these,
so the model adds small correction terms and places each "−" partner 4 %
higher. The coefficients were chosen so no two of the 48 modes up to order 6
lie closer than about 2 % apart, which keeps every resonance reachable on its
own. They are a modelling choice, not a measurement of a particular plate.

**Driving.** Each mode responds to the drive tone like a damped oscillator
with quality factor 120. On a resonance one mode dominates and its figure
appears. Between resonances many modes answer weakly, the plate moves much
less, and the sand drifts slowly into a blurred blend or barely moves.

**Spectrum.** The strip under the frequency slider shows the plate's overall
response, the root sum of squares of every mode's weight, across the same log
axis as the slider. Every resonance is a peak of height about 1. Each column keeps
the loudest of several samples and every mode frequency is written into its
own column, so peaks narrower than a pixel still show. Bars are linear in
amplitude, because on a dB scale the shallow valleys between the densely
packed high modes would fill the strip.

**Sand.** Every frame each grain hops a random distance proportional to the
plate's motion beneath it. Below a small friction threshold it stays put.
Grains also slide slightly down the slope of the plate's vibration energy,
which pulls them onto each nodal line instead of leaving them along both
edges of its quiet band. The status line reports the share of grains resting
where the plate moves less than 15 % of its peak.

## Controls

| Control | What it does |
| --- | --- |
| Frequency slider | Sweeps the drive tone on a log scale from 60 Hz to 6 kHz |
| ◀ / ▶ Resonance | Jumps to the next natural frequency below or above |
| Jump to a mode | Picks any of the 48 modes by label and frequency |
| Spectrum strip | Click or drag to tune; within a few pixels of a peak it snaps to the resonance |
| Sweep up / down | Glides the drive at 1 octave per 33 s, 12 s or 4 s, optionally stopping 2, 4 or 8 s on each resonance; any manual tuning stops it |
| Play tone | Plays the drive frequency through the speakers |
| Grains, shake, speed | Sand amount (re-pours on release), hop size and steps per frame |
| At the edges | Grains bounce back, or fall off the plate as on a real one |
| Show the plate's motion | Tints the plate warm and cool by the sign of its displacement |
| Drag on the plate | Sprinkles extra sand under the pointer |
| Save PNG, Copy link | Exports the plate; the link keeps frequency, colours and edge rule |

Keys: `←`/`→` fine tune by 0.2 %, `[`/`]` previous/next resonance, `Space`
pause, `P` pour fresh sand, `T` toggle the tone, `S` start an upward sweep
or stop the current one.

Share links look like `#f=2127.6&p=brass&e=bounce`. Unknown or malformed
fields are ignored and frequencies are clamped to the playable range.

## Layout

```
index.html        page and controls
style.css
src/plate.js      mode shapes, frequency ladder, resonance weights, field sampling
src/sand.js       seeded PRNG, pouring, brush, grain hops, nodal share
src/render.js     palettes, displacement tint, grain deposits, labels
src/tone.js       Web Audio drive tone
src/share.js      URL hash codec
src/spectrum.js   response spectrum sampling and click snapping
src/sweep.js      automatic sweep with resonance holds
src/main.js       DOM wiring and animation loop
test/             node:test suites for every module except main.js
```

## License

MIT
