import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {mailTo} from '../../src/templates/mailto';
import {EmailAddress, EmailAddressCodec} from '../../src/types';

const decodeEmailAddress = (input: string): EmailAddress => {
  const result = EmailAddressCodec.decode(input);
  if (E.isLeft(result)) {
    throw new Error(`Expected a valid email address, got: ${input}`);
  }

  return result.right;
};

describe('mailTo', () => {
  const email = decodeEmailAddress('foo@example.com');

  describe('when no subject or body is provided', () => {
    it('renders a link with just the email address', () => {
      const rendered = mailTo(email, O.none, O.none);

      expect(rendered).toContain('<a href="mailto:foo%40example.com">');
      expect(rendered).toContain('foo@example.com');
      expect(rendered).not.toContain('mailto:foo%40example.com?');
    });
  });

  describe('when only a subject is provided', () => {
    it('url-encodes the subject in the href', () => {
      const rendered = mailTo(email, O.some('Hello there'), O.none);

      expect(rendered).toContain(
        '<a href="mailto:foo%40example.com?subject=Hello%20there">'
      );
    });
  });

  describe('when only a body is provided', () => {
    it('url-encodes the body in the href', () => {
      const rendered = mailTo(email, O.none, O.some('Line 1\nLine 2'));

      expect(rendered).toContain(
        '<a href="mailto:foo%40example.com?body=Line%201%0ALine%202">'
      );
    });
  });

  describe('when both a subject and body are provided', () => {
    it('renders both query parameters in order', () => {
      const rendered = mailTo(
        email,
        O.some('Support request'),
        O.some('Line 1\nLine 2')
      );

      expect(rendered).toContain(
        '<a href="mailto:foo%40example.com?subject=Support%20request&body=Line%201%0ALine%202">'
      );
    });
  });

  describe('when the email contains html-significant characters', () => {
    it('escapes the visible text and url-encodes the href', () => {
      const rendered = mailTo(
        decodeEmailAddress('"foo<bar&baz"@example.com'),
        O.none,
        O.none
      );

      expect(rendered).toContain(
        '<a href="mailto:%22foo%3Cbar%26baz%22%40example.com">'
      );
      expect(rendered).toContain('"foo&lt;bar&amp;baz"@example.com');
    });
  });

  describe('when the email contains query-like characters in a quoted local part', () => {
    it('does not let the email address create its own query string', () => {
      const rendered = mailTo(
        decodeEmailAddress('"foo?bar"@example.com'),
        O.none,
        O.none
      );

      expect(rendered).toContain(
        '<a href="mailto:%22foo%3Fbar%22%40example.com">'
      );
      expect(rendered).not.toContain('mailto:"foo?bar"@example.com');
    });

    it('appends component query parameters after the encoded email address', () => {
      const rendered = mailTo(
        decodeEmailAddress('"foo?bar"@example.com'),
        O.some('Hello there'),
        O.none
      );

      expect(rendered).toContain(
        '<a href="mailto:%22foo%3Fbar%22%40example.com?subject=Hello%20there">'
      );
    });
  });

  describe('when the email contains quotes and attribute-like text', () => {
    it('keeps the href attribute intact by encoding the address', () => {
      const rendered = mailTo(
        decodeEmailAddress('"foo\\" onclick=\\"alert(1)"@example.com'),
        O.none,
        O.none
      );

      expect(rendered).toContain(
        '<a href="mailto:%22foo%5C%22%20onclick%3D%5C%22alert(1)%22%40example.com">'
      );
    });
  });
});
