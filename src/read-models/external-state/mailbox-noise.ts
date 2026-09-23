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

const NO_REPLY =
  /(^|[<:,\s])(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster)[@.-]/;

const NOISE_RULES: ReadonlyArray<NoiseRule> = [
  {
    id: 'no-reply-originator',
    reason: 'Sent by a no-reply address',
    // Mail forwarded by a Google Group arrives From the group, so the sender
    // looks like "'Amazon.co.uk' via management" and tells us nothing. The
    // group records who actually sent it in X-Original-Sender, which for a
    // supplier's robot is a no-reply address and for a member is their own.
    // That single header separates the two cleanly.
    matches: message =>
      message.originalSender !== null &&
      NO_REPLY.test(message.originalSender.toLowerCase()),
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
