import path from 'path';
import {createCanvas, GlobalFonts, SKRSContext2D} from '@napi-rs/canvas';
import {encodeGrey2Png} from './encode-png';

// Shared plumbing for images drawn for e-ink displays: a canvas of the
// display's size, a font that is there on every machine (the production
// image has no system fonts), and a PNG reduced to the panel's four tones.
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
  draw: (ctx: SKRSContext2D) => void
): Buffer => {
  registerFonts();
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = TONE.white;
  ctx.fillRect(0, 0, width, height);
  draw(ctx);

  const {data} = ctx.getImageData(0, 0, width, height);
  const levels = new Uint8Array(width * height);
  for (let i = 0; i < levels.length; i++) {
    const luminance =
      (data[i * 4] * 299 + data[i * 4 + 1] * 587 + data[i * 4 + 2] * 114) /
      1000;
    levels[i] = Math.min(3, Math.round(luminance / 85));
  }
  return encodeGrey2Png(width, height, levels);
};
