/**
 * @jest-environment jsdom
 */

import {Banner, renderBanners} from '../../src/templates/banners';

const banner = (
  bannerType: Banner['bannerType'],
  over: Partial<Banner> = {}
): Banner => ({
  bannerType,
  title: `A ${bannerType} banner`,
  message: 'Details here.',
  linkUrl: null,
  linkLabel: null,
  dismissableId: null,
  ...over,
});

const renderPage = (banners: ReadonlyArray<Banner>) => {
  const body = document.createElement('body');
  body.innerHTML = renderBanners(banners, '/somewhere');
  return body;
};

describe('site banners', () => {
  it('renders nothing for no banners', () => {
    expect(renderPage([]).innerHTML).toBe('');
  });

  it('colour-codes by type', () => {
    const page = renderPage([
      banner('action'),
      banner('event'),
      banner('info'),
    ]);
    expect(page.querySelectorAll('.site-banner--action')).toHaveLength(1);
    expect(page.querySelectorAll('.site-banner--event')).toHaveLength(1);
    expect(page.querySelectorAll('.site-banner--info')).toHaveLength(1);
    expect(page.querySelectorAll('.site-banner--alt')).toHaveLength(0);
  });

  it('alternates the shade for adjacent banners of the same type', () => {
    const page = renderPage([
      banner('event'),
      banner('event'),
      banner('event'),
      banner('action'),
    ]);
    const nodes = [...page.querySelectorAll('.site-banner')];
    expect(nodes.map(node => node.classList.contains('site-banner--alt'))).toEqual(
      [false, true, false, false]
    );
  });

  it('renders a dismiss form only for dismissable banners, with return path', () => {
    const page = renderPage([
      banner('event', {dismissableId: 'abc-123'}),
      banner('action'),
    ]);
    const forms = page.querySelectorAll('form.site-banner__dismiss');
    expect(forms).toHaveLength(1);
    expect(forms[0].getAttribute('action')).toBe(
      '/notifications/dismiss?next=%2Fsomewhere'
    );
  });

  it('renders the link with its label', () => {
    const page = renderPage([
      banner('event', {
        linkUrl: 'https://www.meetup.com/makespace/events/316647091/',
        linkLabel: 'Sign up here',
      }),
    ]);
    const link = page.querySelector('.site-banner__body a');
    expect(link?.getAttribute('href')).toBe(
      'https://www.meetup.com/makespace/events/316647091/'
    );
    expect(link?.textContent?.trim()).toBe('Sign up here');
  });
});
