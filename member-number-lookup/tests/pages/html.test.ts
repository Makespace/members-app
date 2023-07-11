import {html} from '../../src/types/html';

describe('html', () => {
  const eggs = 'eggs';
  it('concatenates literals and substitutions', () => {
    expect(html`spam`).toStrictEqual('spam');
    expect(html`${eggs}`).toStrictEqual('eggs');
    expect(html`spam${eggs}`).toStrictEqual('spameggs');
    expect(html`${eggs}spam${eggs}`).toStrictEqual('eggsspameggs');
    expect(html`${eggs}spam`).toStrictEqual('eggsspam');
  });
});
