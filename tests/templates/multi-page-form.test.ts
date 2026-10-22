/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {
  backHref,
  readRequestedStep,
  renderStepNav,
  renderStepProgress,
  stepHref,
} from '../../src/templates/multi-page-form';

const toDom = (markup: string) => {
  const body = document.createElement('body');
  body.innerHTML = markup;
  return body;
};

describe('multi-page form pieces', () => {
  it('links to a page with the answers so far', () => {
    expect(
      stepHref(2, [
        ['area', 'wood'],
        ['picked', 'a'],
        ['picked', 'b & c'],
      ])
    ).toBe('?step=2&amp;area=wood&amp;picked=a&amp;picked=b+%26+c');
  });

  it('reads the requested page, starting from the first when it makes no sense', () => {
    expect(readRequestedStep({step: '2'}, 3)).toBe(2);
    expect(readRequestedStep({step: '4'}, 3)).toBe(1);
    expect(readRequestedStep({step: 'two'}, 3)).toBe(1);
    expect(readRequestedStep({}, 3)).toBe(1);
  });

  it('has no Back from the first page', () => {
    expect(backHref(1, [])).toStrictEqual(O.none);
    expect(backHref(3, [['a', 'b']])).toStrictEqual(O.some('?step=2&amp;a=b'));
  });

  it('ticks and links earlier pages, and marks the current one', () => {
    const progress = toDom(
      renderStepProgress({
        labels: ['One', 'Two', 'Three'],
        current: 2,
        values: [['a', 'b']],
        name: 'Progress',
      })
    );
    expect(progress.textContent).toContain('Page 2 of 3');
    const steps = [...progress.querySelectorAll('li')];
    expect(steps[0].querySelector('a')?.getAttribute('href')).toBe(
      '?step=1&a=b'
    );
    expect(steps[1].getAttribute('aria-current')).toBe('step');
    expect(steps[2].querySelector('a')).toBeNull();
  });

  it('puts Back before whatever moves on', () => {
    const nav = toDom(
      renderStepNav({back: O.some(stepHref(1, [])), next: '<button>Next</button>' as never})
    );
    expect(nav.querySelector('a')?.getAttribute('href')).toBe('?step=1');
    expect(nav.querySelector('button')?.textContent).toBe('Next');
  });
});
