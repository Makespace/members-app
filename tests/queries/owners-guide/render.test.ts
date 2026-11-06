/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/owners-guide/render';
import {
  loggedOut,
  ViewModel,
  YourAreas,
} from '../../../src/queries/owners-guide/construct-view-model';
import {PurchasingAreaPurchaser} from '../../../src/read-models/shared-state/return-types';

const pat: PurchasingAreaPurchaser = {
  userId: 'user-1' as never,
  memberNumber: 1234,
  pastMemberNumbers: [],
  name: O.some('Pat Purchaser'),
  primaryEmailAddress: 'pat@example.com' as never,
  addedAt: new Date('2026-01-01'),
  isOwnerOfAnArea: true,
};

const workshops = {
  id: 'pa-1' as UUID,
  name: 'Workshops',
  yourAreas: ['Metal Shop', 'Wood Shop'],
  active: true,
  yearlyBudgetPence: 100_000,
  remainingPence: 65_000,
  purchasesThisYear: 3,
  spentByMonthPence: [0, 20_000, 15_000, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  purchasers: [pat],
};

const as = (yours: YourAreas): ViewModel => ({reader: O.some(yours)});

const sectionFor = (viewModel: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(viewModel);
  return body.querySelector('#purchasing')!;
};

const purchasingSection = (yours: YourAreas) => sectionFor(as(yours));

const text = (element: Element | null | undefined) =>
  element?.textContent?.replace(/\s+/g, ' ').trim();

const cells = (row: Element | null | undefined) =>
  [...(row?.querySelectorAll('td') ?? [])].map(text);

const withWorkshops: YourAreas = {
  monthNow: 4,
  purchasingAreas: [workshops],
  withoutPurchasingArea: [],
};

describe("the owner's guide's Purchase Areas", () => {
  it('gives each with your areas in it, its Purchasers and what is left', () => {
    const row = purchasingSection(withWorkshops).querySelector('tbody tr');

    expect(cells(row)).toStrictEqual([
      'Workshops Your areas: Metal Shop, Wood Shop',
      '3 purchases January: £0 February: £200 March: £150 April: £0',
      '£650 left of £1,000',
    ]);
    expect(row?.querySelector('a')?.getAttribute('href')).toBe(
      '/purchasing-areas/pa-1'
    );
  });

  it('shows how much of the budget is spent', () => {
    const bar = purchasingSection(withWorkshops).querySelector(
      '.owners-guide__bar-spent'
    );

    expect(bar?.getAttribute('style')).toBe('width: 35.0%');
  });

  it('says how far over budget one is', () => {
    const row = purchasingSection({
      monthNow: 4,
      purchasingAreas: [{...workshops, remainingPence: -12_000}],
      withoutPurchasingArea: [],
    }).querySelector('tbody tr');

    expect(cells(row)[2]).toBe('£120 over of £1,000');
  });

  it('marks one that is not active yet', () => {
    const row = purchasingSection({
      monthNow: 4,
      purchasingAreas: [{...workshops, active: false}],
      withoutPurchasingArea: [],
    }).querySelector('tbody tr');

    expect(cells(row)[0]).toBe(
      'Workshops Not active yet. Your areas: Metal Shop, Wood Shop'
    );
  });

  it('draws a bar for each month so far, and none for those to come', () => {
    const bars = purchasingSection(withWorkshops).querySelectorAll(
      '.owners-guide__sparkline rect'
    );

    expect(bars).toHaveLength(4);
  });

  it('says which areas are in no Purchase Area yet', () => {
    expect(
      text(
        purchasingSection({
          monthNow: 1,
          purchasingAreas: [],
          withoutPurchasingArea: ['Textiles'],
        })
      )
    ).toContain('Not in a Purchase Area yet: Textiles.');
  });

  it('shows no summary to somebody who owns no areas', () => {
    expect(
      purchasingSection({
        monthNow: 4,
        purchasingAreas: [],
        withoutPurchasingArea: [],
      }).querySelector('.owners-guide__yours')
    ).toBeNull();
  });
});

describe("the owner's guide's defined terms", () => {
  it('underlines a term each time it is used, each with its own meaning', () => {
    const terms = [...sectionFor(loggedOut).querySelectorAll('dfn')];
    const ids = terms.map(term => term.getAttribute('aria-describedby'));

    expect(terms.length).toBeGreaterThan(3);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('underlines the terms in when owners can decide for themselves', () => {
    const conditions = sectionFor(loggedOut).querySelector(
      '.owners-guide__conditions'
    );

    expect(
      [...(conditions?.querySelectorAll('dfn') ?? [])].map(
        term => term.firstChild?.textContent
      )
    ).toStrictEqual(['Small Purchase Amount', 'Small Repairs Amount', 'Purchase Area', 'Yearly Budget']);
  });

  it('explains Purchase Area where it is first used', () => {
    const term = purchasingSection(withWorkshops).querySelector('dfn');
    const meaning = term?.querySelector('[role="tooltip"]');

    expect(term?.firstChild?.textContent).toBe('Purchase Areas');
    expect(term?.getAttribute('aria-describedby')).toBe(meaning?.id);
    expect(meaning?.textContent).toContain(
      'a collection of Areas that share a budget'
    );
  });
});

describe("the owner's guide, logged out", () => {
  const section = () => sectionFor(loggedOut);

  it('still explains Purchase Areas', () => {
    expect(text(section())).toContain('Areas are grouped into Purchase Areas');
  });

  it('asks you to log in wherever it would show your own areas', () => {
    const prompts = [
      ...section().querySelectorAll('.owners-guide__log-in-to-see'),
    ].map(text);

    expect(prompts).toStrictEqual([
      'Log in to view the Purchase Areas that you are an Owner in.',
      'Log in to view links to request purchases for your Purchase Areas.',
    ]);
  });

  it('comes back to the same section after logging in', () => {
    expect(
      section()
        .querySelector('.owners-guide__log-in-to-see a')
        ?.getAttribute('href')
    ).toBe('/log-in?next=%2Fowners-guide%23purchasing');
  });

  it("shows nobody's areas", () => {
    expect(section().querySelector('.owners-guide__yours')).toBeNull();
  });
});

describe("the owner's guide's purchase request links", () => {
  const links = (yours: YourAreas) =>
    purchasingSection(yours).querySelector('.owners-guide__requests');

  it('links to request a purchase for each active Purchase Area', () => {
    const list = links(withWorkshops);
    const link = list?.querySelector('a');

    expect(text(list)).toBe(
      'Workshops - request a purchase Purchaser: Pat Purchaser'
    );
    expect(text(link)).toBe('request a purchase');
    expect(link?.getAttribute('href')).toBe(
      '/purchase-requests/submit?purchasingArea=pa-1'
    );
  });

  it('names several Purchasers, or none when there are none', () => {
    const purchasers = (yours: YourAreas) =>
      text(links(yours)?.querySelector('.owners-guide__purchasers'));

    expect(
      purchasers({
        ...withWorkshops,
        purchasingAreas: [
          {
            ...workshops,
            purchasers: [pat, {...pat, name: O.none, memberNumber: 42}],
          },
        ],
      })
    ).toBe('Purchasers: Pat Purchaser, member 42');
    expect(
      purchasers({
        ...withWorkshops,
        purchasingAreas: [{...workshops, purchasers: []}],
      })
    ).toBeUndefined();
  });

  it("says one that isn't active yet isn't taking requests, and who to ask", () => {
    const list = links({
      ...withWorkshops,
      purchasingAreas: [{...workshops, active: false}],
    });

    expect(list?.querySelector('a')?.getAttribute('href')).toBe(
      'mailto:managers@makespace.org'
    );
    expect(text(list)).toBe(
      "Workshops isn't taking requests yet. If you want your Area to adopt the system, email managers@makespace.org"
    );
  });

  it('shows nothing to somebody in no Purchase Area', () => {
    expect(
      links({...withWorkshops, purchasingAreas: []})
    ).toBeNull();
  });
});

describe("the owner's guide's contents", () => {
  const page = () => {
    const body = document.createElement('body');
    body.innerHTML = render(loggedOut);
    return body;
  };

  it('lists the headings within a section under it, by their short names', () => {
    const purchasing = page().querySelector('.owners-guide__toc > ol > li');

    expect(
      [...(purchasing?.querySelectorAll('.owners-guide__toc-sub a') ?? [])].map(
        link => text(link)
      )
    ).toStrictEqual([
      'Purchase Requests',
      'Simple Purchases',
      'Proposals',
      'Budgets',
      'Going over budget',
    ]);
  });

  it('only links to headings that are there', () => {
    const body = page();
    const targets = [...body.querySelectorAll('.owners-guide__toc a')].map(
      link => link.getAttribute('href')?.slice(1)
    );

    targets.forEach(id =>
      expect(body.querySelector(`[id="${id}"]`)).not.toBeNull()
    );
    expect(targets).toHaveLength(8);
  });
});
