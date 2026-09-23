import {InboxMessage} from '../../../src/read-models/external-state/gmail-inbox';
import {
  noiseRuleFor,
  noiseRuleForConversation,
} from '../../../src/read-models/external-state/mailbox-noise';

const message = (overrides: Partial<InboxMessage> = {}): InboxMessage => ({
  gmailMessageId: 'm1',
  gmailThreadId: 't1',
  fromAddress: 'tara@example.com',
  toAddresses: 'management@makespace.org',
  subject: 'Building wifi down',
  receivedAt: new Date('2026-09-23T09:42:00.000Z'),
  snippet: 'Hello',
  bodyText: 'Hello',
  bodyHtml: null,
  listUnsubscribe: null,
  autoSubmitted: null,
  precedence: null,
  attachments: [],
  ...overrides,
});

describe('deciding what is mailbox noise', () => {
  describe('what gets hidden', () => {
    it('mail from a no-reply address', () => {
      expect(
        noiseRuleFor(message({fromAddress: 'Amazon <no-reply@amazon.co.uk>'}))
          ?.id
      ).toBe('no-reply-sender');
    });

    it('bulk mail, which advertises its own unsubscribe link', () => {
      expect(
        noiseRuleFor(message({listUnsubscribe: '<https://x/unsub>'}))?.id
      ).toBe('bulk-mail');
    });

    it('machine-generated mail', () => {
      expect(noiseRuleFor(message({autoSubmitted: 'auto-generated'}))?.id).toBe(
        'auto-generated'
      );
      expect(noiseRuleFor(message({precedence: 'bulk'}))?.id).toBe(
        'auto-generated'
      );
    });

    it("Google's notices about the app's own account", () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: 'Google <no-reply@accounts.google.com>',
            subject: 'Security alert',
          })
        )
      ).toBeDefined();
    });
  });

  describe('what survives', () => {
    it('a member writing in', () => {
      expect(noiseRuleFor(message())).toBeUndefined();
    });

    it('a person whose address merely contains "reply"', () => {
      expect(
        noiseRuleFor(message({fromAddress: 'ripley@example.com'}))
      ).toBeUndefined();
    });

    it('Auto-Submitted: no, which explicitly denies being automated', () => {
      expect(noiseRuleFor(message({autoSubmitted: 'no'}))).toBeUndefined();
    });
  });

  describe('conversations', () => {
    it('is noise only when every message is', () => {
      const automated = message({
        gmailMessageId: 'm1',
        listUnsubscribe: '<https://x/unsub>',
      });
      const humanReply = message({gmailMessageId: 'm2'});

      expect(noiseRuleForConversation([automated])).toBeDefined();
      // Someone replied to the automated mail, so the thread matters now.
      expect(noiseRuleForConversation([automated, humanReply])).toBeUndefined();
    });

    it('reports the first matching rule, so the reason is predictable', () => {
      const both = message({
        fromAddress: 'no-reply@amazon.co.uk',
        listUnsubscribe: '<https://x/unsub>',
      });

      expect(noiseRuleForConversation([both])?.id).toBe('no-reply-sender');
    });
  });
});
