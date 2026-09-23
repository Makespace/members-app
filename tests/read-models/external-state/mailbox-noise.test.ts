import {InboxMessage} from '../../../src/read-models/external-state/gmail-inbox';
import {
  noiseRuleFor,
  noiseRuleForConversation,
} from '../../../src/read-models/external-state/mailbox-noise';

const message = (overrides: Partial<InboxMessage> = {}): InboxMessage => ({
  gmailMessageId: 'm1',
  gmailThreadId: 't1',
  rfc822MessageId: '<m1@test>',
  fromAddress: 'Alice Example <alice@example.com>',
  toAddresses: 'management@makespace.org',
  subject: '[Management] Building wifi down...',
  receivedAt: new Date('2026-09-23T09:42:00.000Z'),
  snippet: 'Hello',
  bodyText: 'Hello',
  bodyHtml: null,
  originalSender: 'alice@example.com',
  replyTo: null,
  listUnsubscribe: null,
  autoSubmitted: null,
  precedence: null,
  attachments: [],
  ...overrides,
});

// Headers taken verbatim from the saved copies of these notices.
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

describe('deciding what is mailbox noise', () => {
  describe('Amazon order and delivery notices', () => {
    it('are hidden', () => {
      expect(noiseRuleFor(amazonDeliveryUpdate)?.id).toBe(
        'amazon-order-updates'
      );
    });

    it('say why, so a wrong call can be reported', () => {
      expect(noiseRuleFor(amazonDeliveryUpdate)?.reason).toBe(
        'Amazon order and delivery notice'
      );
    });

    it('are hidden whichever spelling of the subject arrives', () => {
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

    it('include Amazon Business, on its own subdomain', () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: `'Amazon Business' via management <management@makespace.org>`,
            replyTo: 'Amazon Business <no-reply@business.amazon.co.uk>',
            originalSender: 'no-reply@business.amazon.co.uk',
            subject: '[admin] [Management] Save more with Quantity Discounts',
          })
        )?.id
      ).toBe('amazon-order-updates');
    });
  });

  // The rule names one supplier rather than describing a shape of message,
  // so anything it was not built for is left alone until there is a reason.
  describe('everything else is left alone', () => {
    it('keeps a member reporting a problem', () => {
      expect(noiseRuleFor(message())).toBeUndefined();
    });

    it('keeps a member asking a question', () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: 'Carol Example <carol@example.com>',
            originalSender: 'carol@example.com',
            subject: '[admin] See the space',
          })
        )
      ).toBeUndefined();
    });

    it('keeps automated mail from anyone else, which may well matter', () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: 'Recurly <no-reply@recurly.com>',
            originalSender: 'no-reply@recurly.com',
            subject: '[admin] Your Subscription Has Expired',
          })
        )
      ).toBeUndefined();
    });

    it('is not fooled by a lookalike domain', () => {
      expect(
        noiseRuleFor(
          message({originalSender: 'sales@not-amazon.co.uk.example.com'})
        )
      ).toBeUndefined();
    });

    it('keeps a member who merely writes about Amazon', () => {
      expect(
        noiseRuleFor(
          message({
            subject: 'Can we order this from Amazon?',
            bodyText: 'Found it on amazon.co.uk - shall I order one?',
          })
        )
      ).toBeUndefined();
    });
  });

  describe('conversations', () => {
    it('are noise only when every message is', () => {
      const robot = {...amazonDeliveryUpdate, gmailMessageId: 'm1'};
      const humanReply = message({
        gmailMessageId: 'm2',
        rfc822MessageId: '<m2@test>',
      });

      expect(noiseRuleForConversation([robot])).toBeDefined();
      // Someone replied to ask about the order, so the thread matters now.
      expect(noiseRuleForConversation([robot, humanReply])).toBeUndefined();
    });
  });
});
