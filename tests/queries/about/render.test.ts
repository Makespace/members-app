/**
 * @jest-environment jsdom
 */

import {about} from '../../../src/queries/about';
import {changeLog, changeLogBySubject, subjects} from '../../../src/queries/about/change-log';
import {arbitraryUser} from '../../types/user.helper';
import {getTaskEitherRightOrFail} from '../../helpers';
import {Dependencies} from '../../../src/dependencies';

// The about page reads nothing from its dependencies.
const noDeps = {} as Dependencies;

const renderPage = async () => {
  const result = await getTaskEitherRightOrFail(
    about(noDeps)(arbitraryUser(), {}, {})
  );
  const body = document.createElement('body');
  if (result._tag !== 'LoggedInContent') {
    throw new Error('expected LoggedInContent');
  }
  body.innerHTML = result.body;
  return body;
};

describe('/about render', () => {
  it('leads with the members-built message and Discord coordination', async () => {
    const page = await renderPage();
    expect(page.textContent).toContain('built by members like you');
    expect(page.textContent).toContain('Discord');
    expect(page.textContent).toContain('database-owners@makespace.org');
    expect(page.textContent).not.toContain('WhatsApp');
  });

  it('links to the roadmap and shows the change log', async () => {
    const page = await renderPage();
    expect(page.querySelector('a[href="/roadmap"]')).not.toBeNull();
    for (const entry of changeLog.slice(0, 3)) {
      expect(page.textContent).toContain(entry.headline);
    }
  });

  it('groups the change log under subject headings, each entry under its own', async () => {
    const page = await renderPage();
    const headings = [...page.querySelectorAll('h3')].map(h => h.textContent?.trim());
    for (const group of changeLogBySubject()) {
      expect(headings).toContain(subjects[group.subject]);
      const heading = [...page.querySelectorAll('h3')].find(
        h => h.textContent?.trim() === subjects[group.subject]
      );
      const list = heading?.nextElementSibling;
      expect(list?.tagName).toBe('DL');
      for (const entry of group.entries) {
        expect(list?.textContent).toContain(entry.headline);
      }
    }
  });

  it('shows every entry exactly once', async () => {
    const page = await renderPage();
    const shown = [...page.querySelectorAll('h3')]
      .filter(h => (Object.values(subjects) as string[]).includes(h.textContent?.trim() ?? ''))
      .flatMap(h => [...(h.nextElementSibling?.querySelectorAll('dd') ?? [])]);
    expect(shown.length).toBe(changeLog.length);
  });

  it('keeps the raise-an-issue routes: records, contributing, contact', async () => {
    const page = await renderPage();
    expect(page.textContent).toContain('If your records are wrong');
    expect(page.textContent).toContain('To change this website');
    expect(page.textContent).toContain('Contact');
  });
});
