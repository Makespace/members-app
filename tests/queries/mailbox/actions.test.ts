/**
 * @jest-environment jsdom
 */
import {
  actionCell,
  conversationActions,
} from '../../../src/queries/mailbox/index';
import {InboxThread} from '../../../src/read-models/external-state/gmail-inbox';

const thread = (): InboxThread =>
  ({
    conversationId: 'thread-1',
    archivedAs: undefined,
    filteredBy: undefined,
  }) as InboxThread;

const parse = (markup: string) => {
  const body = document.createElement('body');
  body.innerHTML = markup;
  return body;
};

describe('what a manager can do with a conversation', () => {
  describe('from the list', () => {
    const cell = () => parse(actionCell(thread(), '/mailbox'));

    // Raising a ticket is one of the three things done with a conversation,
    // so it sits with the other two rather than a page further in.
    it('offers a ticket alongside the archive buttons', () => {
      const links = [...cell().querySelectorAll('a')].map(
        node => node.getAttribute('href') ?? ''
      );

      expect(links.some(href => href.includes('/mailbox/create-ticket'))).toBe(
        true
      );
      expect(cell().querySelectorAll('form[action*="/mailbox/archive"]')).
        toHaveLength(2);
    });

    it('carries the conversation to the ticket form', () => {
      const href =
        cell()
          .querySelector('a[href*="create-ticket"]')
          ?.getAttribute('href') ?? '';

      expect(href).toContain('conversationId=thread-1');
    });

    // Both states of the cell are rendered so a press can swap them in
    // place, and `display: contents` on them beats the browser's own hidden
    // rule - so the stylesheet has to say it again.
    it('keeps the state that is not showing hidden', () => {
      const hidden = cell().querySelectorAll('.mailbox__state[hidden]');

      expect(hidden).toHaveLength(1);
      expect(hidden[0].querySelector('form')?.getAttribute('action')).toContain(
        '/mailbox/unarchive'
      );
    });

    it('keeps the buttons as icons, which is all the row has room for', () => {
      expect(cell().querySelectorAll('.mailbox__icon-button').length).
        toBeGreaterThan(2);
      expect(cell().textContent?.trim()).toBe('');
    });
  });

  describe('from the conversation itself', () => {
    const actions = (archivedAs?: 'resolved' | 'hide-similar') =>
      parse(
        conversationActions(
          {conversationId: 'thread-1', archivedAs},
          [],
          '/trouble-tickets/board'
        )
      );

    // There is room here to say what each button does, so it says it.
    it('spells the actions out rather than drawing them', () => {
      const labels = [
        ...actions().querySelectorAll('.mailbox__full-button'),
      ].map(node => (node.textContent ?? '').trim());

      expect(labels).toStrictEqual([
        'Create a ticket',
        'Resolved',
        'Hide like this',
      ]);
    });

    it('has no icon buttons left on it', () => {
      expect(actions().querySelectorAll('.mailbox__icon-button')).toHaveLength(
        0
      );
    });

    it('offers the way back for a conversation already archived', () => {
      const labels = [
        ...actions('resolved').querySelectorAll('.mailbox__full-button'),
      ].map(node => (node.textContent ?? '').trim());

      expect(labels).toStrictEqual([
        'Create a ticket',
        'Bring this conversation back',
      ]);
    });
  });
});
