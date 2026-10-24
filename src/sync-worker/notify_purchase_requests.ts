import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../types';
import {StoredEventOfType} from '../types/domain-event';
import {SharedReadModel} from '../read-models/shared-state';
import {PurchaseRequest} from '../read-models/shared-state/return-types';
import {SyncWorkerDependencies} from './dependencies';
import {heldBackSendEmail} from '../trouble-tickets/notification-gate';
import {
  Recipient,
  recipientsForNewRequest,
  recipientsForOutcome,
  recipientsForSkippedProposal,
  skippedProposal,
} from '../purchasing/notification-recipients';
import {
  buildNotificationEmail,
  NotificationKind,
} from '../purchasing/notification-email';

const NOTIFY_TYPES = [
  'PurchaseRequestSubmitted',
  'PurchaseRequestApproved',
  'PurchaseRequestDeclined',
  'PurchaseRequestBought',
] as const;

type NotifyEvent = StoredEventOfType<(typeof NOTIFY_TYPES)[number]>;

export type NotifyPurchaseRequestDependencies = Pick<
  SyncWorkerDependencies,
  'logger' | 'sharedReadModel' | 'getAllEventsByType' | 'commitEvent' | 'sendEmail' | 'conf'
>;

// Far enough back to cover a worker that has been down for a few days.
const NOTIFY_EVENTS_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

// When these notifications started: requests sent before then (while the
// feature was being tried out) never notify anybody about being sent.
// Deciding one later still tells whoever sent it.
const NOTIFY_REQUESTS_SENT_FROM = new Date('2026-10-23T13:00:00Z');

const nameOf = (rm: SharedReadModel, memberNumber: number) =>
  pipe(
    rm.members.getByMemberNumber(memberNumber),
    O.chain(member => member.name),
    O.getOrElse(() => `Member ${memberNumber}`)
  );

// What an event calls for, and who hears; nothing for a purchase bought
// directly within the rules.
const notificationFor = (
  deps: NotifyPurchaseRequestDependencies,
  event: NotifyEvent,
  request: PurchaseRequest
): O.Option<{kind: NotificationKind; recipients: ReadonlyArray<Recipient>}> => {
  const rm = deps.sharedReadModel;
  if (event.type === 'PurchaseRequestBought') {
    return O.some({
      kind: 'bought',
      recipients: recipientsForOutcome(rm, request, request.boughtByMemberNumber),
    });
  }
  if (event.type !== 'PurchaseRequestSubmitted') {
    return O.some({
      kind:
        event.type === 'PurchaseRequestApproved' && event.alsoBought
          ? 'approved-and-bought'
          : 'outcome',
      recipients: recipientsForOutcome(rm, request, request.decidedByMemberNumber),
    });
  }
  if (request.status === 'bought-directly') {
    return skippedProposal(request)
      ? O.some({
          kind: 'skipped-proposal',
          recipients: recipientsForSkippedProposal(rm, deps.conf, request),
        })
      : O.none;
  }
  return O.some({
    kind: 'new',
    recipients: recipientsForNewRequest(rm, deps.conf, request).map(
      // Decided before this ran: nothing is left for anyone to do.
      recipient => ({
        ...recipient,
        canDecide:
          recipient.canDecide && request.status === 'awaiting-approval',
      })
    ),
  });
};

// Emails everyone who should hear about a purchase request being sent,
// approved or declined, recording a PurchaseRequestNotificationSent event
// first so nothing is sent twice (preferring a missed email to a duplicate,
// as the trouble ticket notifier does). Held back by the same
// TROUBLE_TICKET_NOTIFY_TO setting as trouble ticket emails.
export const notifyPurchaseRequests = async (
  deps: NotifyPurchaseRequestDependencies,
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
      deps.logger.warn('Failed to read purchase request events for notifications: %o', result.left);
    }
  }
  events.sort((a, b) => a.event_index - b.event_index);

  const send = heldBackSendEmail(deps);
  for (const event of events) {
    if (now.getTime() - event.recordedAt.getTime() > NOTIFY_EVENTS_WITHIN_MS) {
      continue;
    }
    if (
      event.type === 'PurchaseRequestSubmitted' &&
      event.recordedAt < NOTIFY_REQUESTS_SENT_FROM
    ) {
      continue;
    }
    if (rm.purchasing.hasNotifiedForEvent(event.event_index)) {
      continue;
    }
    const request = rm.purchasing.getRequest(event.id);
    if (O.isNone(request)) {
      continue;
    }
    const notification = notificationFor(deps, event, request.value);
    if (O.isNone(notification)) {
      continue;
    }
    const {kind, recipients} = notification.value;
    const committed = await deps.commitEvent(rm.getCurrentEventIndex())(
      constructEvent('PurchaseRequestNotificationSent')({
        actor: {tag: 'system'},
        requestId: request.value.id,
        notifiedEventIndex: event.event_index,
        recipientMemberNumbers: recipients.map(recipient => recipient.memberNumber),
      })
    )();
    if (E.isLeft(committed)) {
      deps.logger.warn(
        'Failed to record purchase request notification for event %s: %o - will retry',
        event.event_index,
        committed.left
      );
      continue;
    }
    // So an outcome later in this pass reaches everyone just told.
    await rm.asyncRefresh()();

    const context = {
      publicUrl: deps.conf.PUBLIC_URL,
      areaName: pipe(
        rm.purchasing.get(request.value.purchasingAreaId, now),
        O.match(
          () => 'a purchasing area',
          area => area.name
        )
      ),
      requesterName: nameOf(rm, request.value.submittedByMemberNumber),
      deciderName: pipe(
        request.value.decidedByMemberNumber,
        O.match(
          () => 'A super user',
          memberNumber => nameOf(rm, memberNumber)
        )
      ),
      buyerName: pipe(
        request.value.boughtByMemberNumber,
        O.match(
          () => 'A purchaser',
          memberNumber => nameOf(rm, memberNumber)
        )
      ),
    };
    for (const recipient of recipients) {
      const sent = await send(
        buildNotificationEmail(kind, request.value, recipient, context)
      )();
      if (E.isLeft(sent)) {
        deps.logger.error(
          "Failed to send purchase request notification to '%s': %o",
          recipient.email,
          sent.left
        );
      }
    }
  }
};
