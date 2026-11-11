import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {constructEvent} from '../types';
import {EmailAttachment} from '../types/email';
import {EmailAddress} from '../types/email-address';
import {SharedReadModel} from '../read-models/shared-state';
import {SyncWorkerDependencies} from './dependencies';
import {heldBackSendEmail} from '../trouble-tickets/notification-gate';
import {buildReceiptEmail, MAX_ATTACHMENT_BYTES} from '../purchasing/receipt-email';

type NotifyPurchaseReceiptDependencies = Pick<
  SyncWorkerDependencies,
  | 'logger'
  | 'sharedReadModel'
  | 'getAllEventsByType'
  | 'commitEvent'
  | 'sendEmail'
  | 'conf'
  | 'receiptFiles'
>;

// Far enough back to cover a worker that has been down for a few days.
const NOTIFY_EVENTS_WITHIN_MS = 7 * 24 * 60 * 60 * 1000;

const nameOf = (rm: SharedReadModel, memberNumber: O.Option<number>) =>
  pipe(
    memberNumber,
    O.chain(rm.members.getByMemberNumber),
    O.chain(member => member.name),
    O.getOrElse(() =>
      pipe(
        memberNumber,
        O.match(
          () => 'Someone',
          number => `Member ${number}`
        )
      )
    )
  );

// Emails each upload of a purchase's receipts or invoices to
// PURCHASE_RECEIPTS_EMAIL (management@) for the accountant. Like the other
// purchase request emails, it records a PurchaseRequestNotificationSent
// event first so nothing is sent twice, and is held back by
// TROUBLE_TICKET_NOTIFY_TO.
export const notifyPurchaseReceipts = async (
  deps: NotifyPurchaseReceiptDependencies,
  now: Date = new Date()
): Promise<void> => {
  const uploads = await deps.getAllEventsByType('PurchaseRequestReceiptUploaded')();
  if (E.isLeft(uploads)) {
    deps.logger.warn('Failed to read purchase receipt uploads for notifications: %o', uploads.left);
    return;
  }
  const pending = uploads.right.filter(
    event =>
      now.getTime() - event.recordedAt.getTime() <= NOTIFY_EVENTS_WITHIN_MS &&
      !deps.sharedReadModel.purchasing.hasNotifiedForEvent(event.event_index)
  );
  if (pending.length === 0) {
    return;
  }
  await deps.sharedReadModel.asyncRefresh()();
  const rm = deps.sharedReadModel;
  const send = heldBackSendEmail(deps);

  for (const event of pending) {
    if (rm.purchasing.hasNotifiedForEvent(event.event_index)) {
      continue;
    }
    const request = rm.purchasing.getRequest(event.id);
    if (O.isNone(request)) {
      continue;
    }
    const committed = await deps.commitEvent(rm.getCurrentEventIndex())(
      constructEvent('PurchaseRequestNotificationSent')({
        actor: {tag: 'system'},
        requestId: request.value.id,
        notifiedEventIndex: event.event_index,
        // Sent to an address, not to members.
        recipientMemberNumbers: [],
      })
    )();
    if (E.isLeft(committed)) {
      deps.logger.warn(
        'Failed to record purchase receipt notification for event %s: %o - will retry',
        event.event_index,
        committed.left
      );
      continue;
    }
    await rm.asyncRefresh()();

    // Attached only if they all fit; otherwise the links do.
    const attachments: EmailAttachment[] = [];
    let attachable = true;
    for (const file of event.files) {
      const stored = await deps.receiptFiles.get(file.fileId).catch(err => {
        deps.logger.error(err, 'Failed to read purchase receipt file %s', file.fileId);
        return O.none;
      });
      if (O.isNone(stored)) {
        attachable = false;
        break;
      }
      attachments.push({
        filename: stored.value.filename,
        content: stored.value.content,
        contentType: stored.value.mimeType,
      });
    }
    const totalBytes = attachments.reduce((sum, a) => sum + a.content.length, 0);
    if (totalBytes > MAX_ATTACHMENT_BYTES) {
      attachable = false;
    }

    const sent = await send(
      buildReceiptEmail(request.value, event.files, attachable ? attachments : [], {
        publicUrl: deps.conf.PUBLIC_URL,
        to: deps.conf.PURCHASE_RECEIPTS_EMAIL as EmailAddress,
        areaName: pipe(
          rm.purchasing.get(request.value.purchasingAreaId, now),
          O.match(
            () => 'A purchasing area',
            area => area.name
          )
        ),
        uploaderName: nameOf(
          rm,
          event.actor.tag === 'user' ? O.some(event.actor.user.memberNumber) : O.none
        ),
        buyerName: nameOf(
          rm,
          request.value.status === 'bought-directly'
            ? O.some(request.value.submittedByMemberNumber)
            : request.value.boughtByMemberNumber
        ),
      })
    )();
    if (E.isLeft(sent)) {
      deps.logger.error(
        "Failed to send purchase receipt email to '%s': %o",
        deps.conf.PURCHASE_RECEIPTS_EMAIL,
        sent.left
      );
    }
  }
};
