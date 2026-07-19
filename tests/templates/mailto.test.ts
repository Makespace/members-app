import * as O from 'fp-ts/Option';
import {mailTo} from '../../src/templates/mailto';
import {EmailAddress} from '../../src/types';

describe('mailTo', () => {
  const email = 'foo@example.com' as EmailAddress;

  describe('when no subject or body is provided', () => {
    it('renders a link with just the email address', () => {
      const rendered = mailTo(email, O.none, O.none);

      expect(rendered).toContain('<a href="mailto:foo@example.com">');
      expect(rendered).toContain('foo@example.com');
      expect(rendered).not.toContain('mailto:foo@example.com?');
    });
  });

  describe('when only a subject is provided', () => {
    it('url-encodes the subject in the href', () => {
      const rendered = mailTo(email, O.some('Hello there'), O.none);

      expect(rendered).toContain(
        '<a href="mailto:foo@example.com?subject=Hello%20there">'
      );
    });
  });

  describe('when only a body is provided', () => {
    it('url-encodes the body in the href', () => {
      const rendered = mailTo(email, O.none, O.some('Line 1\nLine 2'));

      expect(rendered).toContain(
        '<a href="mailto:foo@example.com?body=Line%201%0ALine%202">'
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
        '<a href="mailto:foo@example.com?subject=Support%20request&body=Line%201%0ALine%202">'
      );
    });
  });
});
