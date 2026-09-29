/**
 * @jest-environment jsdom
 */
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {EmailAddress} from '../../../src/types';
import {renderQuizResults} from '../../../src/queries/equipment-people/render';
import {ViewModel} from '../../../src/queries/equipment-people/construct-view-model';

const equipmentId = 'eeeeeeee-0000-0000-0000-000000000001' as UUID;

const viewModel: ViewModel = {
  equipment: {id: equipmentId, name: 'Band Saw'},
  isTrainer: true,
  isTrainerOrOwner: true,
  trained: [],
  waiting: [
    {
      kind: 'member',
      person: {
        name: O.some('A Waiting Member'),
        memberNumber: 4321,
        primaryEmailAddress: O.some('waiting@example.com' as EmailAddress),
      },
      standing: {kind: 'passed', at: new Date('2026-09-01')},
    },
  ],
  search: O.none,
  failed: [],
  lastQuizSync: O.none,
};

// Runs the page's own script against the rendered table, with fetch stood
// in for: a press marks the row where it is, and only a refused post sends
// the form the ordinary way.
describe('marking somebody trained in place', () => {
  let fetchMock: jest.Mock;
  let submitted: jest.Mock;

  const install = (response: {ok: boolean}) => {
    const markup = renderQuizResults(viewModel);
    document.body.innerHTML = markup;
    fetchMock = jest.fn().mockResolvedValue(response);
    (window as unknown as {fetch: unknown}).fetch = fetchMock;
    submitted = jest.fn();
    document.querySelectorAll('form').forEach(form => {
      form.submit = submitted;
    });
    const script = document.querySelector('script')?.textContent;
    if (!script) {
      throw new Error('no script rendered');
    }
    window.eval(script);
  };

  const press = async () => {
    const form = document.querySelector<HTMLFormElement>('form.training-mark');
    if (!form) {
      throw new Error('no mark-as-trained form');
    }
    const event = new Event('submit', {bubbles: true, cancelable: true});
    form.dispatchEvent(event);
    await new Promise(resolve => setTimeout(resolve, 0));
    return event;
  };

  const row = () => document.querySelector('.training-table tr:nth-child(2)');
  const button = () => document.querySelector('form.training-mark button');

  it('posts the form as the browser would, and never leaves the page', async () => {
    install({ok: true});

    const event = await press();

    expect(event.defaultPrevented).toBe(true);
    expect(submitted).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      {method: string; body: URLSearchParams; credentials: string},
    ];
    expect(url).toBe(
      `/equipment/mark-member-trained?next=${encodeURIComponent(
        `/equipment/${equipmentId}/quiz-results`
      )}`
    );
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('same-origin');
    expect(options.body).toBeInstanceOf(URLSearchParams);
    expect(options.body.toString()).toBe(
      `equipmentId=${equipmentId}&memberNumber=4321`
    );
  });

  it('turns the button into "Trained" and colours the row', async () => {
    install({ok: true});

    await press();

    expect(button()?.textContent).toBe('Trained');
    expect(button()?.hasAttribute('disabled')).toBe(true);
    expect(row()?.classList.contains('training-row--trained')).toBe(true);
  });

  // A refused post is not swallowed: the form goes the ordinary way, and
  // the page then says what went wrong.
  it('falls back to a full submit when the post is refused', async () => {
    install({ok: false});

    await press();

    expect(submitted).toHaveBeenCalledTimes(1);
    expect(row()?.classList.contains('training-row--trained')).toBe(false);
    expect(button()?.textContent?.trim()).toBe('Mark as trained');
  });
});
