import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {EmailAddress, EmailAddressCodec} from '../types/email-address';
import {SharedReadModel} from '../read-models/shared-state';
import {TroubleTicket} from '../types/trouble-ticket';

// What a trouble ticket notification says and who it goes to, in one place:
// the notifier sends it, and the confirmation page for each action shows the
// same thing before it happens, so nobody is surprised by what an email said
// or who it went to.

// A change to a ticket that the submitter is told about, in the shape the
// event carries. A confirmation page describes the change before it is
// made, with placeholders where the answers will go.
export type TicketChange =
  | {type: 'TroubleTicketCreated'}
  | {type: 'TroubleTicketAssigned'; comment: string}
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

export const ticketNotificationSubject = (
  title: string,
  isNew: boolean
): string =>
  isNew
    ? `We've logged your report: ${title}`
    : `Trouble ticket update: ${title}`;

export const ticketNotificationOpening = (
  title: string,
  isNew: boolean
): string =>
  isNew
    ? `We've logged your report about "${title}".`
    : `There's an update on the trouble ticket "${title}".`;

// The plain-text body, which is also what the confirmation page shows.
export const ticketNotificationText = (
  publicUrl: string,
  title: string,
  change: string,
  isNew: boolean
): string =>
  `Hi,\n\n${ticketNotificationOpening(title, isNew)}\n\n${change}\n\nSee the trouble tickets page: ${publicUrl}/trouble-tickets\n`;

// Everyone who hears about a change: the submitter - by their current
// primary address when they are a known member, else the address they gave
// if it is one - plus, for Needs Help, the equipment's trainers, so someone
// else can pick it up. Nobody is copied in. Each recipient gets their own
// email.
export const ticketNotificationRecipients = (
  rm: SharedReadModel,
  ticket: TroubleTicket,
  changeType: TicketChange['type']
): ReadonlyArray<EmailAddress> => {
  const emails = new Set<EmailAddress>();

  const submitterEmail =
    ticket.submittedMemberNumber !== null
      ? pipe(
          rm.members.getByMemberNumber(ticket.submittedMemberNumber),
          O.map(member => member.primaryEmailAddress)
        )
      : O.none;
  if (O.isSome(submitterEmail)) {
    emails.add(submitterEmail.value);
  } else if (ticket.submittedEmail) {
    pipe(
      EmailAddressCodec.decode(ticket.submittedEmail),
      E.match(
        () => {},
        email => emails.add(email)
      )
    );
  }

  if (changeType === 'TroubleTicketNeedsHelp' && ticket.equipmentId) {
    pipe(
      rm.equipment.get(ticket.equipmentId),
      O.match(
        () => {},
        equipment =>
          equipment.trainers.forEach(trainer =>
            emails.add(trainer.primaryEmailAddress)
          )
      )
    );
  }

  return [...emails];
};
