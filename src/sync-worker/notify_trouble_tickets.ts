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
import {heldBackSendEmail} from '../trouble-tickets/notification-gate';
import {summariseForEmail} from '../trouble-tickets/ticket-email-summary';
import {
  introBannerHtml,
  introBannerText,
  shouldIntroduce,
  ticketCardHtml,
  ticketUrl,
} from '../templates/trouble-ticket-email';
import {
  audienceFor,
  happeningOfEvent,
} from '../trouble-tickets/notification-audience';
import {
  describeAssignmentToAssignee,
  describeTicketChange,
  ticketNotificationOpening,
  ticketNotificationSubject,
  ticketNotificationText,
} from '../trouble-tickets/notification';
import {publicConfirmationEmail} from '../trouble-tickets/public-confirmation';
import {claimUrl} from '../trouble-tickets/claim-token';

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
    case 'public':
      return "Somebody who wasn't logged in";
  }
};

// The member a ticket was assigned to by somebody else; null for a member
// picking it up themselves, and for every other kind of change.
const handedToOf = (event: NotifyEvent): number | null =>
  event.type === 'TroubleTicketAssigned' &&
  !(
    event.actor.tag === 'user' &&
    event.actor.user.memberNumber === event.trainerMemberNumber
  )
    ? event.trainerMemberNumber
    : null;

// What the email says and who gets it live with the confirmation pages, so
// what a page promises is what is sent: see trouble-tickets/notification.

const buildEmail = (
  publicUrl: string,
  recipient: EmailAddress,
  ticket: TroubleTicket,
  change: string,
  isNew: boolean,
  theirs: boolean,
  summaryHtml: string,
  introduce: boolean,
  url: string
): Email => {
  const opening = ticketNotificationOpening(ticket.title, isNew, theirs);
  const text = ticketNotificationText(
    publicUrl,
    ticket.title,
    change,
    isNew,
    theirs,
    url
  );
  return {
    recipient,
    subject: ticketNotificationSubject(ticket.title, isNew, theirs),
    text: introduce ? `${introBannerText(publicUrl)}\n\n${text}` : text,
    html: mjml2html(`
      <mjml>
        <mj-body width="600px">
          <mj-section background-color="#fa990e">
            <mj-column>
              <mj-text align="center" color="#111" font-size="28px">Makespace</mj-text>
            </mj-column>
          </mj-section>
          <mj-section>
            <mj-column>
              ${introduce ? `<mj-raw>${introBannerHtml(publicUrl)}</mj-raw>` : ''}
              <mj-text font-size="16px" color="#111">
                <p>${opening.replace(`"${ticket.title}"`, `<strong>${ticket.title}</strong>`)}</p>
                <p>${change.replace(/\n/g, '<br/>')}</p>
              </mj-text>
              <mj-raw>${summaryHtml}</mj-raw>
              <mj-button background-color="#00703c" href="${url}">View this ticket</mj-button>
            </mj-column>
          </mj-section>
        </mj-body>
      </mjml>
    `).html,
  };
};

// What a ticket is called to somebody who might not have written it: the
// machine, as we name it.
const neutralTitle = (summary: {
  equipmentName: string | null;
  areaName: string | null;
}): string => summary.equipmentName ?? summary.areaName ?? 'your report';

