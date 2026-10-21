/**
 * @jest-environment jsdom
 */
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {raise} from '../../../src/commands/trouble-tickets/raise';
import {raiseForm} from '../../../src/commands/trouble-tickets/raise-form';

// The form and the command each had their own idea of what "not listed"
// posts, and the tests checked each against itself. This one feeds what the
// form actually posts into what the command actually accepts.
describe('the report-a-problem form and its command', () => {
  const page = () => {
    const body = document.createElement('body');
    body.innerHTML = raiseForm.renderForm({
      areas: [{id: 'area-1', name: 'Wood Shop'}],
      categories: [],
      equipment: [
        {
          id: '11111111-1111-4111-8111-111111111111',
          name: 'Bandsaw',
          areaId: 'area-1',
          areaName: 'Wood Shop',
          machineNames: [],
          categoryId: null,
        },
      ],
      selectedEquipmentId: O.none,
      selectedAreaId: O.none,
    }).body;
    return body;
  };

  const notListedValue = () => {
    const option = [
      ...page().querySelectorAll<HTMLInputElement>(
        'input[name="equipmentId"]'
      ),
    ].find(candidate =>
      candidate.closest('label')?.textContent?.includes('not listed')
    );
    if (!option) {
      throw new Error('no "not listed" option on the form');
    }
    return option.value;
  };

  it('agree on what "not listed" posts', () => {
    const decoded = raise.decode({
      equipmentId: notListedValue(),
      otherEquipmentDetail: 'The vice by the door',
      machineStatuses: ['Consumables needed'],
      attempting: 'n/a',
      issue: 'We need more gloves',
      steps: 'n/a',
    });

    expect(E.isRight(decoded)).toBe(true);
  });

  it('still refuse "not listed" with nothing described', () => {
    const decoded = raise.decode({
      equipmentId: notListedValue(),
      otherEquipmentDetail: '',
      machineStatuses: [],
      attempting: '',
      issue: 'We need more gloves',
      steps: '',
    });

    expect(E.isLeft(decoded)).toBe(true);
  });
});

