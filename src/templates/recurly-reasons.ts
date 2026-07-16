import {Html, html, joinHtml} from '../types/html';
import {RecurlyReason} from '../read-models/external-state/recurly-status';
import {tag} from './member-status';

// Maps a reason code to a coloured chip. Uses the existing tag palette
// (grey / green / yellow / red — see styles.css). Exhaustive on purpose:
// adding a new RecurlyReason without a chip here is a compile error.
const reasonChip = (reason: RecurlyReason): Html => {
  switch (reason) {
    case 'cancelled-in-term':
      return tag(html`Cancelled – still has access`, 'yellow');
    case 'paused':
      return tag(html`Paused`, 'yellow');
    case 'past-due':
      return tag(html`Payment overdue`, 'red');
    case 'future-only':
      return tag(html`Not started yet`, 'grey');
    case 'expired':
      return tag(html`Expired`, 'grey');
    case 'no-data':
      return tag(html`No recent Recurly data`, 'grey');
  }
};

// One or more chips, space-separated (an owner can be, e.g., cancelled AND overdue).
export const renderReasonChips = (
  reasons: ReadonlyArray<RecurlyReason>
): Html => joinHtml(reasons.map(reason => html`${reasonChip(reason)} `));
