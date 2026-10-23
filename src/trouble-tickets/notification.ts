
// What a trouble ticket notification says and who it goes to, in one place:
// the notifier sends it, and the confirmation page for each action shows the
// same thing before it happens, so nobody is surprised by what an email said
// or who it went to.

// A change to a ticket that the submitter is told about, in the shape the
// event carries. A confirmation page describes the change before it is
// made, with placeholders where the answers will go.
export type TicketChange =
  | {type: 'TroubleTicketCreated'}
  // assignee is set when somebody assigned the ticket to someone else; a
  // member picking a ticket up themselves leaves it out.
  | {type: 'TroubleTicketAssigned'; comment: string; assignee?: string}
  | {type: 'TroubleTicketResolved'; summary: string}
  | {
      type: 'TroubleTicketParked';
      whyParked: string;
      pathToResolution: string;
      intermediateActions: string;
    }
  | {type: 'TroubleTicketNeedsHelp'; whatTried: string; whyDidntWork: string};

// The change, as the email describes it.
export const describeTicketChange = (
  change: TicketChange,
  actor: string
): string => {
  switch (change.type) {
    case 'TroubleTicketCreated':
      return "Thanks for letting us know about this issue. One of the owners of the equipment will address it soon.\n\nIf the equipment is not useable, or is unsafe, please put a sign on it telling other members, and consider a post on the Google group.";
    case 'TroubleTicketAssigned':
      // Assigned by somebody else, the comment is the assigner's, not the
      // words of whoever is now working on it.
      if (change.assignee !== undefined) {
        return change.comment !== ''
          ? `${change.assignee} is now working on this ticket (assigned by ${actor}).\n\n${actor} said: ${change.comment}`
          : `${change.assignee} is now working on this ticket (assigned by ${actor}).`;
      }
      return change.comment !== ''
        ? `${actor} is now working on this ticket.\n\nThey said: ${change.comment}`
        : `${actor} is now working on this ticket.`;
    case 'TroubleTicketResolved':
      return `${actor} marked this ticket as Resolved.\n\nWhat they did: ${change.summary}`;
    case 'TroubleTicketParked':
      return `${actor} parked this ticket.\n\nWhy: ${change.whyParked}\nPath to resolution: ${change.pathToResolution}\nIntermediate actions: ${change.intermediateActions}`;
    case 'TroubleTicketNeedsHelp':
      return `${actor} looked at this ticket but needs help, so it's open for another trainer to pick up.\n\nWhat they tried: ${change.whatTried}\nWhy it didn't work: ${change.whyDidntWork}`;
  }
};

// What the member a ticket was handed to is told: it is theirs now, and who
// gave it to them.
export const describeAssignmentToAssignee = (
  actor: string,
  comment: string
): string =>
  comment !== ''
    ? `${actor} has assigned this ticket to you.\n\nThey said: ${comment}`
    : `${actor} has assigned this ticket to you.`;

// An invitation to help with a ticket, as the invitee reads it.
export const describeInvitation = (actor: string, message: string): string =>
  (message !== ''
    ? `${actor} has invited you to help with this ticket.\n\nThey said: ${message}`
    : `${actor} has invited you to help with this ticket.`) +
  '\n\nOpen the ticket to accept or decline.';

// The inviter hearing that somebody cannot help.
export const describeInvitationDeclined = (actor: string): string =>
  `${actor} has declined your invitation to help with this ticket.`;

// A new ticket reads differently to the person who reported it than to the
// owner of the machine it is about: one is being thanked, the other is being
// told there is something to look at. Only consulted for a new ticket - an
// update to one reads the same either way.
export const ticketNotificationSubject = (
  title: string,
  isNew: boolean,
  theirs: boolean
): string => {
  if (!isNew) {
    return `Trouble ticket update: ${title}`;
  }
  return theirs
    ? `We've logged your report: ${title}`
    : `New trouble ticket: ${title}`;
};

export const ticketNotificationOpening = (
  title: string,
  isNew: boolean,
  theirs: boolean
): string => {
  if (!isNew) {
    return `There's an update on the trouble ticket "${title}".`;
  }
  return theirs
    ? `We've logged your report about "${title}".`
    : `Somebody has reported a problem: "${title}".`;
};

// The plain-text body, which is also what the confirmation page shows.
export const ticketNotificationText = (
  publicUrl: string,
  title: string,
  change: string,
  isNew: boolean,
  theirs: boolean,
  // The ticket's own address, when there is one to give. A notification about
  // one thing should land on that thing rather than on a list to search.
  url?: string
): string =>
  `Hi,\n\n${ticketNotificationOpening(title, isNew, theirs)}\n\n${change}\n\n${
    url === undefined
      ? `See the trouble tickets page: ${publicUrl}/trouble-tickets`
      : `See this ticket: ${url}`
  }\n`;

// Everyone who hears about a change: the submitter - by their current
// primary address when they are a known member, else the address they gave
// if it is one - plus, for Needs Help, the equipment's trainers, so someone
// else can pick it up. Nobody is copied in. Each recipient gets their own
// email.
