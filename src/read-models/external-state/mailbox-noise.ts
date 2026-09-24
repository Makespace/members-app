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
      domains.some(domain => domainPattern(domain).test(candidate))
    );
  };

// The domain is looked for anywhere in the sender, not only after an "@".
// A rule that reads only the address can say nothing about the mail a Google
// Group forwards, because the address there is the group's; the supplier
// survives in the display name the group builds from the original sender -
// "'Amazon.co.uk' via management" <management@makespace.org>. Requiring the
// "@" meant the rule could only judge messages imported after
// X-Original-Sender was first stored, which left everything already in the
// cache permanently unfilterable.
//
// The leading boundary is what keeps this honest: it matches "@amazon.co.uk"
// and "'Amazon.co.uk'" but not "notamazon.co.uk", so the rule still names one
// supplier rather than matching anything with the word in it.
const domainPattern = (domain: string) =>
  new RegExp(
    `(^|[^a-z0-9.-])([a-z0-9-]+\\.)*${domain.replace(/\./g, '\\.')}\\b`,
    'i'
  );

const NOISE_RULES: ReadonlyArray<NoiseRule> = [
  {
    id: 'amazon-order-updates',
    reason: 'Amazon order and delivery notice',
    // Covers amazon.co.uk and amazon.com, and their subdomains -
    // business.amazon.co.uk, delivery.amazon.co.uk and the like.
    matches: senderDomainIs(['amazon.co.uk', 'amazon.com']),
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
