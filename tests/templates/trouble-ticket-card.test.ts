/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {ticketCard} from '../../src/templates/trouble-ticket-card';
import {TroubleTicketView} from '../../src/queries/trouble-tickets/view-model';
import {TroubleTicketStatus} from '../../src/types/trouble-ticket';

// The card is how a ticket is drawn on its own page, with everything the
// board's one-line row leaves out: the form's answers, the change log and
// the actions.
const ticket = (
  overrides: Partial<TroubleTicketView> = {}
): TroubleTicketView => ({
  id: faker.string.uuid() as UUID,
  title: 'Bandsaw is making a noise',
  status: 'Todo' as TroubleTicketStatus,
  submittedAt: new Date('2026-09-01T10:00:00.000Z'),
  submittedName: 'Sam Submitter',
  submittedMemberNumber: 42,
  submittedEmail: 'sam@example.com',
  mailboxConversationId: null,
  equipmentName: O.some('Bandsaw'),
  equipmentCategory: O.some('red' as const),
  areaName: O.some('Wood Shop'),
  rawEquipment: 'Bandsaw',
  response: {
    otherEquipmentDetail: '',
    status: 'Broken',
    attempting: 'cutting',
    issue: 'noise',
    steps: '',
  },
  assignees: [],
  assignedToMe: false,
  inMyOwnerArea: true,
  onMyTrainerMachine: false,
  canChangeStatus: true,
  changeLog: [],
  ...overrides,
});

// ticketCard returns an Html string, not a page document.
const renderCard = (view: TroubleTicketView) => {
  const body = document.createElement('body');
  body.innerHTML = ticketCard(view);
  return body;
};

// A ticket raised from the mailbox is one step removed from the email that
// prompted it, where the sender's own words and any reply live.
describe('where a ticket came from', () => {
  const cardFor = (overrides: Partial<TroubleTicketView>) =>
    renderCard(ticket(overrides));

  it('links a ticket raised from the mailbox back to its conversation', () => {
    const link = cardFor({
      mailboxConversationId: 'first-message',
    }).querySelector('a[href^="/mailbox/"]');

    expect(link?.getAttribute('href')).toBe('/mailbox/first-message');
    expect(link?.textContent?.trim()).toBe('an email in the mailbox');
  });

  it('says nothing of the mailbox for a ticket raised any other way', () => {
    const card = cardFor({mailboxConversationId: null});

    expect(card.querySelector('a[href^="/mailbox/"]')).toBeNull();
    expect(card.textContent).not.toContain('Raised from');
  });
});

// An owner reading a ticket usually wants to know who this is and what else
// they are trained on, which is one click away if the name is a link.
describe('who submitted a ticket', () => {
  const cardFor = (overrides: Partial<TroubleTicketView>) =>
    renderCard(ticket(overrides));

  it('links a matched member to their record, by name and by number', () => {
    const links = [
      ...cardFor({
        submittedName: 'Sam Submitter',
        submittedMemberNumber: 42,
      }).querySelectorAll('a[href="/member/42"], a[href="/member/42/"]'),
    ].map(node => (node.textContent ?? '').trim());

    expect(links).toContain('Sam Submitter');
    expect(links).toContain('42');
  });

  it('leaves what they typed as plain text when nobody matched', () => {
    const card = cardFor({
      submittedName: 'Someone Unmatched',
      submittedMemberNumber: null,
    });

    expect(card.textContent).toContain('Someone Unmatched');
    expect(card.querySelector('a[href^="/member/"]')).toBeNull();
  });

  it('falls back to the address when there is no name', () => {
    const card = cardFor({
      submittedName: null,
      submittedEmail: 'someone@example.com',
      submittedMemberNumber: 42,
    });

    expect(
      card.querySelector('a[href="/member/42"]')?.textContent?.trim()
    ).toBe('someone@example.com');
  });

  it('says so when the form carried nothing at all', () => {
    expect(
      cardFor({
        submittedName: null,
        submittedEmail: null,
        submittedMemberNumber: null,
      }).textContent
    ).toContain('Not provided');
  });
});

// Nothing on the card sends an email. Every change goes through its
// confirmation page, which says who will be emailed and what it will say -
// the one-click "resolve silently" went round that, and is gone.
describe('trouble ticket card actions', () => {
  it('offers no one-click resolve; every action goes through its page', () => {
    const dom = renderCard(ticket());

    expect(dom.querySelector('form.tt-quiet-resolve')).toBeNull();
    expect(dom.querySelectorAll('form')).toHaveLength(0);
    expect(
      dom.querySelector('a[href^="/trouble-tickets/resolve?"]')
    ).not.toBeNull();
  });

  it('says on each action who it will email', () => {
    const hints = [
      ...renderCard(ticket({status: 'In Progress'})).querySelectorAll(
        'a.tt-action'
      ),
    ].map(link => link.getAttribute('title') ?? '');

    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) {
      expect(hint).toMatch(/^Emails the submitter/);
    }
    expect(hints).toContain("Emails the submitter and the machine's trainers");
  });

  it('offers no actions on a resolved ticket, nor to a viewer who cannot act', () => {
    expect(
      renderCard(ticket({status: 'Resolved'})).querySelector('a.tt-action')
    ).toBeNull();
    expect(
      renderCard(ticket({canChangeStatus: false})).querySelector('a.tt-action')
    ).toBeNull();
  });
});

// The change log says who was told about each change, so nobody has to
// wonder whether an email went out or to whom.
describe('what the change log says about emails', () => {
  const entry = (over: Partial<TroubleTicketView['changeLog'][number]>) => ({
    at: new Date('2026-09-02T10:00:00.000Z'),
    actor: 'Tara Trainer',
    summary: 'marked this ticket as Resolved',
    details: [],
    status: 'Resolved' as TroubleTicketStatus,
    emailedTo: null,
    quiet: false,
    ...over,
  });

  const logOf = (over: Partial<TroubleTicketView['changeLog'][number]>) =>
    renderCard(ticket({changeLog: [entry(over)]})).querySelector('.tt-emailed');

  it('names who was emailed', () => {
    expect(logOf({emailedTo: ['sam@example.com']})?.textContent?.trim()).toBe(
      'Emailed sam@example.com'
    );
  });

  it('says when nobody could be emailed', () => {
    expect(logOf({emailedTo: []})?.textContent?.trim()).toBe(
      'No email sent: nobody had a usable address.'
    );
  });

  it('says when a resolve was quiet by choice', () => {
    expect(logOf({emailedTo: null, quiet: true})?.textContent?.trim()).toBe(
      'No email sent: resolved quietly.'
    );
  });

  it('says nothing while an email is still to be sent', () => {
    expect(logOf({emailedTo: null, quiet: false})).toBeNull();
  });
});
