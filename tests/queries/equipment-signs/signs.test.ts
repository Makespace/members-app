/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {
  render,
  renderPrintDocument,
} from '../../../src/queries/equipment-signs/render';
import {ViewModel} from '../../../src/queries/equipment-signs/construct-view-model';
import {categoryDescription} from '../../../src/templates/equipment-category';

const areaId = 'aaaaaaaa-0000-0000-0000-000000000001' as UUID;

const viewModel = (overrides: Partial<ViewModel> = {}): ViewModel => ({
  signs: [
    {
      id: 'eeeeeeee-0000-0000-0000-000000000001',
      name: 'Metal Lathe',
      areaName: 'Metal Shop',
      category: 'red',
      url: 'https://app.makespace.org/equipment/metal-shop-metal-lathe',
      hasGuide: true,
      areaEmail: O.none,
    },
  ],
  size: 'a6',
  missingGuideUrl: [],
  unreachableGuideUrl: [],
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

    // The rule comes from the one place in the app that says what a colour
    // means, so a printed sign cannot drift from what a screen says.
    it('states the category and what it means, not just a colour', () => {
      expect(sign.querySelector('.sign__band-word')?.textContent?.trim()).toBe(
        'RED EQUIPMENT'
      );
      expect(sign.querySelector('.sign__band-rule')?.textContent?.trim()).toBe(
        categoryDescription('red')
      );
    });

    it('says what is on the page the code leads to', () => {
      const label = sign.querySelector('.sign__sections')?.textContent ?? '';
      const text = label.replace(/\s+/g, ' ');
      expect(text).toContain('Learn');
      expect(text).toContain('Get trained');
      expect(text).toContain('Trouble tickets');
      // Each title carries a line saying what it is about.
      expect(text).toContain('view active issues');
      expect(text).toContain('Pass the online quiz');
    });

    it('reads down the sign in the order a member meets the machine', () => {
      const titles = [...sign.querySelectorAll('.sign__section-title')].map(
        node => (node.textContent ?? '').replace(/\s+/g, ' ').trim()
      );

      expect(titles).toStrictEqual(['Learn', 'Get trained', 'Trouble tickets']);
    });

    // What the middle block says depends on the colour, because what a
    // member has to do before touching the machine depends on the colour.
    describe('the middle block', () => {
      const ofCategory = (
        category: 'orange' | 'green',
        areaEmail = O.none as O.Option<string>
      ) =>
        renderPage(
          viewModel({
            signs: [
              {
                ...viewModel().signs[0],
                category,
                areaEmail,
              },
            ],
          })
        );

      it('tells red equipment how training is actually obtained', () => {
        const text = (
          renderPage(viewModel()).textContent ?? ''
        ).replace(/\s+/g, ' ');

        expect(text).toContain('You must be trained to use this equipment!');
        expect(text).toContain('Pass the online quiz');
      });

      it('tells orange equipment it is members only', () => {
        const orange = ofCategory('orange');
        const text = (orange.textContent ?? '').replace(/\s+/g, ' ');

        expect(text).toContain('Members only');
        expect(text).toContain("You don't need formal training");
        expect(text).not.toContain('Get trained');
      });

      it('points an orange question at the area, when the area has an address', () => {
        const text = (
          ofCategory('orange', O.some('area@example.com')).textContent ?? ''
        ).replace(/\s+/g, ' ');

        expect(text).toContain('Contact area@example.com');
      });

      it('leaves the contact sentence out when the area has no address', () => {
        expect(ofCategory('orange').textContent).not.toContain('Contact');
      });

      it('tells green equipment it is open to all', () => {
        const green = ofCategory('green');
        const text = (green.textContent ?? '').replace(/\s+/g, ' ');

        expect(text).toContain('Open to all!');
        expect(text).toContain('free for all members and non-members');
      });
    });

    // A machine with no guide recorded has none on its page, so the sign
    // does not promise one.
    describe('when no equipment guide has been recorded', () => {
      const withoutGuide = () =>
        renderPage(
          viewModel({
            signs: [{...viewModel().signs[0], hasGuide: false}],
            missingGuideUrl: ['Metal Lathe'],
          })
        );

      it('prints the sign without the learn section', () => {
        const page = withoutGuide();

        expect(page.querySelectorAll('.sign__section--learn')).toHaveLength(0);
        expect(page.querySelectorAll('.sign__qr svg')).toHaveLength(1);
      });

      it('warns whoever is about to print, naming the machines', () => {
        const warning = withoutGuide().querySelector('.signs-page__warning');

        expect(warning?.textContent).toContain('Metal Lathe');
        expect(warning?.textContent).toContain('No equipment guide recorded');
      });

      it('says nothing when every sign has one', () => {
        expect(
          renderPage(viewModel()).querySelector('.signs-page__warning')
        ).toBeNull();
      });

      // A recorded address that has since gone dead is worse than none: the
      // sign sends members to a guide that leads nowhere.
      it('warns separately when a recorded guide stopped answering', () => {
        const page = renderPage(
          viewModel({unreachableGuideUrl: ['Metal Lathe']})
        );
        const warning = page.querySelector('.signs-page__warning');

        expect(warning?.textContent).toContain('did not answer');
        expect(warning?.textContent).toContain('Metal Lathe');
      });
    });

    // One code, to the machine's page, rather than one per section: the page
    // carries the guide, the training and the tickets.
    it('carries one QR code, drawn on the server', () => {
      const codes = sign.querySelectorAll('.sign__qr svg');
      expect(codes).toHaveLength(1);
      // A QR code of this URL needs many modules; a handful of paths would
      // mean it had not really been encoded.
      expect(
        (codes[0]?.querySelector('path')?.getAttribute('d') ?? '').length
      ).toBeGreaterThan(500);
    });

    it('prints the URL in full, for anyone without a camera to hand', () => {
      const urls = [...sign.querySelectorAll('.sign__url')].map(
        node => node.textContent?.trim() ?? ''
      );
      // The whole address, so it can be typed - no ellipsis, no truncation.
      expect(urls).toStrictEqual([
        'app.makespace.org/equipment/metal-shop-metal-lathe',
      ]);
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

    // Printing an A7 sign from a page laid out for A5 is a surprise you
    // discover after the paper comes out.
    it('keeps the size being viewed when one sign is opened', () => {
      const link = renderPage(viewModel({size: 'a7'})).querySelector(
        '.sign-block__print'
      );

      expect(link?.getAttribute('href')).toContain('size=a7');
    });

    it('sets the posters in Inter, as the printed ones are', () => {
      expect(render(viewModel())).toContain('family=Inter');
    });
  });

  // The print view is a document of its own rather than the app page with
  // bits hidden, so what is on screen is what comes out of the printer.
  describe('the print document', () => {
    const document_ = () => renderPrintDocument(viewModel());

    it('is a whole document, with the paper size set', () => {
      expect(document_()).toContain('<!doctype html>');
      expect(document_()).toContain('size: A6 portrait');
    });

    it('carries the signs', () => {
      const body = renderPage(viewModel());
      expect(document_()).toContain('Metal Lathe');
      expect(body.querySelectorAll('.sign').length).toBe(1);
    });

    it('has none of the app around them', () => {
      const printed = document_();

      expect(printed).not.toContain('page-nav');
      expect(printed).not.toContain('signs-page__controls');
      expect(printed).not.toContain('signs-page__warning');
      expect(printed).not.toContain('sign-block__print');
    });

    it('opens the print dialog by itself', () => {
      expect(document_()).toContain('window.print()');
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
