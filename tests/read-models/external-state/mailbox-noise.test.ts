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
  replyTo: null,
  listUnsubscribe: null,
  autoSubmitted: null,
  precedence: null,
  attachments: [],
  ...overrides,
});

// The group's own unsubscribe link and Precedence, which every message it
// forwards carries - member mail included.
const VIA_GROUP = {
  listUnsubscribe:
    '<mailto:googlegroups-manage+511811749452+unsubscribe@googlegroups.com>, <https://groups.google.com/a/makespace.org/group/admin/subscribe>',
  precedence: 'list',
};

describe('deciding what is mailbox noise', () => {
  // Header values taken verbatim from real messages in the mailbox.
  describe('the examples that prompted these rules', () => {
    it('hides an Amazon delivery update forwarded by the group', () => {
      expect(
        noiseRuleFor(
          message({
            ...VIA_GROUP,
            fromAddress: `"'Amazon.co.uk' via management" <management@makespace.org>`,
            replyTo: '"Amazon.co.uk" <no-reply@amazon.co.uk>',
            subject: '[admin] [Management] Delivery estimate update for your Amazon order',
          })
        )?.id
      ).toBe('no-reply-sender');
    });

    it('hides Amazon Business marketing', () => {
      expect(
        noiseRuleFor(
          message({
            ...VIA_GROUP,
            fromAddress: `'Amazon Business' via management <management@makespace.org>`,
            replyTo: 'Amazon Business <no-reply@business.amazon.co.uk>',
            subject: '[admin] [Management] Save more with Quantity Discounts',
          })
        )?.id
      ).toBe('no-reply-sender');
    });

    it('hides a Farnell delivery notice', () => {
      expect(
        noiseRuleFor(
          message({
            ...VIA_GROUP,
            fromAddress: `'Farnell UK' via admin <admin@makespace.org>`,
            replyTo: 'Farnell UK <no-reply@delivery.farnell.com>',
            subject: '[admin] Your Order 20983020 has been delivered',
          })
        )?.id
      ).toBe('no-reply-sender');
    });

    it('hides a Mailchimp account notice, which declares itself automated', () => {
      expect(
        noiseRuleFor(
          message({
            ...VIA_GROUP,
            fromAddress: `'Mailchimp Account Services' via admin <admin@makespace.org>`,
            replyTo: 'Mailchimp Account Services <accountservices@mailchimp.com>',
            autoSubmitted: 'auto-generated',
            subject: '[admin] Automatically welcome your new subscribers',
          })
        )?.id
      ).toBe('auto-generated');
    });
  });

  // The failure that matters: every message a Google Group forwards carries
  // its unsubscribe link and Precedence: list, so treating either as
  // evidence of marketing would hide every member who writes to a group.
  describe('mail forwarded by a group is not noise by itself', () => {
    it('keeps a member reporting a problem', () => {
      expect(
        noiseRuleFor(
          message({
            ...VIA_GROUP,
            fromAddress: 'Tara Beattie <beattietara@gmail.com>',
            subject: '[Management] Building wifi down...',
          })
        )
      ).toBeUndefined();
    });

    it('keeps a member asking a question', () => {
      expect(
        noiseRuleFor(
          message({
            ...VIA_GROUP,
            fromAddress: 'Daniel Franklin <danielfranklin055@gmail.com>',
            subject: '[admin] See the space',
          })
        )
      ).toBeUndefined();
    });

    it('keeps an owner replying', () => {
      expect(
        noiseRuleFor(
          message({
            ...VIA_GROUP,
            fromAddress: 'Hector Dearman <hector.dearman@makespace.org>',
            subject: 'Re: [admin] [Management] Building wifi down...',
          })
        )
      ).toBeUndefined();
    });
  });
  describe('what gets hidden', () => {
    it('mail from a no-reply address', () => {
      expect(
        noiseRuleFor(message({fromAddress: 'Amazon <no-reply@amazon.co.uk>'}))
          ?.id
      ).toBe('no-reply-sender');
    });

    it('marketing that carries its own unsubscribe link', () => {
      expect(
        noiseRuleFor(
          message({
            listUnsubscribe:
              '<https://cam-skate.us17.list-manage.com/unsubscribe?u=21788f1e>',
          })
        )?.id
      ).toBe('bulk-mail');
    });

    it('machine-generated mail', () => {
      expect(noiseRuleFor(message({autoSubmitted: 'auto-generated'}))?.id).toBe(
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

    it('a message whose only unsubscribe link belongs to the group', () => {
      expect(noiseRuleFor(message(VIA_GROUP))).toBeUndefined();
    });

    it('Auto-Submitted: no, which explicitly denies being automated', () => {
      expect(noiseRuleFor(message({autoSubmitted: 'no'}))).toBeUndefined();
    });
  });

  describe('conversations', () => {
    it('is noise only when every message is', () => {
      const automated = message({
        gmailMessageId: 'm1',
        listUnsubscribe: '<https://list-manage.com/unsubscribe>',
      });
      const humanReply = message({gmailMessageId: 'm2'});

      expect(noiseRuleForConversation([automated])).toBeDefined();
      // Someone replied to the automated mail, so the thread matters now.
      expect(noiseRuleForConversation([automated, humanReply])).toBeUndefined();
    });

    it('reports the first matching rule, so the reason is predictable', () => {
      const both = message({
        fromAddress: 'no-reply@amazon.co.uk',
        listUnsubscribe: '<https://list-manage.com/unsubscribe>',
      });

      expect(noiseRuleForConversation([both])?.id).toBe('no-reply-sender');
    });
  });
});
