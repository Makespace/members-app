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

// The buttons a row currently offers: those in whichever state is showing.
const offered = (row: HTMLElement) => [
  ...row.querySelectorAll(
    'td.mailbox__actions .mailbox__state:not([hidden]) form'
  ),
];

describe('archiving from the mailbox list', () => {
  it('gives a live row one button per reason, each posting back to the page', () => {
    const forms = offered(render(mailboxListForTest(['a@example.com'])));

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
    // Icons, with the meaning on hover and for a screen reader.
    expect(
      forms.map(form => form.querySelector('button')?.getAttribute('title'))
    ).toEqual([
      'Resolved - no further action needed',
      'Hide mail like this in future',
    ]);
    expect(
      forms.map(form => form.querySelector('button')?.getAttribute('aria-label'))
    ).toEqual([
      'Resolved - no further action needed',
      'Hide mail like this in future',
    ]);
    expect(
      forms.map(form => form.querySelector('button i')?.getAttribute('class'))
    ).toEqual(['fa-regular fa-circle-check', 'fa-regular fa-eye-slash']);
  });

  it('offers to bring an archived conversation back, and says why it went', () => {
    const row = render(mailboxListForTest(['a@example.com'], 'hide-similar'));
    const forms = offered(row);

    expect(forms).toHaveLength(1);
    expect(forms[0].getAttribute('action')).toBe(
      '/mailbox/unarchive?next=%2Fmailbox'
    );
    expect(forms[0].querySelector('button')?.getAttribute('title')).toBe(
      'Bring this conversation back'
    );
    expect(forms[0].querySelector('button i')?.getAttribute('class')).toBe(
      'fa-regular fa-folder-open'
    );
    expect(row.querySelector('.mailbox__filtered')?.textContent?.trim()).toBe(
      'Archived: Hide like this'
    );
  });
});

// A row is marked by its colour, wherever it is shown, and pressing a
// button marks it in place. Each button says what the row becomes.
describe('how a row is marked', () => {
  const rowOf = (markup: string) => render(markup).querySelector('tr');

  it('is plain until something is done to it', () => {
    const row = rowOf(mailboxListForTest(['a@example.com']));

    expect(row?.getAttribute('class')).toBe('');
    expect(
      row?.querySelector('.mailbox__archived-mark')?.hasAttribute('hidden')
    ).toBe(true);
  });

  it('is green once resolved', () => {
    expect(
      rowOf(mailboxListForTest(['a@example.com'], 'resolved'))?.getAttribute(
        'class'
      )
    ).toBe('mailbox-row--resolved');
  });

  it('is yellow when put out of sight by hand', () => {
    expect(
      rowOf(mailboxListForTest(['a@example.com'], 'hide-similar'))?.getAttribute(
        'class'
      )
    ).toBe('mailbox-row--hidden');
  });

  it('is yellow when put out of sight by a rule, and remembers that', () => {
    const row = rowOf(
      mailboxListForTest(['a@example.com'], undefined, {
        id: 'amazon-order-updates',
        reason: 'Amazon order and delivery notice',
      })
    );

    expect(row?.getAttribute('class')).toBe('mailbox-row--hidden');
    expect(row?.getAttribute('data-filtered')).toBe('1');
  });

  it('tells each button what the row becomes when it is pressed', () => {
    const buttons = [
      ...render(mailboxListForTest(['a@example.com'])).querySelectorAll(
        '[data-state="live"] button'
      ),
    ];

    expect(
      buttons.map(button => [
        button.getAttribute('data-row-class'),
        button.getAttribute('data-mark'),
      ])
    ).toEqual([
      ['mailbox-row--resolved', 'Archived: Resolved'],
      ['mailbox-row--hidden', 'Archived: Hide like this'],
    ]);
  });

  it('keeps both states of the cell ready, one hidden', () => {
    const live = render(mailboxListForTest(['a@example.com']));
    const archived = render(mailboxListForTest(['a@example.com'], 'resolved'));

    expect(
      live.querySelector('[data-state="archived"]')?.hasAttribute('hidden')
    ).toBe(true);
    expect(
      archived.querySelector('[data-state="live"]')?.hasAttribute('hidden')
    ).toBe(true);
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
