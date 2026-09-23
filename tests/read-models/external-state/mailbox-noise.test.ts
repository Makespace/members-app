import {InboxMessage} from '../../../src/read-models/external-state/gmail-inbox';
import {
  noiseRuleFor,
  noiseRuleForConversation,
} from '../../../src/read-models/external-state/mailbox-noise';

const message = (overrides: Partial<InboxMessage> = {}): InboxMessage => ({
  gmailMessageId: 'm1',
  gmailThreadId: 't1',
  fromAddress: 'Tara Beattie <beattietara@gmail.com>',
  toAddresses: 'management@makespace.org',
  subject: '[Management] Building wifi down...',
  receivedAt: new Date('2026-09-23T09:42:00.000Z'),
  snippet: 'Hello',
  bodyText: 'Hello',
  bodyHtml: null,
  originalSender: 'beattietara@gmail.com',
  replyTo: null,
  listUnsubscribe: null,
  autoSubmitted: null,
  precedence: null,
  attachments: [],
  ...overrides,
});

// Everything a Google Group forwards arrives From the group, so the sender
// reads "'Amazon.co.uk' via management" whoever wrote it. The group records
// the real originator in X-Original-Sender, which is what these rules use.
describe('deciding what is mailbox noise', () => {
  describe('the Amazon delivery updates these rules were built from', () => {
    // Headers taken verbatim from the nine saved copies.
    const amazonDeliveryUpdate = message({
      fromAddress: `"'Amazon.co.uk' via management" <management@makespace.org>`,
      replyTo: '"Amazon.co.uk" <no-reply@amazon.co.uk>',
      originalSender: 'no-reply@amazon.co.uk',
      subject:
        '[admin] [Management] Delivery estimate update for your Amazon order #205-9015748-1363506',
      listUnsubscribe:
        '<mailto:googlegroups-manage+511811749452+unsubscribe@googlegroups.com>',
      precedence: 'list',
    });

    it('hides them', () => {
      expect(noiseRuleFor(amazonDeliveryUpdate)?.id).toBe(
        'no-reply-originator'
      );
    });

    it('says why, so a wrong call can be reported', () => {
      expect(noiseRuleFor(amazonDeliveryUpdate)?.reason).toBe(
        'Sent by a no-reply address'
      );
    });

    it('hides the .com spelling of the same notice', () => {
      expect(
        noiseRuleFor(
          message({
            ...amazonDeliveryUpdate,
            subject:
              '[admin] [Management] Delivery estimate update for your Amazon.com order #205-9015748-1363506',
          })
        )
      ).toBeDefined();
    });
  });

  describe('people are never hidden', () => {
    it('keeps a member reporting a problem', () => {
      expect(noiseRuleFor(message())).toBeUndefined();
    });

    it('keeps a member asking a question', () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: 'Daniel Franklin <danielfranklin055@gmail.com>',
            originalSender: 'danielfranklin055@gmail.com',
            subject: '[admin] See the space',
          })
        )
      ).toBeUndefined();
    });

    it('keeps an owner replying', () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: 'Hector Dearman <hector.dearman@makespace.org>',
            originalSender: 'hector.dearman@makespace.org',
          })
        )
      ).toBeUndefined();
    });

    it('keeps a person whose address merely contains "reply"', () => {
      expect(
        noiseRuleFor(message({originalSender: 'ripley@example.com'}))
      ).toBeUndefined();
    });

    it('keeps anything the group did not label with an originator', () => {
      expect(noiseRuleFor(message({originalSender: null}))).toBeUndefined();
    });
  });

  describe('conversations', () => {
    it('are noise only when every message is', () => {
      const robot = message({
        gmailMessageId: 'm1',
        originalSender: 'no-reply@amazon.co.uk',
      });
      const humanReply = message({gmailMessageId: 'm2'});

      expect(noiseRuleForConversation([robot])).toBeDefined();
      // Someone replied, so the thread matters now.
      expect(noiseRuleForConversation([robot, humanReply])).toBeUndefined();
    });
  });
});
