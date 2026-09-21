import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import mjml2html from 'mjml';
import {constructEvent, Email} from '../types';
import {Actor} from '../types/actor';
import {EmailAddress, EmailAddressCodec} from '../types/email-address';
import {SharedReadModel} from '../read-models/shared-state';
import {TroubleTicket} from '../types/trouble-ticket';
import {StoredEventOfType} from '../types/domain-event';
import {SyncWorkerDependencies} from './dependencies';

// The status changes we notify about.
const NOTIFY_TYPES = [
  'TroubleTicketAssigned',
  'TroubleTicketResolved',
  'TroubleTicketParked',
  'TroubleTicketNeedsHelp',
] as const;

type NotifyEvent = StoredEventOfType<(typeof NOTIFY_TYPES)[number]>;

export type NotifyTroubleTicketDependencies = Pick<
  SyncWorkerDependencies,
  'logger' | 'sharedReadModel' | 'getAllEventsByType' | 'commitEvent' | 'sendEmail' | 'conf'
>;

const actorName = (actor: Actor, rm: SharedReadModel): string => {
  switch (actor.tag) {
    case 'user':
      return pipe(
        rm.members.getByMemberNumber(actor.user.memberNumber),
        O.chain(member => member.name),
        O.getOrElse(() => `Member ${actor.user.memberNumber}`)
      );
    case 'token':
      return 'An administrator';
    case 'system':
      return 'The system';
  }
};

// The change description for the notification body.
const describeChange = (event: NotifyEvent, actor: string): string => {
  switch (event.type) {
    case 'TroubleTicketAssigned':
      return `${actor} is now working on this ticket.`;
    case 'TroubleTicketResolved':
      return `${actor} marked this ticket as Resolved.\n\nWhat they did: ${event.summary}`;
    case 'TroubleTicketParked':
      return `${actor} parked this ticket.\n\nWhy: ${event.whyParked}\nPath to resolution: ${event.pathToResolution}\nIntermediate actions: ${event.intermediateActions}`;
    case 'TroubleTicketNeedsHelp':
      return `${actor} looked at this ticket but needs help, so it's open for another trainer to pick up.\n\nWhat they tried: ${event.whatTried}\nWhy it didn't work: ${event.whyDidntWork}`;
  }
};

// Everyone who should hear about a change: the original submitter, plus (for Needs Help)
// the equipment's trainers so someone else can pick it up.
const collectRecipients = (
  rm: SharedReadModel,
  ticket: TroubleTicket,
  event: NotifyEvent
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

  if (event.type === 'TroubleTicketNeedsHelp' && ticket.equipmentId) {
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

const buildEmail = (
  publicUrl: string,
  recipient: EmailAddress,
  ticket: TroubleTicket,
  change: string
): Email => {
  const text = `Hi,\n\nThere's an update on the trouble ticket "${ticket.title}".\n\n${change}\n\nSee the trouble tickets page: ${publicUrl}/trouble-tickets\n`;
  return {
    recipient,
    subject: `Trouble ticket update: ${ticket.title}`,
    text,
    html: mjml2html(`
      <mjml>
        <mj-body width="600px">
          <mj-section background-color="#fa990e">
            <mj-column>
              <mj-text align="center" color="#111" font-size="28px">MakeSpace</mj-text>
            </mj-column>
          </mj-section>
          <mj-section>
            <mj-column>
              <mj-text font-size="16px" color="#111">
                <p>There's an update on the trouble ticket <strong>${ticket.title}</strong>.</p>
                <p>${change.replace(/\n/g, '<br/>')}</p>
              </mj-text>
              <mj-button background-color="#00703c" href="${publicUrl}/trouble-tickets">View trouble tickets</mj-button>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `).html,
  };
};

// Sends notification emails for any status-change events not yet notified, recording a
// TroubleTicketNotificationSent event per change so it isn't sent twice. Commits the
// "sent" marker before emailing (preferring a missed email over a duplicate, matching the
// training-summary emailer).
export const notifyTroubleTicketChanges = async (
  deps: NotifyTroubleTicketDependencies
): Promise<void> => {
  await deps.sharedReadModel.asyncRefresh()();
  const rm = deps.sharedReadModel;

  const fetched = await Promise.all(
    NOTIFY_TYPES.map(type => deps.getAllEventsByType(type)())
  );
  const events: NotifyEvent[] = [];
  for (const result of fetched) {
    if (E.isRight(result)) {
      events.push(...result.right);
    } else {
      deps.logger.warn('Failed to read trouble ticket events for notifications: %o', result.left);
    }
  }
  events.sort((a, b) => a.event_index - b.event_index);

  for (const event of events) {
    if (rm.troubleTickets.hasNotifiedForEvent(event.event_index)) {
      continue;
    }
    const commitResp = await deps.commitEvent(rm.getCurrentEventIndex())(
      constructEvent('TroubleTicketNotificationSent')({
        actor: {tag: 'system'},
        ticketId: event.ticketId,
        notifiedEventIndex: event.event_index,
      })
    )();
    if (E.isLeft(commitResp)) {
      deps.logger.warn(
        'Failed to record trouble ticket notification for event %s: %o - will retry',
        event.event_index,
        commitResp.left
      );
      continue;
    }

    const ticket = rm.troubleTickets.getById(event.ticketId);
    if (O.isNone(ticket)) {
      continue;
    }
    const change = describeChange(event, actorName(event.actor, rm));
    for (const recipient of collectRecipients(rm, ticket.value, event)) {
      const sent = await deps.sendEmail(
        buildEmail(deps.conf.PUBLIC_URL, recipient, ticket.value, change)
      )();
      if (E.isLeft(sent)) {
        deps.logger.error(
          "Failed to send trouble ticket notification to '%s': %o",
          recipient,
          sent.left
        );
      }
    }
  }
};
