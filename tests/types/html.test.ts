import {html, sanitizeString} from '../../src/types/html';

describe('sanitizeString', () => {
  it('escapes markup', () => {
    expect(sanitizeString('<script>x</script> & co')).not.toContain('<script>');
  });

  it("can't end a quoted attribute early", () => {
    const value = `A 2" pipe" autofocus onfocus="alert(1)`;
    expect(html`<input value="${sanitizeString(value)}" />`).toBe(
      '<input value="A 2&quot; pipe&quot; autofocus onfocus=&quot;alert(1)" />'
    );
    expect(sanitizeString(`it's`)).toBe('it&#39;s');
  });
});
