/**
 * @jest-environment jsdom
 */
import {
  mailboxListForTest,
  mailboxMarkInPlaceScriptForTest,
} from '../../src/queries/mailbox/index';

// Runs the page's own script against a rendered row, with fetch stood in
// for. Reading the script was not enough once: it sent the form as
// multipart, which the server does not read, so every press fell back to a
// full submit and the page reloaded after all.
describe('marking a row in place', () => {
  let fetchMock: jest.Mock;
  let submitted: jest.Mock;

  const install = (rowMarkup: string, response: {ok: boolean}) => {
    document.body.innerHTML = rowMarkup;
    fetchMock = jest.fn().mockResolvedValue(response);
    (window as unknown as {fetch: unknown}).fetch = fetchMock;
    submitted = jest.fn();
    document.querySelectorAll('form').forEach(form => {
      form.submit = submitted;
    });
    const script = new DOMParser()
      .parseFromString(mailboxMarkInPlaceScriptForTest(), 'text/html')
      .querySelector('script')?.textContent;
    if (!script) {
      throw new Error('no script rendered');
    }
    window.eval(script);
  };

  const press = async (selector: string) => {
    const form = document.querySelector<HTMLFormElement>(selector);
    if (!form) {
      throw new Error(`no form matches ${selector}`);
    }
    const event = new Event('submit', {bubbles: true, cancelable: true});
    form.dispatchEvent(event);
    // Let the fetch promise settle.
    await new Promise(resolve => setTimeout(resolve, 0));
    return event;
  };

  const row = () => document.querySelector('tr');
  const state = (name: string) =>
    document.querySelector(`[data-state="${name}"]`);
  const mark = () => document.querySelector('.mailbox__archived-mark');

  it('posts the form as the browser would, and never leaves the page', async () => {
    install(mailboxListForTest(['a@example.com']), {ok: true});

    const event = await press('form[action^="/mailbox/archive"]');

    expect(event.defaultPrevented).toBe(true);
    expect(submitted).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [
      string,
      {method: string; body: URLSearchParams; credentials: string},
    ];
    expect(url).toBe('/mailbox/archive?next=%2Fmailbox');
    expect(options.method).toBe('POST');
    expect(options.credentials).toBe('same-origin');
    // The server reads url-encoded bodies only.
    expect(options.body).toBeInstanceOf(URLSearchParams);
    expect(options.body.toString()).toBe('conversationId=c1&reason=resolved');
  });

  it('colours and marks the row, and offers the way back', async () => {
    install(mailboxListForTest(['a@example.com']), {ok: true});

    await press('form[action^="/mailbox/archive"]');

    expect(row()?.classList.contains('mailbox-row--resolved')).toBe(true);
    expect(state('live')?.hasAttribute('hidden')).toBe(true);
    expect(state('archived')?.hasAttribute('hidden')).toBe(false);
    expect(mark()?.hasAttribute('hidden')).toBe(false);
    expect(mark()?.textContent).toBe('Archived: Resolved');
  });

  it('takes the colour and mark away again when brought back', async () => {
    install(mailboxListForTest(['a@example.com'], 'resolved'), {ok: true});

    await press('form[action^="/mailbox/unarchive"]');

    expect(row()?.getAttribute('class')).toBe('');
    expect(state('live')?.hasAttribute('hidden')).toBe(false);
    expect(state('archived')?.hasAttribute('hidden')).toBe(true);
    expect(mark()?.hasAttribute('hidden')).toBe(true);
  });

  it('keeps a rule-filtered row yellow when brought back', async () => {
    install(
      mailboxListForTest(['a@example.com'], 'resolved', {
        id: 'amazon-order-updates',
        reason: 'Amazon order and delivery notice',
      }),
      {ok: true}
    );

    await press('form[action^="/mailbox/unarchive"]');

    expect(row()?.classList.contains('mailbox-row--hidden')).toBe(true);
  });

  // A refused post is not swallowed: the form goes the ordinary way, and
  // the page then says what went wrong.
  it('falls back to a full submit when the post is refused', async () => {
    install(mailboxListForTest(['a@example.com']), {ok: false});

    await press('form[action^="/mailbox/archive"]');

    expect(submitted).toHaveBeenCalledTimes(1);
    expect(row()?.getAttribute('class')).toBe('');
  });
});
