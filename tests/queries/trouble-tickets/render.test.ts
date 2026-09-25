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

// Opened from a machine, the page says so and offers the way back out.
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

describe('/trouble-tickets board actions', () => {
  const silentForm = (dom: HTMLElement) =>
    dom.querySelector<HTMLFormElement>('form.tt-quiet-resolve');

  it.each(['Todo', 'In Progress', 'Needs Help', 'Parked'] as const)(
    'offers a one-click silent resolve on a %s ticket',
    status => {
      const dom = renderBoard(viewModel([ticket({status})]));
      const form = silentForm(dom);
      expect(form).not.toBeNull();
      expect(form?.getAttribute('action')).toBe(
        '/trouble-tickets/resolve?next=/trouble-tickets/board'
      );
      expect(form?.getAttribute('method')).toBe('post');
    }
  );

  it('posts the ticket id with quiet set and no summary, so nobody is emailed', () => {
    const subject = ticket();
    const form = silentForm(renderBoard(viewModel([subject])));
    const values = Object.fromEntries(
      [
        ...(form?.querySelectorAll<HTMLInputElement>(
          'input[type="hidden"]'
        ) ?? []),
      ].map(input => [input.name, input.value])
    );
    expect(values).toStrictEqual({
      ticketId: subject.id,
      quiet: 'on',
      summary: '',
    });
  });

  it('says what it does, so it is not confused with the ordinary Resolve', () => {
    const dom = renderBoard(viewModel([ticket()]));
    expect(silentForm(dom)?.textContent).toContain('Resolve silently');
    expect(silentForm(dom)?.textContent).toContain(
      'without emailing the submitter'
    );
    // The ordinary Resolve, which opens the confirmation page, is still there.
    expect(
      dom.querySelector('a[href^="/trouble-tickets/resolve?"]')
    ).not.toBeNull();
  });

  it('is not offered on a resolved ticket, nor to a viewer who cannot act', () => {
    expect(
      silentForm(renderBoard(viewModel([ticket({status: 'Resolved'})])))
    ).toBeNull();
    expect(
      silentForm(renderBoard(viewModel([ticket({canChangeStatus: false})])))
    ).toBeNull();
  });
});
