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
  tickets,
  scopedToMine: false,
  totalInScope: tickets.length,
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

describe('/trouble-tickets board actions', () => {
  const silentForm = (dom: HTMLElement) =>
    dom.querySelector<HTMLFormElement>('form.tt-quiet-resolve');

  it.each(['Todo', 'In Progress', 'Needs Help', 'Parked'] as const)(
    'offers a one-click silent resolve on a %s ticket',
    status => {
      const dom = renderBoard(viewModel([ticket({status})]));
      const form = silentForm(dom);
      expect(form).not.toBeNull();
      expect(form?.getAttribute('action')).toBe('/trouble-tickets/resolve');
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
