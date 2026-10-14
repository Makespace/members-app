/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {setEquipmentCategoriesForm} from '../../../src/commands/area/set-equipment-categories-form';

const renderToDom = (body: string) => {
  const dom = document.createElement('body');
  dom.innerHTML = body;
  return dom;
};

const areaId = '11111111-1111-4111-8111-111111111111' as UUID;
const wheelsId = '22222222-2222-4222-8222-222222222222' as UUID;
const chainsId = '33333333-3333-4333-8333-333333333333' as UUID;

const viewModel = {
  areaId,
  areaName: 'Bike Space',
  sort: 'name' as const,
  categories: [
    {id: wheelsId, name: 'Wheels', count: 1},
    {id: chainsId, name: 'Chains', count: 1},
  ],
  equipment: [
    {
      id: 'a1111111-1111-4111-8111-111111111111' as UUID,
      name: 'Chain Whip',
      category: 'orange' as const,
      areaCategoryId: O.some(chainsId),
    },
    {
      id: 'a2222222-2222-4222-8222-222222222222' as UUID,
      name: 'Truing Stand',
      category: 'orange' as const,
      areaCategoryId: O.some(wheelsId),
    },
    {
      id: 'a3333333-3333-4333-8333-333333333333' as UUID,
      name: 'Bottle Opener',
      category: 'green' as const,
      areaCategoryId: O.none,
    },
  ],
};

const rowNames = (dom: HTMLElement) =>
  [...dom.querySelectorAll('tbody tr')].map(row =>
    row.querySelector('td')?.textContent?.trim()
  );

describe('equipment categories page', () => {
  describe('sorted by name', () => {
    const dom = renderToDom(setEquipmentCategoriesForm.renderForm(viewModel).body);

    it('has a None column then one column per category', () => {
      expect(
        [...dom.querySelectorAll('thead th')].map(th => th.textContent?.trim())
      ).toStrictEqual(['Equipment', 'None', 'Wheels', 'Chains']);
    });

    it('lists the equipment alphabetically', () => {
      expect(rowNames(dom)).toStrictEqual([
        'Bottle Opener',
        'Chain Whip',
        'Truing Stand',
      ]);
    });

    it("checks each machine's current category, posting one choice per machine", () => {
      const checked = [
        ...dom.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked'),
      ].map(radio => [radio.name, radio.value]);
      expect(checked).toStrictEqual([
        ['assignments[a3333333-3333-4333-8333-333333333333]', ''],
        ['assignments[a1111111-1111-4111-8111-111111111111]', chainsId],
        ['assignments[a2222222-2222-4222-8222-222222222222]', wheelsId],
      ]);
    });

    it('comes back to this page after saving', () => {
      const form = dom.querySelector<HTMLFormElement>(
        'form[action^="/areas/equipment-categories"]'
      );
      expect(form?.getAttribute('action')).toBe(
        `/areas/equipment-categories?next=${encodeURIComponent(
          `/areas/equipment-categories?area=${areaId}`
        )}`
      );
    });

    it('says how much is still to sort', () => {
      expect(dom.textContent?.replace(/\s+/g, ' ')).toContain(
        '1 of 3 not in a category yet.'
      );
    });
  });

  describe('sorted by category', () => {
    const dom = renderToDom(
      setEquipmentCategoriesForm.renderForm({...viewModel, sort: 'category'})
        .body
    );

    it('puts the uncategorised first, then each category in order', () => {
      expect(rowNames(dom)).toStrictEqual([
        'Bottle Opener',
        'Truing Stand',
        'Chain Whip',
      ]);
    });

    it('keeps the sort after saving', () => {
      expect(
        dom
          .querySelector('form[action^="/areas/equipment-categories"]')
          ?.getAttribute('action')
      ).toContain(encodeURIComponent('&sort=category'));
    });
  });

  it('shows no table until the area has a category', () => {
    const dom = renderToDom(
      setEquipmentCategoriesForm.renderForm({...viewModel, categories: []}).body
    );
    expect(dom.querySelector('table')).toBeNull();
    expect(dom.textContent).toContain('This area has no categories yet.');
    expect(dom.querySelector('input[name="name"]')).not.toBeNull();
  });
});
