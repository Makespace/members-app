import * as t from 'io-ts';

// Why a manager archived a conversation. Kept with the archive so it can be
// acted on later: everything archived as "hide like this" is the worked
// list for writing the next noise rule, and "resolved" is simply done.
export const MailboxArchiveReason = t.keyof({
  resolved: null,
  'hide-similar': null,
});

export type MailboxArchiveReason = t.TypeOf<typeof MailboxArchiveReason>;

// In the order the buttons appear. `button` is the word on the row;
// `label` says what it means, for the title and the archived view.
export const ARCHIVE_REASONS: ReadonlyArray<{
  reason: MailboxArchiveReason;
  button: string;
  label: string;
}> = [
  {
    reason: 'resolved',
    button: 'Resolved',
    label: 'Resolved - no further action needed',
  },
  {
    reason: 'hide-similar',
    button: 'Hide like this',
    label: 'Hide mail like this in future',
  },
];

export const archiveReasonButton = (reason: MailboxArchiveReason): string =>
  ARCHIVE_REASONS.find(candidate => candidate.reason === reason)?.button ??
  reason;
