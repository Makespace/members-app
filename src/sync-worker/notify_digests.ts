import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import mjml2html from 'mjml';
import {constructEvent, Email} from '../types';
import {EmailAddress} from '../types/email-address';
import {SharedReadModel} from '../read-models/shared-state';
import {StoredEventOfType} from '../types/domain-event';
import {SyncWorkerDependencies} from './dependencies';
import {
  audienceFor,
  happeningOfEvent,
} from '../trouble-tickets/notification-audience';
import {digestEmail, DigestLine} from '../trouble-tickets/digest';
import {
  audienceOf,
  heldBackSendEmail,
  mayEmail,
} from '../trouble-tickets/notification-gate';

// The summaries. Everybody who asked to hear about tickets daily or weekly
// gets one email covering everything since their last, and nothing at all when
// nothing happened - a quiet week should cost nobody an email.

const NOTIFY_TYPES = [
  'TroubleTicketCreated',
  'TroubleTicketAssigned',
  'TroubleTicketResolved',
  'TroubleTicketParked',
  'TroubleTicketNeedsHelp',
] as const;

type DigestEvent = StoredEventOfType<(typeof NOTIFY_TYPES)[number]>;

const PERIOD_MS: Record<'daily' | 'weekly', number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

type NotifyDigestDependencies = Pick<
  SyncWorkerDependencies,
  | 'logger'
  | 'sharedReadModel'
  | 'getAllEventsByType'
  | 'commitEvent'
  | 'sendEmail'
  | 'conf'
>;

const ticketIdOf = (event: DigestEvent) =>
  event.type === 'TroubleTicketCreated' ? event.id : event.ticketId;

// Where a ticket lives, said the way somebody scanning a list would want it.
const placeOf = (rm: SharedReadModel, equipmentId: string | null): string =>
  equipmentId === null
    ? 'Makespace'
    : O.getOrElse(() => 'Makespace')(
        O.map((equipment: {name: string}) => equipment.name)(
          rm.equipment.get(equipmentId as Parameters<typeof rm.equipment.get>[0])
        )
      );

export const notifyDigests = async (
  deps: NotifyDigestDependencies,
  now: Date = new Date()
): Promise<void> => {
  await deps.sharedReadModel.asyncRefresh()();
  const rm = deps.sharedReadModel;

  const fetched = await Promise.all(
    NOTIFY_TYPES.map(type => deps.getAllEventsByType(type)())
  );
  const events: DigestEvent[] = [];
  for (const result of fetched) {
    if (E.isRight(result)) {
      events.push(...result.right);
    } else {
      deps.logger.warn(
        'Failed to read trouble ticket events for summaries: %o',
        result.left
      );
    }
  }
  events.sort((a, b) => a.event_index - b.event_index);
  if (events.length === 0) {
    return;
  }

  // Everybody who might be owed one: the people who have said something about
  // their notifications, plus everybody the defaults put on a summary - which
  // is every owner and every trainer.
  const candidates = new Set<number>(
    rm.notificationPreferences.membersWithAny()
  );
  for (const member of rm.members.getAll()) {
    if (member.ownerOf.length > 0 || member.trainerFor.length > 0) {
      candidates.add(member.memberNumber);
    }
  }

  for (const cadence of ['daily', 'weekly'] as const) {
    for (const memberNumber of candidates) {
      const member = rm.members.getByMemberNumber(memberNumber);
      if (O.isNone(member)) {
        continue;
      }
      const last = rm.notificationPreferences.lastDigest(memberNumber, cadence);
      // Not due yet. Checked before any work is done for them.
      if (
        O.isSome(last) &&
        now.getTime() - last.value.sentAt.getTime() < PERIOD_MS[cadence]
      ) {
        continue;
      }
      // Never sent one: cover the period just gone rather than everything
      // that ever happened.
      const since = O.isSome(last)
        ? last.value.upToEventIndex
        : -1;
      const earliest = O.isSome(last)
        ? last.value.sentAt.getTime()
        : now.getTime() - PERIOD_MS[cadence];

      const lines: DigestLine[] = [];
      let upTo = since;
      for (const event of events) {
        if (event.event_index <= since) {
          continue;
        }
        if (event.recordedAt.getTime() < earliest) {
          continue;
        }
        upTo = Math.max(upTo, event.event_index);
        if (event.type === 'TroubleTicketResolved' && event.quiet) {
          continue;
        }
        const happening = happeningOfEvent(event.type);
        if (O.isNone(happening)) {
          continue;
        }
        const ticket = rm.troubleTickets.getById(ticketIdOf(event));
        if (O.isNone(ticket)) {
          continue;
        }
        const wanted = audienceFor(rm, ticket.value, happening.value).find(
          entry =>
            entry.memberNumber === memberNumber && entry.when === cadence
        );
        if (wanted === undefined) {
          continue;
        }
        lines.push({
          title: ticket.value.title === '' ? 'A trouble ticket' : ticket.value.title,
          place: placeOf(rm, ticket.value.equipmentId),
          happening: happening.value,
          at: event.recordedAt,
        });
      }

      // A quiet week costs nobody an email, and leaves no mark saying one was
      // sent - so the next one still covers the period just gone.
      if (lines.length === 0) {
        continue;
      }

      // The watermark moves either way, so a held-back stretch does not pile
      // up into a backlog the day the mail is switched on. The event says
      // which it was, rather than claiming a summary that never arrived.
      const willSend = mayEmail(
        audienceOf(deps),
        member.value.primaryEmailAddress
      );
      const committed = await deps.commitEvent(rm.getCurrentEventIndex())(
        constructEvent('MemberTicketDigestSent')({
          actor: {tag: 'system'},
          memberNumber,
          cadence,
          upToEventIndex: upTo,
          changeCount: lines.length,
          suppressed: !willSend,
        })
      )();
      if (E.isLeft(committed)) {
        deps.logger.warn(
          {memberNumber, cadence, failure: committed.left},
          'Could not record a summary - will try again'
        );
        continue;
      }

      const sent = await heldBackSendEmail(deps)(
        buildDigest(
          deps.conf.PUBLIC_URL,
          member.value.primaryEmailAddress,
          cadence,
          lines
        )
      )();
      if (E.isLeft(sent)) {
        deps.logger.error(
          {memberNumber, cadence, failure: sent.left},
          'Failed to send a trouble ticket summary'
        );
      }
    }
  }
};

const buildDigest = (
  publicUrl: string,
  recipient: EmailAddress,
  cadence: 'daily' | 'weekly',
  lines: ReadonlyArray<DigestLine>
): Email => {
  const {subject, text, html} = digestEmail(publicUrl, cadence, lines);
  return {recipient, subject, text, html: mjml2html(html).html};
};
