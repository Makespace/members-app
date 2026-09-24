import {InboxMessage} from './gmail-inbox';

// Most of what reaches a shared address is not correspondence: order
// confirmations, delivery updates, marketing. Hiding it keeps the mailbox
// about members, while a toggle keeps every message reachable and each rule
// explains itself, so a wrong call is visible rather than mysterious.
//
// Rules are built from real messages, one at a time, and stay as narrow as
// the evidence: a false negative leaves clutter in the list, which is
// untidy, but a false positive hides a member asking for help, which is a
// failure. Nothing is hidden on a hunch.
type NoiseRule = {
  // Stable identifier, shown in the UI so a mis-filed message can be
  // reported precisely.
  id: string;
  reason: string;
  matches: (message: InboxMessage) => boolean;
};

// Suppliers whose order and delivery mail is never correspondence. Matching
// on the sender's domain keeps each rule about one identifiable source,
// rather than guessing from the shape of a message: no member has an
// address at these domains, so nothing a person writes can match.
const senderDomainIs =
  (domains: ReadonlyArray<string>) =>
  (message: InboxMessage): boolean => {
    // Mail forwarded by a Google Group arrives From the group, so the sender
    // reads "'Amazon.co.uk' via management" whoever wrote it. The group
    // records the real originator in X-Original-Sender; Reply-To carries it
    // for mail that arrived some other way.
    const candidates = [
      message.originalSender,
      message.replyTo,
      message.fromAddress,
    ].filter((value): value is string => value !== null);
    return candidates.some(candidate =>
      domains.some(domain =>
        new RegExp(`@([a-z0-9-]+\\.)*${domain.replace(/\./g, '\\.')}\\b`, 'i').test(
          candidate
        )
      )
    );
  };

// A Google Group rewrites the From of everything it forwards to its own
// address, and builds the display name from the original sender's:
//
//   "'Amazon Business' via management" <management@makespace.org>
//
// For mail imported before X-Original-Sender was stored, that name is the
// only trace left of who wrote it - and the copies in question have since
// been archived, so no re-list will ever fill the header in. Every Amazon
// notice arrives twice (tickets@ is in two groups), the copies share a
// conversation, and one copy the rule cannot judge unhides both.
//
// This matches the relay format exactly - the quoted name followed by
// " via " - so it still names one supplier by the name Amazon itself sends,
// rather than anything that mentions it. A member who merely called
// themselves "Amazon Business" would not arrive in that shape.
const relayedFrom =
  (names: ReadonlyArray<string>) =>
  (message: InboxMessage): boolean =>
    message.fromAddress !== null &&
    names.some(name =>
      new RegExp(
        `^\\s*"?'${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'\\s+via\\s`,
        'i'
      ).test(message.fromAddress as string)
    );

const either =
  (...matchers: ReadonlyArray<(message: InboxMessage) => boolean>) =>
  (message: InboxMessage): boolean =>
    matchers.some(matches => matches(message));

const NOISE_RULES: ReadonlyArray<NoiseRule> = [
  {
    id: 'amazon-order-updates',
    reason: 'Amazon order and delivery notice',
    matches: either(
      // Covers amazon.co.uk and amazon.com, and their subdomains -
      // business.amazon.co.uk, delivery.amazon.co.uk and the like.
      senderDomainIs(['amazon.co.uk', 'amazon.com']),
      // The names Amazon sends under, as the group relays them.
      relayedFrom(['Amazon.co.uk', 'Amazon.com', 'Amazon Business'])
    ),
  },
];

// The rule that hides a message, if any. The first match wins, so the list
// reads as a priority order.
export const noiseRuleFor = (message: InboxMessage): NoiseRule | undefined =>
  NOISE_RULES.find(rule => rule.matches(message));

// A conversation is noise only when every message in it is: one human reply
// makes the whole thread worth reading, however it started.
export const noiseRuleForConversation = (
  messages: ReadonlyArray<InboxMessage>
): NoiseRule | undefined => {
  const rules = messages.map(noiseRuleFor);
  if (rules.some(rule => rule === undefined)) {
    return undefined;
  }
  return rules[0];
};
