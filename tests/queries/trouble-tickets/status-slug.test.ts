/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {statusFromSlug} from '../../../src/queries/trouble-tickets/status-slug';
import {TroubleTicketStatus} from '../../../src/types/trouble-ticket';
import {render} from '../../../src/queries/trouble-tickets/render';
import {ViewModel} from '../../../src/queries/trouble-tickets/view-model';

const STATUSES: ReadonlyArray<TroubleTicketStatus> = [
  'Todo',
  'In Progress',
  'Needs Help',
  'Parked',
  'Resolved',
];

const emptyBoard = (): ViewModel => ({
  focus: O.none,
  tickets: [],
  scopedToMine: false,
  totalInScope: 0,
  statusCounts: {
    Todo: 0,
    'In Progress': 0,
    'Needs Help': 0,
    Parked: 0,
    Resolved: 0,
  },
  scopeCounts: {mine: 0, 'my-area': 0, 'my-machines': 0},
  activeStatus: O.none,
  activeScope: O.none,
  page: 1,
  pageCount: 1,
  unresolvedEquipmentNames: [],
  canMapEquipment: false,
});

describe('the status in a board URL', () => {
  it.each(STATUSES)('reads %s back from the slug it is written as', status => {
    const body = document.createElement('body');
    body.innerHTML = render({...emptyBoard(), activeStatus: O.some(status)});

    // The chip that clears this filter is the one for the active status, so
    // find the status through every chip and check one round-trips.
    const hrefs = [...body.querySelectorAll('.tt-filters a')].map(
      node => node.getAttribute('href') ?? ''
    );
    const written = hrefs
      .map(href => new URLSearchParams(href.split('?')[1] ?? '').get('status'))
      .filter((value): value is string => value !== null);

    expect(
      written.map(value => statusFromSlug(value)).filter(O.isSome)
    ).toHaveLength(written.length);
  });

  // The chips write "in-progress"; the board used to read only "In Progress",
  // so clicking a filter quietly did nothing.
  it.each([
    ['todo', 'Todo'],
    ['in-progress', 'In Progress'],
    ['needs-help', 'Needs Help'],
    ['parked', 'Parked'],
    ['resolved', 'Resolved'],
  ])('reads %s as %s', (slug, status) => {
    expect(statusFromSlug(slug)).toStrictEqual(O.some(status));
  });

  it.each(STATUSES)('still reads %s written out, for older links', status => {
    expect(statusFromSlug(status)).toStrictEqual(O.some(status));
  });

  // A URL that has been through a chat client or a spreadsheet arrives with
  // odd spacing and casing; the filter is not worth losing over it.
  it.each(['  todo', 'IN-PROGRESS', 'in progress '])(
    'forgives %p',
    value => {
      expect(O.isSome(statusFromSlug(value))).toBe(true);
    }
  );

  it.each(['', 'nonsense', 'to-do'])(
    'ignores %p, which is not a status',
    value => {
      expect(statusFromSlug(value)).toStrictEqual(O.none);
    }
  );
});
