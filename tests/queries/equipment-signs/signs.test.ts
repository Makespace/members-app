/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {render} from '../../../src/queries/equipment-signs/render';
import {ViewModel} from '../../../src/queries/equipment-signs/construct-view-model';

const areaId = 'aaaaaaaa-0000-0000-0000-000000000001' as UUID;

const viewModel = (overrides: Partial<ViewModel> = {}): ViewModel => ({
  signs: [
    {
      id: 'eeeeeeee-0000-0000-0000-000000000001',
      name: 'Metal Lathe',
      areaName: 'Metal Shop',
      category: 'red',
      url: 'https://app.makespace.org/trouble-tickets?equipmentId=eeeeeeee-0000-0000-0000-000000000001',
    },
  ],
  areas: [{id: areaId, name: 'Metal Shop', equipmentCount: 1}],
  selectedArea: O.some({id: areaId, name: 'Metal Shop'}),
  ...overrides,
});

const renderPage = (vm: ViewModel) => {
  const body = document.createElement('body');
  body.innerHTML = render(vm);
  return body;
};

describe('printable equipment signs', () => {
  describe('a sign', () => {
    const sign = renderPage(viewModel());

    it('names the equipment and where it lives', () => {
      expect(sign.querySelector('.sign__name')?.textContent?.trim()).toBe(
        'Metal Lathe'
      );
      expect(sign.querySelector('.sign__area')?.textContent?.trim()).toBe(
        'Metal Shop'
      );
    });

    it('states the category and what it means, not just a colour', () => {
      expect(sign.querySelector('.sign__category')?.textContent?.trim()).toBe(
        'RED EQUIPMENT'
      );
      expect(sign.querySelector('.sign__rule')?.textContent?.trim()).toBe(
        'YOU MUST PASS MAKESPACE TRAINING TO USE THIS EQUIPMENT'
      );
    });

    it('says what the QR code is for, so scanning it is a decision', () => {
      const label = sign.querySelector('.sign__qr-label')?.textContent ?? '';
      expect(label.replace(/\s+/g, ' ')).toContain(
        'Something wrong with this equipment?'
      );
      expect(label.replace(/\s+/g, ' ')).toContain('report a problem');
    });

    it('carries a real QR code, drawn on the server', () => {
      const svg = sign.querySelector('.sign__qr svg');
      expect(svg).not.toBeNull();
      // A QR code of this URL needs many modules; a handful of paths would
      // mean it had not really been encoded.
      expect(
        (svg?.querySelector('path')?.getAttribute('d') ?? '').length
      ).toBeGreaterThan(500);
    });

    it('prints the URL too, for anyone without a camera to hand', () => {
      expect(sign.querySelector('.sign__url')?.textContent).toContain(
        '/trouble-tickets?equipmentId='
      );
    });

    it('is coloured by category', () => {
      expect(
        renderPage(viewModel()).querySelector('.sign--red')
      ).not.toBeNull();
      expect(
        renderPage(
          viewModel({
            signs: [{...viewModel().signs[0], category: 'green'}],
          })
        ).querySelector('.sign--green')
      ).not.toBeNull();
    });
  });

  describe('choosing what to print', () => {
    it('offers the areas when nothing is selected', () => {
      const page = renderPage(
        viewModel({signs: [], selectedArea: O.none})
      );

      expect(page.textContent).toContain('Metal Shop');
      expect(
        page.querySelector(`a[href="/equipment-signs?areaId=${areaId}"]`)
      ).not.toBeNull();
    });
  });
});
