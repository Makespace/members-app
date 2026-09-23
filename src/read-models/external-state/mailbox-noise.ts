import {InboxMessage} from './gmail-inbox';

// Most of what reaches a shared management address is not correspondence:
// order confirmations, marketing, delivery updates, account notices. Hiding
// it by default keeps the mailbox about members, while a toggle keeps every
// message reachable and each rule explains itself, so a wrong call is
// obvious rather than mysterious.
//
// Rules are deliberately narrow. A false negative leaves noise in the list,
// which is untidy; a false positive hides a member asking for help, which is
// a failure. When in doubt, no rule should match.
type NoiseRule = {
  // Stable identifier, used in the UI and when discussing a mis-filed message.
  id: string;
  // Shown on the row: why this was filtered.
  reason: string;
  matches: (message: InboxMessage) => boolean;
};

const fromAddress = (message: InboxMessage) =>
  (message.fromAddress ?? '').toLowerCase();

const subject = (message: InboxMessage) => (message.subject ?? '').toLowerCase();

const NO_REPLY =
  /(^|[<:,\s])(no-?reply|do-?not-?reply|donotreply|mailer-daemon|postmaster|bounce)[@.-]/;

// Google Groups rewrites the sender of anything it forwards, so a message
// from Amazon arrives as "'Amazon.co.uk' via management" and the real
// originator survives only in Reply-To. Both are worth checking.
const originators = (message: InboxMessage) =>
  [fromAddress(message), (message.replyTo ?? '').toLowerCase()];

// Every message delivered by a Google Group carries a List-Unsubscribe
// pointing at the group itself and Precedence: list - genuine member mail
// included. Those are delivery plumbing, not evidence of marketing, so only
// an unsubscribe link somewhere else counts.
const GROUP_PLUMBING = /googlegroups\.com|groups\.google\.com/;

const NOISE_RULES: ReadonlyArray<NoiseRule> = [
  {
    id: 'no-reply-sender',
    reason: 'Sent from a no-reply address',
    matches: message => originators(message).some(who => NO_REPLY.test(who)),
  },
  {
    id: 'bulk-mail',
    reason: 'Marketing mail (offers its own unsubscribe link)',
    matches: message =>
      message.listUnsubscribe !== null &&
      !GROUP_PLUMBING.test(message.listUnsubscribe),
  },
  {
    id: 'auto-generated',
    reason: 'Generated automatically, not written by a person',
    matches: message =>
      message.autoSubmitted !== null &&
      message.autoSubmitted.toLowerCase() !== 'no',
  },
  {
    id: 'account-security-alert',
    reason: "Google account notice about the app's own mailbox",
    matches: message =>
      /@(accounts\.)?google\.com/.test(fromAddress(message)) &&
      /^security alert/.test(subject(message)),
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
