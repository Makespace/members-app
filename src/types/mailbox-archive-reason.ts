import * as t from 'io-ts';

// Why a manager archived a conversation. Kept with the archive so it can be
// acted on later: everything archived as "hide like this" is the worked
// list for writing the next noise rule, and "resolved" is simply done.
export const MailboxArchiveReason = t.keyof({
  resolved: null,
  'hide-similar': null,
});

export type MailboxArchiveReason = t.TypeOf<typeof MailboxArchiveReason>;

// In the order the buttons appear. `icon` is the button (Font Awesome
// regular, the only style the site loads), `label` what it means - shown on
// hover and read out - and `button` the short name for the archived view.
export const ARCHIVE_REASONS: ReadonlyArray<{
  reason: MailboxArchiveReason;
  icon: string;
  button: string;
  label: string;
}> = [
  {
    reason: 'resolved',
    icon: 'fa-circle-check',
    button: 'Resolved',
    label: 'Resolved - no further action needed',
  },
  {
    reason: 'hide-similar',
    icon: 'fa-eye-slash',
    button: 'Hide like this',
    label: 'Hide mail like this in future',
  },
];

export const archiveReasonButton = (reason: MailboxArchiveReason): string =>
  ARCHIVE_REASONS.find(candidate => candidate.reason === reason)?.button ??
  reason;
