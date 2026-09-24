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

    // Everything imported before X-Original-Sender was first stored has no
    // header to judge, and a group rewrites the address to its own - so the
    // display name the group builds is all that is left to go on. Without
    // this, those messages could never be filtered, however the rules were
    // later written.
    it('are hidden on the display name alone, as older imports arrive', () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: `"'Amazon.co.uk' via management" <management@makespace.org>`,
            replyTo: null,
            originalSender: null,
            subject: '[Management] Delivery estimate update for your order',
          })
        )?.id
      ).toBe('amazon-order-updates');
    });

    // The Amazon Business name carries no domain, so only the relay format
    // itself can identify the copies that never got a header.
    it('are hidden on the relayed name alone, whichever name Amazon sends under', () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: `"'Amazon Business' via management" <management@makespace.org>`,
            replyTo: null,
            originalSender: null,
            subject: '[Management] Save more with Quantity Discounts',
          })
        )?.id
      ).toBe('amazon-order-updates');
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

    // The reason the match is anchored on a boundary rather than loose: a
    // member at a domain that merely ends the same way is still a member.
    it('keeps a member at a lookalike domain, name and all', () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: 'A Member <member@notamazon.co.uk>',
            replyTo: null,
            originalSender: 'member@notamazon.co.uk',
          })
        )
      ).toBeUndefined();
    });

    it('keeps a member whose own message is about an Amazon order', () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: 'A Member <member@makespace.org>',
            replyTo: 'A Member <member@makespace.org>',
            originalSender: null,
            subject: 'Amazon order for the workshop',
          })
        )
      ).toBeUndefined();
    });

    // The relay match is anchored on the group's " via " shape, so a name is
    // only evidence when a group is vouching for where it came from.
    it('keeps a member who merely calls themselves Amazon Business', () => {
      expect(
        noiseRuleFor(
          message({
            fromAddress: 'Amazon Business <member@example.com>',
            replyTo: null,
            originalSender: 'member@example.com',
          })
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
