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
  audienceFor,
  happeningOfEvent,
} from '../trouble-tickets/notification-audience';
import {
  describeTicketChange,
  ticketNotificationOpening,
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
// Far enough back to cover a worker that has been down for a few days, and
// nowhere near far enough to reach the imported history.
const NOTIFY_EVENTS_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

export const notifyTroubleTicketChanges = async (
  deps: NotifyTroubleTicketDependencies,
  now: Date = new Date()
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
    // Nothing older than this is worth emailing anybody about. This replaces
    // a check that only app-raised tickets notify, which was standing in for
    // the real rule: the imported history must never email anybody. Saying it
    // by age says it for every kind of change rather than only creation, and
    // it lets a ticket raised on the Google form tell its submitter - which
    // the old check silenced, because a form ticket is not app-raised.
    if (
      now.getTime() - event.recordedAt.getTime() >
      NOTIFY_EVENTS_WITHIN_MS
    ) {
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
    //
    // Only the people who asked to hear as it happens are emailed now;
    // everybody else asked for a summary, and the summary will carry it.
    const happening = happeningOfEvent(event.type);
    if (O.isNone(happening)) {
      continue;
    }
    const recipients = audienceFor(rm, ticket.value, happening.value)
      .filter(entry => entry.when === 'live')
      .map(entry => entry.email);
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
