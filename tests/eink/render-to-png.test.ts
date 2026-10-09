import {Palette, renderToPng, TONE} from '../../src/eink/render-to-png';

describe('renderToPng', () => {
  const paletteFor = (tones: 2 | 4) => {
    let given: Palette | undefined;
    renderToPng(64, 64, tones, (_ctx, palette) => {
      given = palette;
    });
    return given!;
  };

  it('draws secondary text dark grey and separators light grey with four tones', () => {
    expect(paletteFor(4)).toMatchObject({
      ink: TONE.black,
      muted: TONE.dark,
      rule: TONE.light,
    });
  });

  it('draws nothing grey for a panel with only two tones', () => {
    expect(paletteFor(2)).toMatchObject({
      ink: TONE.black,
      muted: TONE.black,
      rule: TONE.black,
    });
  });
});
