/**
 * @jest-environment jsdom
 */

import {navBar} from '../../src/templates/navbar';
import {User} from '../../src/types';

const user = {
  memberNumber: 123,
  emailAddress: 'someone@example.com',
} as unknown as User;

const viewer = {isSuperUser: true, isOwner: false};
const navModel = {areas: [], areasWithTools: []} as unknown as Parameters<
  typeof navBar
>[2];

const render = (backLink?: {href: string; label: string}) => {
  const body = document.createElement('body');
  body.innerHTML = navBar(user, viewer, navModel, backLink);
  return body;
};

describe('the navbar back button', () => {
  it('falls back through browser history when a page names nothing better', () => {
    const back = render().querySelector<HTMLAnchorElement>('.page-nav__back')!;
    expect(back.textContent).toContain('Back');
    expect(back.getAttribute('href')).toBe('/me');
    // Needs javascript, so it is hidden without it.
    expect(back.className).toContain('jsonly');
  });

  it('sends the reader where the page says instead', () => {
    const back = render({
      href: '/outstanding-invoices',
      label: 'View outstanding invoices for all members',
    }).querySelector<HTMLAnchorElement>('.page-nav__back')!;
    expect(back.textContent).toContain(
      'View outstanding invoices for all members'
    );
    expect(back.getAttribute('href')).toBe('/outstanding-invoices');
    // A real destination works without javascript, so it is always shown.
    expect(back.className).not.toContain('jsonly');
    expect(back.getAttribute('onclick')).toBeNull();
  });

  it('escapes a label rather than trusting it', () => {
    const back = render({
      href: '/somewhere',
      label: '<script>alert(1)</script>',
    }).querySelector<HTMLAnchorElement>('.page-nav__back')!;
    expect(back.querySelector('script')).toBeNull();
    expect(back.textContent).toContain('<script>');
  });
});