// Members are asked for their number on forms, and mostly do not know it.
const memberNumberReminder = (memberNumber: number): string =>
  `Your member number is ${memberNumber}. It's worth knowing: you can log in to the app with it, and it's the quickest way for anybody at Makespace to find you.`;

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
    // A ticket handed to somebody by somebody else: the one it was handed
    // to is told, whatever their preferences say, because it is now theirs.
    const handedTo = handedToOf(event);
    const assignee = pipe(
      O.fromNullable(handedTo),
      O.chain(memberNumber => rm.members.getByMemberNumber(memberNumber))
    );
    const publicReport =
      event.type === 'TroubleTicketCreated' && event.source === 'public';
    const audience = audienceFor(rm, ticket.value, happening.value, {
      publicReport,
    }).filter(entry => entry.live);
    const recipients = pipe(
      assignee,
      O.match(
        () => audience,
        member =>
          audience.some(entry => entry.memberNumber === member.memberNumber)
            ? audience
            : [
                ...audience,
                {
                  memberNumber: member.memberNumber,
                  email: member.primaryEmailAddress,
                  live: true,
                  digest: null,
                  theirs: false,
                },
              ]
      )
    );
    // Worked out before the marker is written, because writing it is what
    // the count is made of: ask afterwards and everybody's first email looks
    // like their second.
    const introduceTo = new Set<number>(
      recipients
        .filter(
          entry =>
            entry.memberNumber > 0 &&
            shouldIntroduce(
              rm.notificationPreferences.emailsSentTo(entry.memberNumber)
            )
        )
        .map(entry => entry.memberNumber)
    );
    const commitResp = await deps.commitEvent(rm.getCurrentEventIndex())(
      constructEvent('TroubleTicketNotificationSent')({
        actor: {tag: 'system'},
        ticketId: ticketIdOf(event),
        notifiedEventIndex: event.event_index,
        recipients: recipients.map(entry => entry.email),
        // Somebody who wrote in without being a member has no number, and
        // -1 is how the audience says so.
        recipientMemberNumbers: recipients
          .map(entry => entry.memberNumber)
          .filter(memberNumber => memberNumber > 0),
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

    const actor = actorName(event.actor, rm);
    const change = describeTicketChange(
      pipe(
        assignee,
        O.match(
          () => event,
          member => ({
            ...event,
            assignee: O.getOrElse(() => `Member ${member.memberNumber}`)(
              member.name
            ),
          })
        )
      ),
      actor
    );
    const send = heldBackSendEmail(deps);
    const summary = summariseForEmail(rm, deps.conf.PUBLIC_URL, ticket.value);
    const isNew = event.type === 'TroubleTicketCreated';
    for (const entry of recipients) {
      const toAssignee =
        event.type === 'TroubleTicketAssigned' &&
        entry.memberNumber === handedTo;
      // An address that is not on anybody's account could be anybody's, so
      // it is never sent back what the reporter typed: not the answers, and
      // not the title, which starts out as the issue they described. It gets
      // the link to put the ticket on an account instead of one it could
      // not open.
      const stranger = entry.memberNumber <= 0;
      const words = toAssignee
        ? describeAssignmentToAssignee(actor, event.comment)
        : change;
      const email =
        publicReport && entry.theirs
          ? publicConfirmationEmail({
              recipient: entry.email,
              equipment: summary.equipmentName ?? summary.areaName,
              memberNumber: stranger ? null : entry.memberNumber,
              providedMemberNumber: ticket.value.providedMemberNumber,
              ticketUrl: ticketUrl(deps.conf.PUBLIC_URL, ticket.value.id),
              claimUrl: claimUrl(deps.conf, ticket.value.id),
            })
          : buildEmail(
              deps.conf.PUBLIC_URL,
              entry.email,
              stranger
                ? {...ticket.value, title: neutralTitle(summary)}
                : ticket.value,
              isNew && entry.theirs && !stranger
                ? `${words}\n\n${memberNumberReminder(entry.memberNumber)}`
                : words,
              isNew,
              entry.theirs,
              stranger ? '' : ticketCardHtml(summary),
              introduceTo.has(entry.memberNumber),
              stranger
                ? claimUrl(deps.conf, ticket.value.id)
                : ticketUrl(deps.conf.PUBLIC_URL, ticket.value.id)
            );
      const sent = await send(email)();
      if (E.isLeft(sent)) {
        deps.logger.error(
          "Failed to send trouble ticket notification to '%s': %o",
          entry.email,
          sent.left
        );
      }
    }
  }
};
