/**
 * @jest-environment jsdom
 */
import {mailboxListForTest} from '../../src/queries/mailbox/index';

describe('the mailbox list', () => {
  const render = (senders: ReadonlyArray<string>) => {
    const body = document.createElement('body');
    body.innerHTML = mailboxListForTest(senders);
    return body;
  };

  it('shows sender names rather than full addresses, which do not wrap', () => {
    const who = render([
      'Tara Beattie <beattietara@gmail.com>',
      '"Hector Dearman" <hector.dearman@makespace.org>',
    ]).querySelector('td:nth-child(2)');

    expect(who?.textContent?.trim()).toBe('Tara Beattie, Hector Dearman');
  });

  it('falls back to the address when there is no name', () => {
    const who = render(['membership@makespace.org']).querySelector(
      'td:nth-child(2)'
    );

    expect(who?.textContent?.trim()).toBe('membership@makespace.org');
  });

  it('clamps the preview inside the cell, so the row keeps its shape', () => {
    const row = render(['a@b.com']);
    // display:-webkit-box on the td itself would break the table layout.
    expect(row.querySelector('td .mailbox-preview')).not.toBeNull();
  });

  it('does not repeat a sender who wrote more than once', () => {
    const who = render([
      'Tara Beattie <beattietara@gmail.com>',
      'Tara Beattie <beattietara@gmail.com>',
    ]).querySelector('td:nth-child(2)');

    expect(who?.textContent?.trim()).toBe('Tara Beattie');
  });
});
