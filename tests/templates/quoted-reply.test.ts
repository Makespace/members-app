import {
  splitQuotedHtml,
  splitQuotedText,
} from '../../src/templates/quoted-reply';

describe('separating a reply from the history it quotes', () => {
  it('keeps only what the sender wrote, above a Gmail attribution', () => {
    const message = [
      "I've talked to Virgin Media Business team - they say we're going to have",
      'intermittent outages until 26th September.',
      'James',
      '',
      'On Wed, 23 Sept 2026 at 10:12, Bob Example <bob@example.com>',
      'wrote:',
      '',
      '> +cc: it-maintainers',
      '>',
      '> Matt S or Daniel K might know!',
    ].join('\n');

    const {reply, quoted} = splitQuotedText(message);

    expect(reply).toBe(
      [
        "I've talked to Virgin Media Business team - they say we're going to have",
        'intermittent outages until 26th September.',
        'James',
      ].join('\n')
    );
    expect(quoted).toContain('Matt S or Daniel K might know!');
  });

  it('handles an attribution that wraps across lines', () => {
    const message = [
      '+cc: it-maintainers',
      '',
      'Matt S or Daniel K might know!',
      '',
      'On Wed, Sept 23 2026 at 9:42 , Alice Example < alice@example.com > wrote:',
      '',
      '> Hello',
    ].join('\n');

    expect(splitQuotedText(message).reply).toBe(
      ['+cc: it-maintainers', '', 'Matt S or Daniel K might know!'].join('\n')
    );
  });

  it('cuts at an Outlook separator', () => {
    const message = [
      'Sounds good.',
      '',
      '-----Original Message-----',
      'From: someone',
    ].join('\n');

    expect(splitQuotedText(message).reply).toBe('Sounds good.');
  });

  it('leaves a message with no quoted history alone', () => {
    const message = 'Hello\n\nThe wifi seems to be down.\n\nAlice';

    expect(splitQuotedText(message)).toStrictEqual({
      reply: message,
      quoted: '',
    });
  });

  it('does not mistake a sentence beginning "On" for an attribution', () => {
    const message = 'On Tuesday I tried the laser again and it wrote: fine.';

    expect(splitQuotedText(message).reply).toBe(message);
  });

  it('shows everything when a message is nothing but quoted history', () => {
    const message = '> Hello\n> The wifi is down';

    expect(splitQuotedText(message)).toStrictEqual({
      reply: message,
      quoted: '',
    });
  });

  describe('html', () => {
    it('cuts at the quote container', () => {
      const body =
        '<p>Thanks!</p><div class="gmail_quote"><p>Earlier message</p></div>';

      const {reply, quoted} = splitQuotedHtml(body);

      expect(reply).toBe('<p>Thanks!</p>');
      expect(quoted).toContain('Earlier message');
    });

    it('shows everything when the cut would leave only wrapper markup', () => {
      const body =
        '<div dir="ltr"></div><div class="gmail_quote"><p>Earlier</p></div>';

      expect(splitQuotedHtml(body)).toStrictEqual({reply: body, quoted: ''});
    });

    it('leaves a message without a quote container alone', () => {
      const body = '<p>Just this</p>';

      expect(splitQuotedHtml(body)).toStrictEqual({reply: body, quoted: ''});
    });
  });
});
