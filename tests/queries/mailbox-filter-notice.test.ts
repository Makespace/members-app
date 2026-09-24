/**
 * @jest-environment jsdom
 */
import {mailboxFilterNoticeForTest} from '../../src/queries/mailbox/index';

describe('the mailbox noise filter notice', () => {
  const render = (count: number, showing: boolean) => {
    const body = document.createElement('body');
    body.innerHTML = mailboxFilterNoticeForTest(count, showing);
    return body;
  };

  const text = (count: number, showing: boolean) =>
    render(count, showing).textContent?.replace(/\s+/g, ' ').trim();

  // Silence here is what made a working filter look like a deleted one.
  it('says so when the rules have hidden nothing', () => {
    expect(text(0, false)).toBe(
      'No conversations are hidden by the noise rules at the moment.'
    );
  });

  it('offers no link when the two views would be identical', () => {
    expect(render(0, false).querySelector('a')).toBeNull();
    expect(render(0, true).querySelector('a')).toBeNull();
  });

  it('counts what is hidden and links to it', () => {
    expect(text(3, false)).toBe(
      '3 conversations hidden as automated or bulk mail. Show them.'
    );
    expect(render(3, false).querySelector('a')?.getAttribute('href')).toBe(
      '/mailbox?filtered=1'
    );
  });

  it('reads as one conversation rather than 1 conversations', () => {
    expect(text(1, false)).toBe(
      '1 conversation hidden as automated or bulk mail. Show them.'
    );
  });

  it('offers the way back when everything is on show', () => {
    expect(text(3, true)).toBe(
      'Showing everything, including the 3 conversations the rules would hide, each labelled with the rule that matched. Hide them again.'
    );
    expect(render(3, true).querySelector('a')?.getAttribute('href')).toBe(
      '/mailbox'
    );
  });
});
