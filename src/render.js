// Pixel rendering for the plate. Everything here writes into a plain RGBA
// buffer so it can be tested without a canvas.

export const PALETTES = [
  { id: 'brass', name: 'Brass and sand', plate: [58, 44, 26], sand: [244, 226, 186], plus: [214, 120, 60], minus: [70, 130, 190] },
  { id: 'slate', name: 'Slate and chalk', plate: [26, 29, 34], sand: [236, 240, 245], plus: [200, 90, 110], minus: [80, 170, 170] },
  { id: 'paper', name: 'Paper and ink', plate: [238, 232, 218], sand: [34, 32, 40], plus: [220, 150, 110], minus: [120, 160, 210] },
];

export function paletteById(id) {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}

// Plate coordinates (-1..1) to a pixel column or row in a width-wide image.
export function toPixel(v, width) {
  return Math.min(width - 1, Math.max(0, Math.floor(((v + 1) / 2) * width)));
}

export function toPlate(px, width) {
  return ((px + 0.5) / width) * 2 - 1;
}

function mix(a, b, t) {
  return a + (b - a) * t;
}

// Fill the background, optionally tinted by the signed displacement so the
// moving regions glow warm or cool and the nodal lines stay plate-coloured.
export function paintPlate(buffer, width, palette, overlay = null) {
  const [pr, pg, pb] = palette.plate;
  if (!overlay || overlay.peak <= 0) {
    for (let p = 0; p < width * width; p++) {
      const o = p * 4;
      buffer[o] = pr;
      buffer[o + 1] = pg;
      buffer[o + 2] = pb;
      buffer[o + 3] = 255;
    }
    return;
  }
  const { field, size, peak, strength = 0.55 } = overlay;
  for (let py = 0; py < width; py++) {
    const j = Math.min(size - 1, Math.floor((py / width) * size));
    for (let px = 0; px < width; px++) {
      const i = Math.min(size - 1, Math.floor((px / width) * size));
      const z = field[j * size + i] / peak;
      const tint = z >= 0 ? palette.plus : palette.minus;
      const t = Math.min(1, Math.abs(z)) * strength;
      const o = (py * width + px) * 4;
      buffer[o] = mix(pr, tint[0], t);
      buffer[o + 1] = mix(pg, tint[1], t);
      buffer[o + 2] = mix(pb, tint[2], t);
      buffer[o + 3] = 255;
    }
  }
}

// Deposit grains: each one moves its pixel a step towards the sand colour
// and its four neighbours a smaller step, so piles read brighter and thicker
// than lone grains.
export function paintSand(buffer, width, sand, palette, grain = 0.45, halo = 0.12) {
  const [sr, sg, sb] = palette.sand;
  const deposit = (px, py, t) => {
    const o = (py * width + px) * 4;
    buffer[o] = mix(buffer[o], sr, t);
    buffer[o + 1] = mix(buffer[o + 1], sg, t);
    buffer[o + 2] = mix(buffer[o + 2], sb, t);
  };
  for (let k = 0; k < sand.count; k++) {
    const px = toPixel(sand.x[k], width);
    const py = toPixel(sand.y[k], width);
    deposit(px, py, grain);
    if (halo > 0) {
      if (px > 0) deposit(px - 1, py, halo);
      if (px < width - 1) deposit(px + 1, py, halo);
      if (py > 0) deposit(px, py - 1, halo);
      if (py < width - 1) deposit(px, py + 1, halo);
    }
  }
}

export function formatFrequency(f) {
  if (f >= 1000) return `${(f / 1000).toFixed(f >= 10000 ? 1 : 2)} kHz`;
  return `${f.toFixed(f >= 100 ? 0 : 1)} Hz`;
}
