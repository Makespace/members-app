import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../types';
import {StoredEventOfType} from '../types/domain-event';
import {SharedReadModel} from '../read-models/shared-state';
import {SyncWorkerDependencies} from './dependencies';
import {heldBackSendEmail} from '../trouble-tickets/notification-gate';
import {
  buildTrainingNotificationEmail,
  TrainingNotificationKind,
} from '../training-sessions/notification-email';

const NOTIFY_TYPES = [
  'TrainingSessionSignedUp',
  'TrainingSessionSignUpCancelled',
  'TrainingSessionCancelled',
] as const;

type NotifyEvent = StoredEventOfType<(typeof NOTIFY_TYPES)[number]>;

export type NotifyTrainingSessionDependencies = Pick<
  SyncWorkerDependencies,
  | 'logger'
  | 'sharedReadModel'
  | 'getAllEventsByType'
  | 'commitEvent'
  | 'sendEmail'
  | 'conf'
>;

// Far enough back to cover a worker that has been down for a few days.
const NOTIFY_EVENTS_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

const nameOf = (rm: SharedReadModel, memberNumber: number) =>
  pipe(
    rm.members.getByMemberNumber(memberNumber),
    O.chain(member => member.name),
    O.getOrElse(() => `Member ${memberNumber}`)
  );

const KIND: Record<NotifyEvent['type'], TrainingNotificationKind> = {
  TrainingSessionSignedUp: 'signed-up',
  TrainingSessionSignUpCancelled: 'place-cancelled',
  TrainingSessionCancelled: 'session-cancelled',
};

// The trainer hears about their own sessions filling and emptying; a
// cancelled session goes to everyone who was booked on it.
const recipientsFor = (
  event: NotifyEvent,
  session: {trainerMemberNumber: number; attendees: ReadonlyArray<number>}
): ReadonlyArray<number> => {
  switch (event.type) {
    case 'TrainingSessionSignedUp':
    case 'TrainingSessionSignUpCancelled':
      return [session.trainerMemberNumber];
    case 'TrainingSessionCancelled':
      return session.attendees;
  }
};

// Emails whoever should hear about a sign-up, a cancelled place or a
// cancelled session, recording a TrainingSessionNotificationSent event first
// so nothing is sent twice (preferring a missed email to a duplicate, as the
// other notifiers do). Held back by the same TROUBLE_TICKET_NOTIFY_TO setting
// as every other notification.
export const notifyTrainingSessions = async (
  deps: NotifyTrainingSessionDependencies,
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
      deps.logger.warn(
        'Failed to read training session events for notifications: %o',
        result.left
      );
    }
  }
  events.sort((a, b) => a.event_index - b.event_index);

  const send = heldBackSendEmail(deps);
  for (const event of events) {
    if (now.getTime() - event.recordedAt.getTime() > NOTIFY_EVENTS_WITHIN_MS) {
      continue;
    }
    if (rm.trainingSessions.hasNotifiedForEvent(event.event_index)) {
      continue;
    }
    const session = rm.trainingSessions.get(event.sessionId);
    if (O.isNone(session)) {
      continue;
    }
    const equipment = rm.equipment.get(session.value.equipmentId);
    if (O.isNone(equipment)) {
      continue;
    }
    const recipients = recipientsFor(event, session.value).flatMap(
      memberNumber =>
        pipe(
          rm.members.getByMemberNumber(memberNumber),
          O.match(
            () => [],
            member => [
              {memberNumber, email: member.primaryEmailAddress},
            ]
          )
        )
    );

    const committed = await deps.commitEvent(rm.getCurrentEventIndex())(
      constructEvent('TrainingSessionNotificationSent')({
        actor: {tag: 'system'},
        sessionId: session.value.id,
        notifiedEventIndex: event.event_index,
        recipientMemberNumbers: recipients.map(
          recipient => recipient.memberNumber
        ),
      })
    )();
    if (E.isLeft(committed)) {
      deps.logger.warn(
        'Failed to record training session notification for event %s: %o - will retry',
        event.event_index,
        committed.left
      );
      continue;
    }
    await rm.asyncRefresh()();

    const context = {
      publicUrl: deps.conf.PUBLIC_URL,
      equipmentId: equipment.value.id,
      equipmentName: equipment.value.name,
      startsAt: session.value.startsAt,
      endsAt: session.value.endsAt,
      trainerName: nameOf(rm, session.value.trainerMemberNumber),
      memberName:
        event.type === 'TrainingSessionCancelled'
          ? ''
          : nameOf(rm, event.memberNumber),
      booked: session.value.attendees.length,
      spaces: session.value.spaces,
      reason:
        event.type === 'TrainingSessionCancelled' ? event.reason : '',
    };
    for (const recipient of recipients) {
      const sent = await send(
        buildTrainingNotificationEmail(
          KIND[event.type],
          recipient.email,
          context
        )
      )();
      if (E.isLeft(sent)) {
        deps.logger.error(
          "Failed to send training session notification to '%s': %o",
          recipient.email,
          sent.left
        );
      }
    }
  }
};
