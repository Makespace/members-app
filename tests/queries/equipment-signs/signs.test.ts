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
      url: 'https://app.makespace.org/trouble-tickets?equipmentId=metal-shop-metal-lathe',
      learnUrl: 'https://equipment.makespace.org/metal-shop/metal-lathe',
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

    it('names the equipment', () => {
      expect(sign.querySelector('.sign__name')?.textContent?.trim()).toBe(
        'Metal Lathe'
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

    it('says what each QR code is for, so scanning is a decision', () => {
      const label = sign.querySelector('.sign__footer')?.textContent ?? '';
      const text = label.replace(/\s+/g, ' ');
      expect(text).toContain('Something wrong with this equipment?');
      expect(text).toContain('report a problem');
      expect(text).toContain('Learn to use this equipment!');
    });

    it('carries both QR codes, drawn on the server', () => {
      const codes = sign.querySelectorAll('.sign__qr svg');
      expect(codes).toHaveLength(2);
      const svg = codes[0];
      // A QR code of this URL needs many modules; a handful of paths would
      // mean it had not really been encoded.
      expect(
        (svg?.querySelector('path')?.getAttribute('d') ?? '').length
      ).toBeGreaterThan(500);
    });

    it('prints both URLs, for anyone without a camera to hand', () => {
      const urls = [...sign.querySelectorAll('.sign__url')].map(
        node => node.textContent ?? ''
      );
      expect(urls.join(' ')).toContain('equipment.makespace.org');
      expect(urls.join(' ')).toContain('/trouble-tickets?equipmentId=');
    });

    it('uses a readable slug rather than a uuid in the printed URL', () => {
      expect(
        [...sign.querySelectorAll('.sign__url')]
          .map(node => node.textContent ?? '')
          .join(' ')
      ).toContain('metal-shop-metal-lathe');
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

  describe('getting it onto paper', () => {
    const page = renderPage(viewModel());

    it('offers a print button, since the browser dialog is where PDFs come from', () => {
      expect(page.querySelector('[data-print-signs]')).not.toBeNull();
    });

    it('lets one sign be opened on its own, in a new tab', () => {
      const link = page.querySelector<HTMLAnchorElement>(
        '.sign-block__print'
      );
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('href')).toContain('print=1');
    });

    it('sets the posters in Inter, as the printed ones are', () => {
      expect(render(viewModel())).toContain('family=Inter');
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
