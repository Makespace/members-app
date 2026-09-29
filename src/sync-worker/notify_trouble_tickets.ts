import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import mjml2html from 'mjml';
import {constructEvent, Email} from '../types';
import {Actor} from '../types/actor';
import {EmailAddress} from '../types/email-address';
import {SharedReadModel} from '../read-models/shared-state';
import {TroubleTicket} from '../types/trouble-ticket';
import {StoredEventOfType} from '../types/domain-event';
import {SyncWorkerDependencies} from './dependencies';
import {
  describeTicketChange,
  ticketNotificationOpening,
  ticketNotificationRecipients,
  ticketNotificationSubject,
  ticketNotificationText,
} from '../trouble-tickets/notification';

// The status changes we notify about.
const NOTIFY_TYPES = [
  // Only app-raised tickets notify on creation - the imported history would
  // otherwise email hundreds of members about years-old reports.
  'TroubleTicketCreated',
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

// Creation names the ticket 'id'; every later event names it 'ticketId'.
const ticketIdOf = (event: NotifyEvent) =>
  event.type === 'TroubleTicketCreated' ? event.id : event.ticketId;

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

// What the email says and who gets it live with the confirmation pages, so
// what a page promises is what is sent: see trouble-tickets/notification.

const buildEmail = (
  publicUrl: string,
  recipient: EmailAddress,
  ticket: TroubleTicket,
  change: string,
  isNew: boolean
): Email => {
  const opening = ticketNotificationOpening(ticket.title, isNew);
  const text = ticketNotificationText(publicUrl, ticket.title, change, isNew);
  return {
    recipient,
    subject: ticketNotificationSubject(ticket.title, isNew),
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
                <p>${opening.replace(`"${ticket.title}"`, `<strong>${ticket.title}</strong>`)}</p>
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
    // A quiet resolve (backlog clearing) never notifies - skipped before the
    // marker commit so it leaves no trace in the event log either.
    if (event.type === 'TroubleTicketResolved' && event.quiet) {
      continue;
    }
    // Only tickets raised in the app get a creation confirmation: the
    // imported sheet history must never email anybody.
    if (event.type === 'TroubleTicketCreated' && event.source !== 'app') {
      continue;
    }
    if (rm.troubleTickets.hasNotifiedForEvent(event.event_index)) {
      continue;
    }
    const ticket = rm.troubleTickets.getById(ticketIdOf(event));
    if (O.isNone(ticket)) {
      continue;
    }
    // Who it is going to is decided first and recorded with the marker, so
    // the ticket's own history can say who was told.
    const recipients = ticketNotificationRecipients(
      rm,
      ticket.value,
      event.type
    );
    const commitResp = await deps.commitEvent(rm.getCurrentEventIndex())(
      constructEvent('TroubleTicketNotificationSent')({
        actor: {tag: 'system'},
        ticketId: ticketIdOf(event),
        notifiedEventIndex: event.event_index,
        recipients: [...recipients],
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

    const change = describeTicketChange(event, actorName(event.actor, rm));
    for (const recipient of recipients) {
      const sent = await deps.sendEmail(
        buildEmail(
          deps.conf.PUBLIC_URL,
          recipient,
          ticket.value,
          change,
          event.type === 'TroubleTicketCreated'
        )
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
