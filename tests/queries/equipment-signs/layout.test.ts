import {readFileSync} from 'fs';
import path from 'path';

// The signs stylesheet has been rebuilt twice, and each time a stale copy of
// the old rules survived further down the file and quietly won on source
// order - which is how a landscape sign with a thick border reappeared under
// a portrait design. Duplication is the bug worth guarding against.
describe('the signs stylesheet', () => {
  const css = readFileSync(
    path.join(__dirname, '../../../src/static/styles.css'),
    'utf8'
  );

  const occurrences = (selector: string) =>
    css.split(selector).length - 1;

  it.each([
    '.sign {',
    '.sign__band {',
    '.sign__name {',
    '.sign__codes {',
    '.sign-block {',
  ])('defines %s exactly once', selector => {
    expect(occurrences(selector)).toBe(1);
  });

  it('has no rules left from the landscape design', () => {
    expect(css).not.toContain('aspect-ratio: 297 / 210');
    expect(css).not.toContain('.sign__inner');
    expect(css).not.toContain('.sign__category');
  });

  // The print button is positioned against its sign. Without this the block
  // fills the page and the button lands out beside the sign, where clicking
  // where it looks like it should be does nothing.
  it('shrinks the sign block to the sign it wraps', () => {
    const block = css.slice(css.indexOf('.sign-block {'));
    expect(block.slice(0, block.indexOf('}'))).toContain('width: fit-content');
  });

  // The codes used to sit at the bottom of the sign with the space below the
  // name left blank. That space is worth more as a bigger code.
  it('gives the codes the space the name does not need', () => {
    const rule = (selector: string) => {
      const from = css.slice(css.indexOf(selector));
      return from.slice(0, from.indexOf('}'));
    };

    expect(rule('.sign__codes {')).toContain('flex: 1 1 auto');
    expect(rule('.sign__codes {')).not.toContain('margin-top: auto');
    expect(rule('.sign__scan {')).toContain('flex: 1 1 0');
    // Square, and as tall as its share allows - not a fixed width.
    expect(rule('.sign__qr {')).toContain('aspect-ratio: 1');
    expect(rule('.sign__qr {')).toContain('height: min(100%');
  });

  it('sizes the sign from paper rather than screen units', () => {
    expect(css).toContain('--sign-w: 105mm');
    expect(css).toContain('--sign-font');
  });
});
