/**
 * @jest-environment jsdom
 */

import {about} from '../../../src/queries/about';
import {changeLog} from '../../../src/queries/about/change-log';
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

  it('keeps the raise-an-issue routes: records, contributing, contact', async () => {
    const page = await renderPage();
    expect(page.textContent).toContain('If your records are wrong');
    expect(page.textContent).toContain('To change this website');
    expect(page.textContent).toContain('Contact');
  });
});
