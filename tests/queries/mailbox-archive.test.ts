/**
 * @jest-environment jsdom
 */
import {
  mailboxArchivedNoticeForTest,
  mailboxConversationActionsForTest,
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
  it('gives a live row one button per reason, each posting back to the page', () => {
    const forms = [
      ...render(mailboxListForTest(['a@example.com'])).querySelectorAll(
        'td.mailbox__actions form'
      ),
    ];

    expect(forms.map(form => form.getAttribute('action'))).toEqual([
      '/mailbox/archive?next=%2Fmailbox',
      '/mailbox/archive?next=%2Fmailbox',
    ]);
    expect(forms.map(form => form.getAttribute('method'))).toEqual([
      'post',
      'post',
    ]);
    expect(
      forms.map(form =>
        form.querySelector('input[name="conversationId"]')?.getAttribute('value')
      )
    ).toEqual(['c1', 'c1']);
    expect(
      forms.map(form =>
        form.querySelector('input[name="reason"]')?.getAttribute('value')
      )
    ).toEqual(['resolved', 'hide-similar']);
    expect(
      forms.map(form => form.querySelector('button')?.textContent?.trim())
    ).toEqual(['Resolved', 'Hide like this']);
  });

  it('offers to bring an archived conversation back, and says why it went', () => {
    const row = render(mailboxListForTest(['a@example.com'], 'hide-similar'));
    const forms = row.querySelectorAll('td.mailbox__actions form');

    expect(forms).toHaveLength(1);
    expect(forms[0].getAttribute('action')).toBe(
      '/mailbox/unarchive?next=%2Fmailbox'
    );
    expect(forms[0].querySelector('button')?.textContent?.trim()).toBe(
      'Unarchive'
    );
    expect(row.querySelector('.mailbox__filtered')?.textContent?.trim()).toBe(
      'Archived: Hide like this'
    );
  });
});

// Reading the conversation is when the decision gets made, so the same
// buttons are there - and they are not the hover-hidden kind, which only
// applies inside the table.
describe('archiving from the conversation itself', () => {
  it('offers the same reasons, and returns to the list once dealt with', () => {
    const forms = [
      ...render(mailboxConversationActionsForTest()).querySelectorAll(
        'form.mailbox__action'
      ),
    ];

    expect(forms.map(form => form.getAttribute('action'))).toEqual([
      '/mailbox/archive?next=%2Fmailbox',
      '/mailbox/archive?next=%2Fmailbox',
    ]);
    expect(
      forms.map(form =>
        form.querySelector('input[name="reason"]')?.getAttribute('value')
      )
    ).toEqual(['resolved', 'hide-similar']);
    expect(
      render(mailboxConversationActionsForTest()).querySelector('.mailbox-table')
    ).toBeNull();
  });

  it('says where an archived conversation stands, and stays put when it is brought back', () => {
    const block = render(mailboxConversationActionsForTest('resolved'));
    const forms = block.querySelectorAll('form.mailbox__action');

    expect(block.querySelector('.mailbox__filtered')?.textContent?.trim()).toBe(
      'Archived: Resolved'
    );
    expect(forms).toHaveLength(1);
    expect(forms[0].getAttribute('action')).toBe(
      '/mailbox/unarchive?next=%2Fmailbox%2Fc1'
    );
  });
});

describe('the archived notice', () => {
  it('says so when nothing is archived, with no link to an identical view', () => {
    expect(text(mailboxArchivedNoticeForTest(0, false))).toBe(
      'No conversations are archived.'
    );
    expect(
      render(mailboxArchivedNoticeForTest(0, false)).querySelector('a')
    ).toBeNull();
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
