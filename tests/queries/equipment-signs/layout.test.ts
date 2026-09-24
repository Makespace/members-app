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

  // Print overrides are a second, deliberate copy of some of these rules, so
  // the duplication guard looks at the stylesheet without them.
  const withoutPrintBlocks = (input: string) => {
    let output = '';
    let index = 0;
    for (;;) {
      const start = input.indexOf('@media print', index);
      if (start === -1) {
        return output + input.slice(index);
      }
      output += input.slice(index, start);
      let depth = 0;
      let cursor = input.indexOf('{', start);
      for (; cursor < input.length; cursor++) {
        if (input[cursor] === '{') depth++;
        if (input[cursor] === '}') {
          depth--;
          if (depth === 0) break;
        }
      }
      index = cursor + 1;
    }
  };

  const screenCss = withoutPrintBlocks(css);

  const occurrences = (selector: string) =>
    screenCss.split(selector).length - 1;

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
    const block = screenCss.slice(screenCss.indexOf('.sign-block {'));
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

  // Chrome and Safari leave backgrounds off the paper unless the person
  // finds the "Background graphics" tickbox, which would print the sign as
  // black text on white - no band, no capsules, no colour at all.
  it('insists the colours reach the paper', () => {
    const sign = screenCss.slice(screenCss.indexOf('.sign {'));
    expect(sign.slice(0, sign.indexOf('}'))).toContain(
      'print-color-adjust: exact'
    );
  });

  // The page around the signs exists to get you to the point of printing.
  // None of it belongs on a poster, and it used to come out on the paper.
  it('leaves everything but the signs off the paper', () => {
    const start = css.indexOf('@media print');
    const printBlock = css.slice(start, css.indexOf('\n}', start));

    for (const hidden of [
      '.page-nav',
      '.signs-page__controls',
      '.signs-page__warning',
      '.sign-block__print',
    ]) {
      expect(printBlock).toContain(hidden);
    }
    expect(printBlock).toContain('break-after: page');
  });

  it('sizes the sign from paper rather than screen units', () => {
    expect(css).toContain('--sign-w: 105mm');
    expect(css).toContain('--sign-font');
  });
});
