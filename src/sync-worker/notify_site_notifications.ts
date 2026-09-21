import * as E from 'fp-ts/Either';
import mjml2html from 'mjml';
import {constructEvent, Email} from '../types';
import {SyncWorkerDependencies} from './dependencies';
import {
  Notification,
  notificationTargets,
} from '../read-models/shared-state/notifications/get';
import {markdownToHtml} from '../templates/markdown';

type NotifySiteNotificationDependencies = Pick<
  SyncWorkerDependencies,
  'logger' | 'sharedReadModel' | 'commitEvent' | 'sendEmail' | 'conf'
>;

const buildEmail = (
  publicUrl: string,
  recipient: Email['recipient'],
  notification: Notification,
  bodyHtml: string
): Email => ({
  recipient,
  subject: notification.title,
  text: `${notification.title}\n\n${notification.emailMarkdown ?? ''}\n\n${publicUrl}\n`,
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
            <mj-text font-size="16px" color="#111">${bodyHtml}</mj-text>
            <mj-button background-color="#00703c" href="${publicUrl}">Open the members app</mj-button>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `).html,
});

// Sends the go-live email for notifications that requested one, to everyone
// in the notification's audience. The NotificationEmailSent marker is
// committed BEFORE sending (preferring a missed email over duplicates,
// matching the other emailers).
export const notifySiteNotifications = async (
  deps: NotifySiteNotificationDependencies
): Promise<void> => {
  await deps.sharedReadModel.asyncRefresh()();
  const rm = deps.sharedReadModel;
  const now = new Date();

  const pending = rm.notifications
    .getAll()
    .filter(
      notification =>
        notification.emailMarkdown !== null &&
        !notification.emailSent &&
        !notification.revoked &&
        (notification.expiresAt === null || notification.expiresAt > now)
    );

  for (const notification of pending) {
    const commitResp = await deps.commitEvent(rm.getCurrentEventIndex())(
      constructEvent('NotificationEmailSent')({
        actor: {tag: 'system'},
        notificationId: notification.id,
      })
    )();
    if (E.isLeft(commitResp)) {
      deps.logger.warn(
        'Failed to record notification email marker for %s: %o - will retry',
        notification.id,
        commitResp.left
      );
      continue;
    }

    // Admin-authored markdown, escape-first (see templates/markdown.ts).
    const bodyHtml = markdownToHtml(notification.emailMarkdown ?? '');

    // getAll (not getAllCore): targeting needs each member's ownerOf, which
    // only the full member shape populates. Runs only when an email is
    // actually pending, so the heavier read is fine.
    const recipients = rm.members
      .getAll()
      .filter(member => notificationTargets(notification, member))
      .map(member => member.primaryEmailAddress);

    deps.logger.info(
      'Sending notification email "%s" to %s recipient(s)',
      notification.title,
      recipients.length
    );
    for (const recipient of recipients) {
      const sent = await deps.sendEmail(
        buildEmail(deps.conf.PUBLIC_URL, recipient, notification, bodyHtml)
      )();
      if (E.isLeft(sent)) {
        deps.logger.error(
          "Failed to send notification email to '%s': %o",
          recipient,
          sent.left
        );
      }
    }
  }
};
