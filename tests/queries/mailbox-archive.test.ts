/**
 * @jest-environment jsdom
 */
import {
  mailboxArchivedNoticeForTest,
  mailboxListForTest,
} from '../../src/queries/mailbox/index';

const render = (markup: string) => {
  const body = document.createElement('body');
  body.innerHTML = markup;
  return body;
};

const text = (markup: string) =>
  render(markup).textContent?.replace(/\s+/g, ' ').trim();

describe('archiving from the mailbox list', () => {
  it('gives every row an archive button that posts back to the page', () => {
    const form = render(mailboxListForTest(['a@example.com'])).querySelector(
      'td.mailbox__actions form'
    );

    expect(form?.getAttribute('method')).toBe('post');
    expect(form?.getAttribute('action')).toBe(
      '/mailbox/archive?next=%2Fmailbox'
    );
    expect(
      form?.querySelector('input[name="conversationId"]')?.getAttribute('value')
    ).toBe('c1');
    expect(form?.querySelector('button')?.textContent?.trim()).toBe('Archive');
  });

  it('offers to bring an archived conversation back, and says it is archived', () => {
    const row = render(mailboxListForTest(['a@example.com'], true));

    expect(
      row.querySelector('td.mailbox__actions form')?.getAttribute('action')
    ).toBe('/mailbox/unarchive?next=%2Fmailbox');
    expect(row.querySelector('button')?.textContent?.trim()).toBe('Unarchive');
    expect(row.querySelector('.mailbox__filtered')?.textContent?.trim()).toBe(
      'Archived'
    );
  });
});

describe('the archived notice', () => {
  it('says so when nothing is archived, with no link to an identical view', () => {
    expect(text(mailboxArchivedNoticeForTest(0, false))).toBe(
      'No conversations are archived.'
    );
    expect(render(mailboxArchivedNoticeForTest(0, false)).querySelector('a')).toBeNull();
  });

  it('counts what is archived and links to it', () => {
    expect(text(mailboxArchivedNoticeForTest(2, false))).toBe(
      '2 conversations archived. Show them.'
    );
    expect(
      render(mailboxArchivedNoticeForTest(2, false))
        .querySelector('a')
        ?.getAttribute('href')
    ).toBe('/mailbox?archived=1');
  });

  it('offers the way back when the archive is on show', () => {
    expect(text(mailboxArchivedNoticeForTest(1, true))).toBe(
      'Showing the 1 conversation that has been archived, marked as such. Hide them again.'
    );
    expect(text(mailboxArchivedNoticeForTest(2, true))).toBe(
      'Showing the 2 conversations that have been archived, marked as such. Hide them again.'
    );
    expect(
      render(mailboxArchivedNoticeForTest(1, true))
        .querySelector('a')
        ?.getAttribute('href')
    ).toBe('/mailbox');
  });
});
