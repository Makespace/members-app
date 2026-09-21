import {markdownToHtml} from '../../src/templates/markdown';

describe('markdownToHtml', () => {
  it('renders links, bold and italics', () => {
    expect(
      markdownToHtml('Sign up [here](https://example.com/x). **Bold** *soft*.')
    ).toBe(
      '<p>Sign up <a href="https://example.com/x">here</a>. <strong>Bold</strong> <em>soft</em>.</p>'
    );
  });

  it('renders paragraphs and line breaks', () => {
    expect(markdownToHtml('One\ntwo\n\nThree')).toBe(
      '<p>One<br/>two</p><p>Three</p>'
    );
  });

  it('renders unordered lists', () => {
    expect(markdownToHtml('- first\n- **second**')).toBe(
      '<ul><li>first</li><li><strong>second</strong></li></ul>'
    );
  });

  it('escapes HTML before formatting - no raw HTML passes through', () => {
    expect(markdownToHtml('<script>alert(1)</script> **safe**')).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt; <strong>safe</strong></p>'
    );
  });

  it('ignores non-http link targets', () => {
    expect(markdownToHtml('[x](javascript:alert(1))')).toBe(
      '<p>[x](javascript:alert(1))</p>'
    );
  });
});
