import path from 'path';
import {createCanvas, GlobalFonts, SKRSContext2D} from '@napi-rs/canvas';
import {encodeGreyPng} from './encode-png';

// Shared plumbing for images drawn for e-ink displays: a canvas of the
// display's size, a font that is there on every machine (the production
// image has no system fonts), and a PNG reduced to the tones the panel can
// show - four, or two for a panel that only does black and white.
// A display polls its URL and redraws when the image changes, so anything
// drawn here should change only when its content does - no clocks.

export const FONT_FAMILY = 'Atkinson Hyperlegible';

// The four tones, as canvas colours. Draw with these and nothing is lost to
// rounding; anti-aliased edges fall to the nearest tone.
export const TONE = {
  black: '#000000',
  dark: '#555555',
  light: '#aaaaaa',
  white: '#ffffff',
} as const;

export type Tones = 2 | 4;

// What a drawing uses for each kind of mark. With four tones secondary text
// is dark grey and separators light grey; a two-tone panel has no grey, so
// they are black too - size and spacing carry the difference, and separators
// are drawn at half weight so they still read as quieter than text.
export type Palette = {
  ink: string;
  muted: string;
  rule: string;
  ruleWeight: number;
};

const PALETTES: Record<Tones, Palette> = {
  4: {ink: TONE.black, muted: TONE.dark, rule: TONE.light, ruleWeight: 1},
  2: {ink: TONE.black, muted: TONE.black, rule: TONE.black, ruleWeight: 0.5},
};

let fontsRegistered = false;
const registerFonts = () => {
  if (fontsRegistered) {
    return;
  }
  const fontsDir = path.resolve(__dirname, '../static/fonts');
  for (const file of [
    'AtkinsonHyperlegible-Regular.ttf',
    'AtkinsonHyperlegible-Bold.ttf',
  ]) {
    GlobalFonts.registerFromPath(path.join(fontsDir, file), FONT_FAMILY);
  }
  fontsRegistered = true;
};

export const renderToPng = (
  width: number,
  height: number,
  tones: Tones,
  draw: (ctx: SKRSContext2D, palette: Palette) => void
): Buffer => {
  registerFonts();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = TONE.white;
  ctx.fillRect(0, 0, width, height);
  draw(ctx, PALETTES[tones]);

  // Anti-aliased edges fall to the nearest tone; with two tones that is a
  // cut at mid-grey, made here so every black-and-white panel shows the
  // same picture rather than each display thresholding its own way.
  const {data} = ctx.getImageData(0, 0, width, height);
  const levels = new Uint8Array(width * height);
  for (let i = 0; i < levels.length; i++) {
    const luminance =
      (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) /
      1000;
    levels[i] =
      tones === 4
        ? Math.min(3, Math.round(luminance / 85))
        : luminance < 128
          ? 0
          : 1;
  }
  return encodeGreyPng(width, height, levels, tones === 4 ? 2 : 1);
};
