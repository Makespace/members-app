/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/manage-area/render';
import {ViewModel} from '../../../src/queries/manage-area/view-model';

const areaId = '11111111-1111-4111-8111-111111111111' as UUID;

const viewModel: ViewModel = {
  areaId,
  areaName: 'Bike Space',
  isSuperUser: true,
  equipmentCount: 70,
  categoryCount: 0,
  uncategorisedCount: 70,
  purchasingArea: O.none,
};

const links = (viewModel: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(viewModel);
  return [...body.querySelectorAll('a.button')].map(link =>
    link.getAttribute('href')
  );
};

describe('manage area page', () => {
  it('gathers every area action for a super user', () => {
    expect(links(viewModel)).toStrictEqual([
      `/equipment/add?area=${areaId}`,
      `/equipment/bulk-add?area=${areaId}`,
      `/areas/equipment-categories?area=${areaId}`,
      `/areas/add-owner?area=${areaId}`,
      `/areas/set-mailing-list?area=${areaId}`,
      `/areas/remove?area=${areaId}`,
    ]);
  });

  it('gives an area owner only the equipment actions they are allowed', () => {
    expect(links({...viewModel, isSuperUser: false})).toStrictEqual([
      `/equipment/bulk-add?area=${areaId}`,
      `/areas/equipment-categories?area=${areaId}`,
    ]);
  });

  it('summarises how far categorising has got', () => {
    const body = document.createElement('body');
    body.innerHTML = render({
      ...viewModel,
      categoryCount: 6,
      uncategorisedCount: 12,
    });
    expect(body.textContent?.replace(/\s+/g, ' ')).toContain(
      '6 categories; 12 of 70 items not in one yet.'
    );
  });

  describe('purchasing', () => {
    const text = (viewModel: ViewModel) => {
      const body = document.createElement('body');
      body.innerHTML = render(viewModel);
      return body;
    };
    const purchasingAreaId = '55555555-5555-4555-8555-555555555555' as UUID;

    it('links the purchasing area whose budget the area spends from', () => {
      const page = text({
        ...viewModel,
        isSuperUser: false,
        purchasingArea: O.some({id: purchasingAreaId, name: 'Craft & Art'}),
      });
      expect(page.textContent?.replace(/\s+/g, ' ')).toContain(
        "This area's purchases come out of the Craft & Art budget."
      );
      expect(
        page
          .querySelector(`a[href="/purchasing-areas/${purchasingAreaId}"]`)
          ?.textContent
      ).toBe('Craft & Art');
    });

    it('says when the area is not in a purchasing area', () => {
      expect(text(viewModel).textContent).toContain(
        "This area isn't in a purchasing area yet."
      );
    });
  });

  describe('super-user actions', () => {
    const page = (viewModel: ViewModel) => {
      const body = document.createElement('body');
      body.innerHTML = render(viewModel);
      return body;
    };
    const superUserHrefs = (body: HTMLElement) =>
      [...body.querySelectorAll('a.button--super-user')].map(link =>
        link.getAttribute('href')
      );

    it('are drawn in the super-user style, inside a box saying so', () => {
      const body = page(viewModel);
      expect(superUserHrefs(body)).toStrictEqual([
        `/equipment/add?area=${areaId}`,
        `/areas/add-owner?area=${areaId}`,
        `/areas/set-mailing-list?area=${areaId}`,
        `/areas/remove?area=${areaId}`,
      ]);
      expect(body.querySelector('.super-user-actions')?.textContent).toContain(
        'Super users only'
      );
      expect(
        body.querySelector('a[href^="/equipment/bulk-add"]')?.classList.contains('button--super-user')
      ).toBe(false);
    });

    it("aren't shown to an owner", () => {
      const body = page({...viewModel, isSuperUser: false});
      expect(superUserHrefs(body)).toStrictEqual([]);
      expect(body.querySelector('.super-user-actions')).toBeNull();
    });
  });
});
