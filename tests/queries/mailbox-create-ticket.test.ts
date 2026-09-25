/**
 * @jest-environment jsdom
 */
import {mailboxConversationActionsForTest} from '../../src/queries/mailbox/index';
import {createTicketForm} from '../../src/commands/mailbox/create-ticket-form';

const render = (markup: string) => {
  const body = document.createElement('body');
  body.innerHTML = markup;
  return body;
};

describe('creating a ticket from the conversation page', () => {
  it('offers a button to the create-ticket page for this conversation', () => {
    const link = render(mailboxConversationActionsForTest()).querySelector(
      'a.button'
    );

    expect(link?.textContent?.trim()).toBe('Create a ticket');
    expect(link?.getAttribute('href')).toBe(
      '/mailbox/create-ticket?conversationId=c1'
    );
  });

  it('lists the tickets already raised from it, linking to the board', () => {
    const block = render(
      mailboxConversationActionsForTest(undefined, [
        {title: 'Laser cutter grinding', status: 'Todo'},
      ])
    ).querySelector('.mailbox__linked-tickets');

    expect(block?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Raised from this conversation: Laser cutter grinding Todo'
    );
    expect(block?.querySelector('a')?.getAttribute('href')).toBe(
      '/trouble-tickets/board?areaId=management-team'
    );
  });

  it('says nothing about tickets when there are none', () => {
    expect(
      render(mailboxConversationActionsForTest()).querySelector(
        '.mailbox__linked-tickets'
      )
    ).toBeNull();
  });
});

describe('the create-ticket page', () => {
  const page = render(
    createTicketForm.renderForm({
      conversationId: 'first-message',
      subject: 'Laser cutter grinding',
      sender: '"A Member" <member@example.com>',
      body: 'The gantry made a grinding noise.',
      existing: [],
    }).body
  );

  it('is filled in from the email, ready to edit', () => {
    expect(
      page.querySelector('input[name="title"]')?.getAttribute('value')
    ).toBe('Laser cutter grinding');
    expect(page.querySelector('textarea[name="issue"]')?.textContent).toBe(
      'The gantry made a grinding noise.'
    );
    expect(page.textContent).toContain('"A Member" <member@example.com>');
  });

  it('posts for this conversation and returns to it', () => {
    const form = page.querySelector('form');

    expect(form?.getAttribute('action')).toBe(
      '/mailbox/create-ticket?next=%2Fmailbox%2Ffirst-message'
    );
    expect(
      form?.querySelector('input[name="conversationId"]')?.getAttribute('value')
    ).toBe('first-message');
  });

  it('warns when the conversation has already led to a ticket', () => {
    const warned = render(
      createTicketForm.renderForm({
        conversationId: 'first-message',
        subject: 'Laser cutter grinding',
        sender: 'member@example.com',
        body: '',
        existing: [{title: 'Laser cutter grinding', status: 'In Progress'}],
      }).body
    );

    expect(warned.textContent?.replace(/\s+/g, ' ')).toContain(
      'Already raised from this conversation: Laser cutter grinding (In Progress)'
    );
  });
});
