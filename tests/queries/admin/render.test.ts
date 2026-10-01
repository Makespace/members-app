/**
 * @jest-environment jsdom
 */

import {render} from '../../../src/queries/admin/render';

const page = () => {
  const body = document.createElement('body');
  body.innerHTML = render();
  return body;
};

describe('the admin page', () => {
  it('groups its links under headings rather than one long column', () => {
    const headings = [...page().querySelectorAll('h2')].map(h =>
      h.textContent?.trim()
    );
    expect(headings).toEqual([
      'Members',
      'Membership payments',
      'Equipment and areas',
      'Trouble tickets and member email',
      'The event log',
    ]);
  });

  it('puts every link inside a section', () => {
    const inSections = page().querySelectorAll('section nav ul li a').length;
    const all = page().querySelectorAll('a').length;
    expect(inSections).toBe(all);
  });

  // Easy to break by hand-writing anchors: the old page had two links whose
  // closing tag was missing, which swallowed everything after them.
  it('closes every link it opens', () => {
    const html = render();
    expect((html.match(/<a[\s>]/g) ?? []).length).toBe(
      (html.match(/<\/a\s*>/g) ?? []).length
    );
  });

  it.each([
    ['/outstanding-invoices'],
    ['/equipment-links'],
    ['/unlinked-recurly'],
    ['/mailbox'],
    ['/event-log'],
  ])('links to %s', href => {
    expect(page().querySelector(`a[href="${href}"]`)).not.toBeNull();
  });
});
