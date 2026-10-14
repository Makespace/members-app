/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {renderStatus} from '../../src/paxton/render-summary';
import {arbitraryActor} from '../helpers';

describe('fob import status page', () => {
  const page = (html: string) => {
    const body = document.createElement('body');
    body.innerHTML = html;
    return body;
  };

  it('says so when nothing has run', () => {
    expect(page(renderStatus(O.none)).textContent).toContain('No import has run');
  });

  it('refreshes itself while running', () => {
    const rendered = page(
      renderStatus(
        O.some({
          startedAt: new Date(),
          startedBy: arbitraryActor(),
          total: 10,
          done: 3,
          summary: O.none,
        })
      )
    );
    expect(rendered.querySelector('meta[http-equiv="refresh"]')).not.toBeNull();
    expect(rendered.textContent).toContain('3 of 10');
  });

  it('shows the summary once done, without refreshing', () => {
    const rendered = page(
      renderStatus(
        O.some({
          startedAt: new Date(),
          startedBy: arbitraryActor(),
          total: 10,
          done: 10,
          summary: O.some({recorded: 8, removed: 1, skipped: 1, failures: ['Fob 1: x']}),
        })
      )
    );
    expect(rendered.querySelector('meta[http-equiv="refresh"]')).toBeNull();
    expect(rendered.textContent).toContain('8 fobs recorded');
    expect(rendered.textContent).toContain('Fob 1: x');
  });
});
