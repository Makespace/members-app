/**
 * @jest-environment jsdom
 */
import {UUID} from 'io-ts-types';
import {faker} from '@faker-js/faker';
import {addForm} from '../../../src/commands/equipment/add-form';
import {bulkAddForm} from '../../../src/commands/equipment/bulk-add-form';

const renderToDom = (body: string) => {
  const dom = document.createElement('body');
  dom.innerHTML = body;
  return dom;
};

describe('equipment add forms', () => {
  const viewModel = {
    areaId: faker.string.uuid() as UUID,
    areaName: 'Wood Shop',
  };

  describe('single add form', () => {
    const dom = renderToDom(addForm.renderForm(viewModel).body);

    it('labels the name field plainly', () => {
      expect(dom.querySelector('label[for="name"]')?.textContent?.trim()).toBe(
        'Equipment name'
      );
    });

    it('offers all three categories as real radio inputs, red preselected', () => {
      const radios = [
        ...dom.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
      ];
      expect(radios.map(radio => radio.value)).toEqual([
        'red',
        'orange',
        'green',
      ]);
      expect(radios.every(radio => radio.name === 'category')).toBe(true);
      expect(radios.filter(radio => radio.hasAttribute('checked'))).toHaveLength(
        1
      );
      expect(radios[0].hasAttribute('checked')).toBe(true);
    });

    it('spells out what each category means', () => {
      const text = dom.textContent ?? '';
      expect(text).toContain('Members only. Training required before use.');
      expect(text).toContain('Members only. Only use if confident to do so.');
      expect(text).toContain('All members & guests');
    });
  });

  describe('bulk add form', () => {
    const dom = renderToDom(bulkAddForm.renderForm(viewModel).body);

    it('offers only orange and green, orange preselected', () => {
      const radios = [
        ...dom.querySelectorAll<HTMLInputElement>('input[type="radio"]'),
      ];
      expect(radios.map(radio => radio.value)).toEqual(['orange', 'green']);
      expect(radios[0].hasAttribute('checked')).toBe(true);
      expect(radios[1].hasAttribute('checked')).toBe(false);
    });
  });
});
