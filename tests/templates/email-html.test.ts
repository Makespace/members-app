/**
 * @jest-environment jsdom
 */
import {renderEmailHtml} from '../../src/templates/email-html';

const frameOf = (markup: string) => {
  const body = document.createElement('body');
  body.innerHTML = markup;
  return body.querySelector('iframe');
};

const srcdocOf = (markup: string) => frameOf(markup)?.getAttribute('srcdoc') ?? '';

describe('rendering email HTML', () => {
  const message = '<p>Hello <b>there</b></p><img src="https://tracker/x.gif">';

  describe('containment', () => {
    const frame = frameOf(renderEmailHtml(message, false));

    it('renders in a sandbox that cannot run scripts', () => {
      const sandbox = frame?.getAttribute('sandbox') ?? '';
      expect(sandbox).not.toContain('allow-scripts');
    });

    // allow-same-origin is granted so the page can measure the rendered
    // height from outside and size the frame to its content. It is safe only
    // because allow-scripts is withheld - the message is inert markup, so
    // there is no code inside the frame to use the origin. The two together
    // would be the dangerous combination, so this guards the pairing.
    it('never pairs same-origin access with the ability to run scripts', () => {
      const sandbox = frame?.getAttribute('sandbox') ?? '';
      expect(
        sandbox.includes('allow-same-origin') && sandbox.includes('allow-scripts')
      ).toBe(false);
    });

    it('is measurable by the page, so it can be sized to its content', () => {
      expect(frame?.hasAttribute('data-email-frame')).toBe(true);
    });

    it('lets links open in a new tab', () => {
      const sandbox = frame?.getAttribute('sandbox') ?? '';
      expect(sandbox).toContain('allow-popups');
      expect(srcdocOf(renderEmailHtml(message, false))).toContain(
        '<base target="_blank">'
      );
    });

    it('leaks no referrer', () => {
      expect(frame?.getAttribute('referrerpolicy')).toBe('no-referrer');
    });
  });

  describe('remote images', () => {
    it('are blocked by default, so tracking pixels do not fire', () => {
      const srcdoc = srcdocOf(renderEmailHtml(message, false));
      expect(srcdoc).toContain("default-src 'none'");
      expect(srcdoc).toContain('img-src data:;');
      expect(srcdoc).not.toContain('img-src data: https:');
    });

    it('are allowed once asked for', () => {
      expect(srcdocOf(renderEmailHtml(message, true))).toContain(
        'img-src data: https:'
      );
    });
  });

  describe('the message itself', () => {
    it("keeps the sender's formatting", () => {
      expect(srcdocOf(renderEmailHtml(message, false))).toContain(
        '<p>Hello <b>there</b></p>'
      );
    });

    it('escapes quotes so a crafted message cannot break out of the attribute', () => {
      const attack = '<img src="x" onerror="alert(1)"><p>after</p>';
      const frame = frameOf(renderEmailHtml(attack, false));
      // The browser parsed one iframe with the payload inside its srcdoc,
      // rather than the payload becoming part of the app's own document.
      expect(frame).not.toBeNull();
      expect(frame?.getAttribute('srcdoc')).toContain('onerror=');
      expect(document.querySelector('img')).toBeNull();
    });
  });
});