describe("the report-a-problem form's area and equipment picker", () => {
  const bandsaw = '11111111-1111-4111-8111-111111111111';
  const sander = '22222222-2222-4222-8222-222222222222';
  const vice = '33333333-3333-4333-8333-333333333333';
  const lathe = '44444444-4444-4444-8444-444444444444';

  const machine = (
    id: string,
    name: string,
    areaId: string,
    categoryId: string | null
  ) => ({
    id,
    name,
    areaId,
    areaName: areaId === 'wood' ? 'Wood Shop' : 'Metal Shop',
    machineNames: [],
    categoryId,
  });

  const render = (
    selection: {
      selectedEquipmentId?: O.Option<string>;
      selectedAreaId?: O.Option<string>;
    } = {}
  ) =>
    raiseForm.renderForm({
      areas: [
        {id: 'metal', name: 'Metal Shop'},
        {id: 'empty', name: 'Empty Room'},
        {id: 'wood', name: 'Wood Shop'},
      ],
      categories: [
        {id: 'cutting', areaId: 'wood', name: 'Cutting'},
        {id: 'unused', areaId: 'wood', name: 'Finishing'},
      ],
      equipment: [
        machine(bandsaw, 'Bandsaw', 'wood', 'cutting'),
        machine(sander, 'Belt Sander', 'wood', null),
        machine(vice, 'Vice', 'wood', 'a-deleted-category'),
        machine(lathe, 'Lathe', 'metal', null),
      ],
      selectedEquipmentId: selection.selectedEquipmentId ?? O.none,
      selectedAreaId: selection.selectedAreaId ?? O.none,
    }).body;

  // The markup alone, as a browser without the page's script would show it.
  const page = (selection?: Parameters<typeof render>[0]) => {
    const body = document.createElement('body');
    body.innerHTML = render(selection);
    return body;
  };

  // The page in the document with its script run, as a member sees it.
  const livePage = (selection?: Parameters<typeof render>[0]) => {
    document.body.innerHTML = render(selection);
    document.body.querySelectorAll('script').forEach(script => {
      // jsdom leaves scripts set through innerHTML unrun; this is the
      // page's own script, run as the browser would.
      // eslint-disable-next-line @typescript-eslint/no-implied-eval, @typescript-eslint/no-unsafe-call
      new Function(script.textContent ?? '')();
    });
    return document.body;
  };

  const panel = (body: HTMLElement, areaId: string) =>
    body.querySelector<HTMLDetailsElement>(
      `[data-tt-area-panel="${areaId}"]`
    )!;

  const areaTile = (body: HTMLElement, areaId: string) =>
    body.querySelector<HTMLButtonElement>(`[data-tt-area="${areaId}"]`)!;

  const radio = (body: HTMLElement, value: string) =>
    body.querySelector<HTMLInputElement>(`input[value="${value}"]`)!;

  const pick = (body: HTMLElement, value: string) => {
    radio(body, value).checked = true;
    radio(body, value).dispatchEvent(new Event('change'));
  };

  const groupNames = (element: Element) =>
    [...element.querySelectorAll('.tt-group__name')].map(name =>
      name.textContent?.trim()
    );

  describe('markup', () => {
    it('offers a tile for each area that has equipment', () => {
      const tiles = [...page().querySelectorAll('[data-tt-area]')].map(tile =>
        tile.getAttribute('data-tt-area')
      );
      expect(tiles).toStrictEqual(['metal', 'wood']);
    });

    it('starts with every step folded away', () => {
      expect(page().querySelectorAll('details[open]')).toHaveLength(0);
    });

    it('lists an area without categories straight into its grid', () => {
      const metal = panel(page(), 'metal');
      expect(groupNames(metal)).toStrictEqual([]);
      expect(metal.querySelector(`input[value="${lathe}"]`)).not.toBeNull();
    });

    it('splits an area with categories into one section each, then Other', () => {
      expect(groupNames(panel(page(), 'wood'))).toStrictEqual([
        'Cutting',
        'Other',
      ]);
    });

    it('puts equipment in no known category under Other', () => {
      const other = [
        ...panel(page(), 'wood').querySelectorAll('.tt-group'),
      ].find(
        group => group.querySelector('.tt-group__name')?.textContent === 'Other'
      )!;
      const values = [
        ...other.querySelectorAll<HTMLInputElement>(
          'input[name="equipmentId"]'
        ),
      ].map(input => input.value);
      expect(values).toStrictEqual([sander, vice]);
    });

    it('checks a deep-linked machine', () => {
      expect(
        radio(page({selectedEquipmentId: O.some(bandsaw)}), bandsaw).checked
      ).toBe(true);
    });
  });

  describe('in the browser', () => {
    it('shows no area until one is picked', () => {
      const body = livePage();
      expect(panel(body, 'wood').hidden).toBe(true);
      expect(panel(body, 'metal').hidden).toBe(true);
    });

    it("opens an area's equipment when the area is picked", () => {
      const body = livePage();
      areaTile(body, 'wood').click();
      expect(panel(body, 'wood').hidden).toBe(false);
      expect(panel(body, 'wood').open).toBe(true);
      expect(panel(body, 'metal').hidden).toBe(true);
      expect(body.querySelector('#tt-area-chosen')?.textContent).toBe(
        'Wood Shop'
      );
    });

    it("keeps the area's categories folded when it opens", () => {
      const body = livePage();
      areaTile(body, 'wood').click();
      expect(panel(body, 'wood').querySelectorAll('details[open]')).toHaveLength(
        0
      );
    });

    it('folds the equipment away once a machine is picked, naming it', () => {
      const body = livePage();
      areaTile(body, 'wood').click();
      pick(body, bandsaw);
      expect(panel(body, 'wood').open).toBe(false);
      expect(
        panel(body, 'wood').querySelector('[data-tt-chosen]')?.textContent
      ).toBe('Bandsaw');
    });

    it('lets go of a machine when another area is picked', () => {
      const body = livePage();
      areaTile(body, 'wood').click();
      pick(body, bandsaw);
      areaTile(body, 'metal').click();
      expect(radio(body, bandsaw).checked).toBe(false);
    });

    it("lands a deep-linked machine on its area, its category open", () => {
      const body = livePage({selectedEquipmentId: O.some(bandsaw)});
      expect(panel(body, 'wood').hidden).toBe(false);
      expect(radio(body, bandsaw).closest('details.tt-group')).toHaveProperty(
        'open',
        true
      );
    });

    it("opens a deep-linked area's equipment", () => {
      const body = livePage({selectedAreaId: O.some('metal')});
      expect(panel(body, 'metal').hidden).toBe(false);
      expect(panel(body, 'metal').open).toBe(true);
    });

    it('picks a machine from the search box', () => {
      const body = livePage();
      const search = body.querySelector<HTMLInputElement>(
        '#tt-equipment-search'
      )!;
      search.value = 'Lathe — Metal Shop';
      search.dispatchEvent(new Event('input'));
      expect(radio(body, lathe).checked).toBe(true);
      expect(panel(body, 'metal').hidden).toBe(false);
    });
  });
});
