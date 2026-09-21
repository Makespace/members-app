import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {DateTime} from 'luxon';
import {Query} from '../query';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {mustBeSuperuser} from '../util';
import {Notification} from '../../read-models/shared-state/notifications/get';
import {SharedReadModel} from '../../read-models/shared-state';
import {displayDate} from '../../templates/display-date';

const TYPE_LABEL: Record<Notification['bannerType'], string> = {
  action: 'Action needed',
  event: 'Upcoming event',
  info: 'Information',
};

const audience = (
  notification: Notification,
  rm: SharedReadModel
): string => {
  if (notification.targetAllOwners) {
    return 'All owners';
  }
  const names = notification.targetAreaIds
    .map(areaId =>
      pipe(
        rm.area.get(areaId),
        O.map(area => area.name),
        O.getOrElse(() => 'unknown area')
      )
    )
    .join(', ');
  return names === '' ? 'Nobody (no areas selected)' : `Owners of: ${names}`;
};

const state = (notification: Notification, now: Date): string => {
  if (notification.revoked) {
    return 'Revoked';
  }
  if (notification.expiresAt !== null && notification.expiresAt <= now) {
    return 'Expired';
  }
  return 'Live';
};

const renderRow =
  (rm: SharedReadModel, now: Date) => (notification: Notification) => html`
    <tr>
      <td>${sanitizeString(notification.title)}</td>
      <td>${safe(TYPE_LABEL[notification.bannerType])}</td>
      <td>${sanitizeString(audience(notification, rm))}</td>
      <td>${safe(state(notification, now))}</td>
      <td>
        ${notification.expiresAt
          ? displayDate(DateTime.fromJSDate(notification.expiresAt))
          : safe('—')}
      </td>
      <td>
        ${notification.emailMarkdown === null
          ? safe('—')
          : notification.emailSent
            ? safe('Sent')
            : safe('Queued')}
      </td>
      <td>
        ${state(notification, now) === 'Live'
          ? html`<a
              href="/notifications/revoke?notificationId=${safe(
                notification.id
              )}"
              >Revoke</a
            >`
          : safe('')}
      </td>
    </tr>
  `;

export const notifications: Query = deps => user =>
  pipe(
    mustBeSuperuser(deps.sharedReadModel, user),
    TE.map(() => {
      const now = new Date();
      const all = deps.sharedReadModel.notifications.getAll();
      return html`
        <div class="stack">
          <h1>Notifications</h1>
          <p>
            Banners shown at the top of every page for their audience.
            <a href="/notifications/create">Create a notification</a>
          </p>
          ${all.length === 0
            ? html`<p>No notifications yet.</p>`
            : html`
                <table>
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Audience</th>
                      <th>State</th>
                      <th>Expires</th>
                      <th>Email</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    ${joinHtml(
                      all.map(renderRow(deps.sharedReadModel, now))
                    )}
                  </tbody>
                </table>
              `}
        </div>
      `;
    }),
    TE.map(toLoggedInContent(safe('Notifications')))
  );
