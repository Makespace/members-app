/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/admin/render';
import {ViewModel} from '../../../src/queries/admin/construct-view-model';

const now = new Date('2026-10-29T12:00:00Z');

const superUser: ViewModel = {isSuperUser: true, ownedAreas: [], now};

const woodShop: ViewModel['ownedAreas'][number] = {
  id: 'area-1',
  name: 'Wood Shop',
  purchasingAreaId: O.some('purchasing-1' as UUID),
  openTickets: 3,
  trainerOn: [
    {
      id: 'saw-1',
      name: 'Band Saw',
      openTickets: 1,
      upcomingTrainings: 2,
      waiting: 4,
      longestWaitingSince: O.some(new Date('2026-08-01T12:00:00Z')),
      trainingsByQuarter: [],
    },
  ],
};

const pageFor = (viewModel: Omit<ViewModel, 'now'>) => {
  const body = document.createElement('body');
  body.innerHTML = render({...viewModel, now});
  return body;
};

const page = () => pageFor(superUser);

const hrefs = (body: HTMLElement) =>
  [...body.querySelectorAll('a')].map(a => a.getAttribute('href'));

describe('the admin page', () => {
  it('groups its links under headings rather than one long column', () => {
    const headings = [...page().querySelectorAll('h2')].map(h =>
      h.textContent?.trim()
    );
    expect(headings).toEqual([
      'Members',
      'Membership payments',
      'Equipment and areas',
      'Trouble tickets and member email',
      'The event log',
    ]);
  });

  it('puts every link inside a section', () => {
    const inSections = page().querySelectorAll('section nav ul li a').length;
    const all = page().querySelectorAll('a').length;
    expect(inSections).toBe(all);
  });

  // Easy to break by hand-writing anchors: the old page had two links whose
  // closing tag was missing, which swallowed everything after them.
  it('closes every link it opens', () => {
    const html = render({...superUser, ownedAreas: [woodShop]});
    expect((html.match(/<a[\s>]/g) ?? []).length).toBe(
      (html.match(/<\/a\s*>/g) ?? []).length
    );
  });

  it.each([
    ['/outstanding-invoices'],
    ['/equipment-links'],
    ['/unlinked-recurly'],
    ['/mailbox'],
    ['/event-log'],
  ])('links to %s', href => {
    expect(page().querySelector(`a[href="${href}"]`)).not.toBeNull();
  });
});

describe('the owner page', () => {
  it('shows an owner their area, and none of the admin links', () => {
    const body = pageFor({isSuperUser: false, ownedAreas: [woodShop]});

    expect(body.querySelector('h1')?.textContent?.trim()).toBe('Owner');
    expect(body.textContent).toContain("You're an owner in this area.");
    expect(hrefs(body)).toStrictEqual([
      '/trouble-tickets/board?areaId=area-1',
      '/purchasing-areas/purchasing-1',
      '/areas/manage?area=area-1',
      '/trouble-tickets/board?equipmentId=saw-1',
      '/equipment/saw-1/trainings',
      '/equipment/saw-1',
    ]);
    expect(body.textContent).not.toContain('super-user privileges');
  });

  it('names the machines they train on under the area', () => {
    const body = pageFor({isSuperUser: false, ownedAreas: [woodShop]});

    const machine = body.querySelector('.owner-ledger__row--machine');
    expect(machine?.querySelector('strong')?.textContent?.trim()).toBe(
      'Band Saw'
    );
    expect(machine?.textContent).toContain(
      "You're a trainer on this equipment."
    );
  });

  // One row per machine, each the same shape, so they compare down the page.
  it('lines up the numbers worth knowing in the same columns', () => {
    const body = pageFor({isSuperUser: false, ownedAreas: [woodShop]});
    const numbers = (row: Element | null) =>
      [...(row?.querySelectorAll('.owner-ledger__number') ?? [])].map(cell =>
        (cell.textContent ?? '').replace(/\s+/g, ' ').trim()
      );

    expect(numbers(body.querySelector('.owner-ledger__row--area'))).toStrictEqual(
      ['3 open tickets', '', '', '']
    );
    expect(
      numbers(body.querySelector('.owner-ledger__row--machine'))
    ).toStrictEqual([
      '1 open ticket',
      '4 waiting longest 2 months',
      '2 upcoming trainings',
    ]);
  });

  it('keeps links as text, not buttons', () => {
    const body = pageFor({isSuperUser: false, ownedAreas: [woodShop]});
    expect(body.querySelectorAll('.owner-ledger .button')).toHaveLength(0);
  });

  it('leaves out purchasing for an area outside any purchasing area', () => {
    const body = pageFor({
      isSuperUser: false,
      ownedAreas: [{...woodShop, purchasingAreaId: O.none}],
    });

    expect(body.textContent).not.toContain('View purchasing');
  });

  it("puts a super-user's admin links below their own areas", () => {
    const headings = [
      ...pageFor({isSuperUser: true, ownedAreas: [woodShop]}).querySelectorAll(
        'h1'
      ),
    ].map(h => h.textContent?.trim());

    expect(headings).toStrictEqual(['Owner', 'Admin']);
  });
});
