/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/trouble-tickets/render';
import {
  TroubleTicketView,
  ViewModel,
} from '../../../src/queries/trouble-tickets/view-model';
import {TroubleTicketStatus} from '../../../src/types/trouble-ticket';

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

const viewModel = (tickets: ReadonlyArray<TroubleTicketView>): ViewModel => ({
  focus: O.none,
  tickets,
  scopedToMine: false,
  totalInScope: tickets.length,
  statusCounts: {
    Todo: 0,
    'In Progress': 0,
    Resolved: 0,
    Parked: 0,
    'Needs Help': 0,
  },
  scopeCounts: {},
  activeStatus: O.none,
  activeScope: O.none,
  page: 1,
  pageCount: 1,
  unresolvedEquipmentNames: [],
  canMapEquipment: false,
});

// render returns an Html string, not a page document.
const renderBoard = (vm: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(vm);
  return body;
};

// A ticket raised from the mailbox is one step removed from the email that
// prompted it, where the sender's own words and any reply live.
describe('where a ticket came from', () => {
  const cardFor = (overrides: Partial<TroubleTicketView>) =>
    renderBoard(viewModel([{...ticket(), ...overrides}]));

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

// Opened from a machine, the page says so and offers the way back out.
// An owner reading a ticket usually wants to know who this is and what else
// they are trained on, which is one click away if the name is a link.
describe('who submitted a ticket', () => {
  const cardFor = (overrides: Partial<TroubleTicketView>) => {
    const body = document.createElement('body');
    body.innerHTML = render(viewModel([{...ticket(), ...overrides}]));
    return body;
  };

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

describe('the board pointed at one machine', () => {
  const focused = {
    kind: 'equipment' as const,
    id: 'eeeeeeee-0000-0000-0000-000000000001',
    slug: 'wood-shop-band-saw',
    name: 'Band Saw',
    areaName: O.some('Wood Shop'),
    areaId: O.some('aaaaaaaa-0000-0000-0000-000000000001'),
    areaSlug: O.some('wood-shop'),
  };

  const page = (tickets: ReadonlyArray<TroubleTicketView>) => {
    const body = document.createElement('body');
    body.innerHTML = render({...viewModel(tickets), focus: O.some(focused)});
    return body;
  };

  it('names the machine in the heading', () => {
    expect(page([]).querySelector('h1')?.textContent).toContain('Band Saw');
  });

  it('offers the area and everything as ways to widen', () => {
    const links = [...page([]).querySelectorAll('.tt-focus a')].map(
      node => node.getAttribute('href') ?? ''
    );

    expect(links).toContain('/trouble-tickets/board?areaId=wood-shop');
    // "All tickets" means all of them, not the viewer's own areas.
    expect(links).toContain('/trouble-tickets/board?show=all');
  });

  it('keeps the machine when a status filter is clicked', () => {
    const chips = [...page([]).querySelectorAll('.tt-filters a')].map(
      node => node.getAttribute('href') ?? ''
    );

    expect(chips.length).toBeGreaterThan(0);
    for (const href of chips) {
      expect(href).toContain('equipmentId=wood-shop-band-saw');
    }
  });

  // The unmatched form names are about the whole backlog; someone looking at
  // one machine did not ask about them.
  it('leaves the unresolved-names panel out of a focused view', () => {
    const body = document.createElement('body');
    body.innerHTML = render({
      ...viewModel([]),
      focus: O.some(focused),
      canMapEquipment: true,
      unresolvedEquipmentNames: [{raw: 'bandsaw', count: 3}],
    });

    expect(body.textContent).not.toContain('Unresolved equipment names');
  });

  // Somebody who scanned a machine and found nothing wrong with it should
  // still be able to look wider, so the filters stay on an empty board.
  it('still offers the filters when the machine has no tickets', () => {
    expect(page([]).querySelectorAll('.tt-filters a').length).toBeGreaterThan(
      0
    );
  });
});

// Nothing on the card sends an email. Every change goes through its
// confirmation page, which says who will be emailed and what it will say -
// the one-click "resolve silently" went round that, and is gone.
describe('/trouble-tickets board actions', () => {
  it('offers no one-click resolve; every action goes through its page', () => {
    const dom = renderBoard(viewModel([ticket()]));

    expect(dom.querySelector('form.tt-quiet-resolve')).toBeNull();
    expect(dom.querySelectorAll('form')).toHaveLength(0);
    expect(
      dom.querySelector('a[href^="/trouble-tickets/resolve?"]')
    ).not.toBeNull();
  });

  it('says on each action who it will email', () => {
    const hints = [
      ...renderBoard(
        viewModel([ticket({status: 'In Progress'})])
      ).querySelectorAll('a.tt-action'),
    ].map(link => link.getAttribute('title') ?? '');

    expect(hints.length).toBeGreaterThan(0);
    for (const hint of hints) {
      expect(hint).toMatch(/^Emails the submitter/);
    }
    expect(hints).toContain("Emails the submitter and the machine's trainers");
  });

  it('offers no actions on a resolved ticket, nor to a viewer who cannot act', () => {
    expect(
      renderBoard(viewModel([ticket({status: 'Resolved'})])).querySelector(
        'a.tt-action'
      )
    ).toBeNull();
    expect(
      renderBoard(viewModel([ticket({canChangeStatus: false})])).querySelector(
        'a.tt-action'
      )
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
    renderBoard(viewModel([ticket({changeLog: [entry(over)]})])).querySelector(
      '.tt-emailed'
    );

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

