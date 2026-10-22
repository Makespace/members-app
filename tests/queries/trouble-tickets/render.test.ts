/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/trouble-tickets/render';
import {
  BoardTicketView,
  ViewModel,
} from '../../../src/queries/trouble-tickets/view-model';
import {TroubleTicketStatus} from '../../../src/types/trouble-ticket';

const ticket = (overrides: Partial<BoardTicketView> = {}): BoardTicketView => ({
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
  managementOnly: false,
  canChangeStatus: true,
  canAssignOthers: false,
  ...overrides,
});

const viewModel = (tickets: ReadonlyArray<BoardTicketView>): ViewModel => ({
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
  openCount: 0,
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

// The board is for taking in a lot of tickets at once: one row each, with
// the details and the actions a click away on the ticket's own page.
describe('the board as a table', () => {
  const rowsOf = (tickets: ReadonlyArray<BoardTicketView>) => [
    ...renderBoard(viewModel(tickets)).querySelectorAll('tbody tr'),
  ];

  it('gives each ticket one row', () => {
    expect(rowsOf([ticket(), ticket(), ticket()])).toHaveLength(3);
  });

  it("links each ticket's title to its own page", () => {
    const view = ticket({title: 'Lathe chuck stuck'});
    const link = rowsOf([view])[0].querySelector(
      'a[href^="/trouble-tickets/view/"]'
    );

    expect(link?.getAttribute('href')).toBe(`/trouble-tickets/view/${view.id}`);
    expect(link?.textContent?.trim()).toBe('Lathe chuck stuck');
  });

  it('shows the status, the machine and its area, and who is on it', () => {
    const [row] = rowsOf([
      ticket({
        status: 'In Progress',
        assignees: [{memberNumber: 7, name: O.some('Tara Trainer')}],
      }),
    ]);

    expect(row.querySelector('.tt-status')?.textContent?.trim()).toBe(
      'In Progress'
    );
    expect(row.querySelector('[data-label="Where"]')?.textContent).toMatch(
      /Bandsaw\s*Wood Shop/
    );
    expect(
      row.querySelector('[data-label="Assigned"]')?.textContent?.trim()
    ).toBe('Tara Trainer');
  });

  it('includes the issue, so a ticket can be recognised without opening it', () => {
    expect(rowsOf([ticket()])[0].textContent).toContain('noise');
  });

  it('marks each row with its status, so resolved ones can step back', () => {
    const [open, resolved] = rowsOf([
      ticket({status: 'Todo'}),
      ticket({status: 'Resolved'}),
    ]);

    expect(open.classList).toContain('tt-row--todo');
    expect(resolved.classList).toContain('tt-row--resolved');
  });

  it('says what the form said when no machine or area matched', () => {
    const where = rowsOf([
      ticket({
        equipmentName: O.none,
        equipmentCategory: O.none,
        areaName: O.none,
        rawEquipment: 'the big saw',
      }),
    ])[0].querySelector('[data-label="Where"]');

    expect(where?.textContent).toContain('Unassigned');
    expect(where?.textContent).toContain('the big saw');
  });

  it('still gives an untitled ticket something to click', () => {
    expect(
      rowsOf([ticket({title: ''})])[0]
        .querySelector('a[href^="/trouble-tickets/view/"]')
        ?.textContent?.trim()
    ).toBe('Untitled ticket');
  });

  it('marks a management-only ticket as private, and no other', () => {
    const [privateRow, ordinaryRow] = rowsOf([
      ticket({managementOnly: true}),
      ticket({managementOnly: false}),
    ]);

    expect(privateRow.querySelector('.tt-private')?.textContent?.trim()).toBe(
      'Management only'
    );
    expect(ordinaryRow.querySelector('.tt-private')).toBeNull();
  });

  // Housekeeping for whoever maps aliases, so it waits below the tickets.
  it('puts the unresolved equipment names below the table', () => {
    const board = renderBoard({
      ...viewModel([ticket()]),
      canMapEquipment: true,
      unresolvedEquipmentNames: [{raw: 'bandsaw', count: 3}],
    });
    const table = board.querySelector('table');
    const panel = [...board.querySelectorAll('details')].find(node =>
      (node.textContent ?? '').includes('Unresolved equipment names')
    );

    expect(panel).toBeDefined();
    expect(
      table!.compareDocumentPosition(panel!) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  // The actions go through the ticket's own page, which says who each one
  // will email; the board is for finding the ticket.
  it('leaves the actions to the ticket page', () => {
    expect(
      renderBoard(viewModel([ticket()])).querySelector('a.tt-action')
    ).toBeNull();
  });
});

// "Which tickets still need doing" is the question most people arrive with.
describe('the Open filter', () => {
  const chip = (vm: ViewModel) =>
    [...renderBoard(vm).querySelectorAll('.tt-filters a')].find(node =>
      (node.textContent ?? '').trim().startsWith('Open')
    );

  it('counts every ticket that is not resolved', () => {
    expect(
      chip({...viewModel([ticket()]), openCount: 4})
        ?.querySelector('.tt-badge__count')
        ?.textContent?.trim()
    ).toBe('4');
  });

  it('links to status=open, keeping the rest of the view', () => {
    expect(chip(viewModel([ticket()]))?.getAttribute('href')).toBe(
      '/trouble-tickets/board?show=all&status=open'
    );
  });

  it('clears itself when clicked while active', () => {
    const active = chip({
      ...viewModel([ticket()]),
      activeStatus: O.some('Open'),
    });

    expect(active?.classList).toContain('tt-filter__label--active');
    expect(active?.getAttribute('href')).toBe(
      '/trouble-tickets/board?show=all'
    );
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

  const page = (tickets: ReadonlyArray<BoardTicketView>) => {
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
