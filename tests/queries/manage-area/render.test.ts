/**
 * @jest-environment jsdom
 */
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
});
