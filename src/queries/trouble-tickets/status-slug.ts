import * as O from 'fp-ts/Option';
import {TroubleTicketStatus} from '../../types/trouble-ticket';

// A status in a URL, in the readable form the filter chips link with. The
// board writes these and reads them back, so they live together: written as
// "in-progress" and parsed as "In Progress" is how a filter comes to do
// nothing when it is clicked.
export const STATUS_SLUG: Record<TroubleTicketStatus, string> = {
  Todo: 'todo',
  'In Progress': 'in-progress',
  'Needs Help': 'needs-help',
  Parked: 'parked',
  Resolved: 'resolved',
};

const BY_SLUG = new Map<string, TroubleTicketStatus>(
  Object.entries(STATUS_SLUG).map(([status, slug]) => [
    slug,
    status as TroubleTicketStatus,
  ])
);

// Also accepts the status written out ("In Progress"), because links shared
// or bookmarked before the chips used slugs carried it that way.
export const statusFromSlug = (
  value: string
): O.Option<TroubleTicketStatus> => {
  const normalised = value.trim().toLowerCase();
  const bySlug = BY_SLUG.get(normalised);
  if (bySlug !== undefined) {
    return O.some(bySlug);
  }
  const written = Object.keys(STATUS_SLUG).find(
    status => status.toLowerCase() === normalised
  );
  return written === undefined
    ? O.none
    : O.some(written as TroubleTicketStatus);
};
