import {SKRSContext2D} from '@napi-rs/canvas';
import {FONT_FAMILY, Palette, renderToPng, TONE, Tones} from './render-to-png';

// What a numbered display shows before it is given a machine: its number,
// so whoever is holding it knows which one it is, and where to set it up.
// Nothing on it changes until the display is assigned, so it is drawn once
// and then answered with 304s.

const font = (px: number, bold = false) =>
  `${bold ? 'bold ' : ''}${px}px "${FONT_FAMILY}"`;

// Shrink text until it fits the width, down to a floor.
const fittedSize = (
  ctx: SKRSContext2D,
  text: string,
  maxWidth: number,
  px: number,
  bold: boolean
) => {
  let size = px;
  ctx.font = font(size, bold);
  while (size > 8 && ctx.measureText(text).width > maxWidth) {
    size--;
    ctx.font = font(size, bold);
  }
  return size;
};

const draw =
  (displayNumber: number, setUpAt: string, width: number, height: number) =>
  (ctx: SKRSContext2D, palette: Palette) => {
    const scale = Math.min(width, height) / 480;
    const pad = Math.max(4, Math.round(20 * scale));
    const inner = width - 2 * pad;
    ctx.textBaseline = 'top';

    // Header band, as on the trouble-ticket image.
    const title = `Display ${displayNumber}`;
    const titleSize = fittedSize(
      ctx,
      title,
      inner,
      Math.max(14, Math.round(40 * scale)),
      true
    );
    const bandHeight = Math.round(titleSize * 1.6);
    ctx.fillStyle = palette.ink;
    ctx.fillRect(0, 0, width, bandHeight);
    ctx.fillStyle = TONE.white;
    ctx.fillText(title, pad, Math.round((bandHeight - titleSize) / 2));

    let y = bandHeight + pad * 2;
    const headline = 'Not set up yet';
    const headlineSize = fittedSize(
      ctx,
      headline,
      inner,
      Math.max(12, Math.round(48 * scale)),
      true
    );
    ctx.fillStyle = palette.ink;
    ctx.fillText(headline, pad, y);
    y += Math.round(headlineSize * 1.5);

    const where = `Choose what it shows at ${setUpAt}`;
    fittedSize(ctx, where, inner, Math.max(10, Math.round(24 * scale)), false);
    ctx.fillStyle = palette.muted;
    ctx.fillText(where, pad, y);
  };

export const renderNotSetUpImage = (
  displayNumber: number,
  // Where displays are set up, shown without its scheme to save room.
  setUpAt: string,
  width: number,
  height: number,
  tones: Tones = 4
): Buffer =>
  renderToPng(width, height, tones, draw(displayNumber, setUpAt, width, height));
