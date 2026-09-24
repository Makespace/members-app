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
      trainUrl: O.some(
        'https://app.makespace.org/equipment/metal-shop-metal-lathe'
      ),
    },
  ],
  size: 'a6',
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
      expect(sign.querySelector('.sign__band-word')?.textContent?.trim()).toBe(
        'RED EQUIPMENT'
      );
      expect(sign.querySelector('.sign__band-rule')?.textContent?.trim()).toBe(
        'Training required before use'
      );
    });

    it('says what each QR code is for, so scanning is a decision', () => {
      const label = sign.querySelector('.sign__codes')?.textContent ?? '';
      const text = label.replace(/\s+/g, ' ');
      expect(text).toContain('Learn');
      expect(text).toContain('Get trained');
      expect(text).toContain('Trouble tickets');
      // Each title carries a line saying what scanning gets you.
      expect(text).toContain('already been reported');
      expect(text).toContain('Who can train you');
    });

    it('reads down the sign in the order a member meets the machine', () => {
      const titles = [...sign.querySelectorAll('.sign__scan-title')].map(
        node => (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      );

      expect(titles).toStrictEqual(['Learn', 'Get trained', 'Trouble tickets']);
    });

    // Training only applies to red equipment: an orange or green sign
    // offering to get you trained would be offering something that does not
    // exist.
    it('leaves the training code off equipment that needs no training', () => {
      const green = renderPage(
        viewModel({
          signs: [
            {...viewModel().signs[0], category: 'green', trainUrl: O.none},
          ],
        })
      );

      expect(green.textContent).not.toContain('Get trained');
      expect(green.querySelectorAll('.sign__qr svg')).toHaveLength(2);
    });

    it('carries all three QR codes, drawn on the server', () => {
      const codes = sign.querySelectorAll('.sign__qr svg');
      expect(codes).toHaveLength(3);
      const svg = codes[0];
      // A QR code of this URL needs many modules; a handful of paths would
      // mean it had not really been encoded.
      expect(
        (svg?.querySelector('path')?.getAttribute('d') ?? '').length
      ).toBeGreaterThan(500);
    });

    it('prints every URL in full, for anyone without a camera to hand', () => {
      const urls = [...sign.querySelectorAll('.sign__url')].map(
        node => node.textContent?.trim() ?? ''
      );
      // Whole addresses, so they can be typed - no ellipsis, no truncation.
      expect(urls).toContain('equipment.makespace.org/metal-shop/metal-lathe');
      expect(urls).toContain(
        'app.makespace.org/trouble-tickets?equipmentId=metal-shop-metal-lathe'
      );
      expect(urls).toContain('app.makespace.org/equipment/metal-shop-metal-lathe');
      expect(urls.join(' ')).not.toContain('…');
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

    it('sets the paper size, so the dialog opens on the right one', () => {
      expect(render(viewModel())).toContain('size: A6 portrait');
      expect(render(viewModel({size: 'a5'}))).toContain('size: A5 portrait');
    });

    it('offers the other sizes, keeping what is being printed', () => {
      const links = [...page.querySelectorAll('.signs-page__size')].map(
        node => node.getAttribute('href') ?? ''
      );
      expect(links.some(href => href.includes('size=a7'))).toBe(true);
      expect(links.every(href => href.includes(`areaId=${areaId}`))).toBe(
        true
      );
    });

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
