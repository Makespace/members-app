import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

type ViewModel = {notificationId: UUID; title: string};

const renderForm: Form<ViewModel>['renderForm'] = viewModel =>
  pipe(
    html`
      <div class="stack">
        <h1>Revoke notification</h1>
        <p>
          Take down <strong>${sanitizeString(viewModel.title)}</strong> for
          everyone, immediately?
        </p>
        <form
          action="/notifications/revoke?next=/notifications"
          method="post"
          class="stack"
        >
          <input
            type="hidden"
            name="notificationId"
            value="${safe(viewModel.notificationId)}"
          />
          <div class="tt-actions">
            <button type="submit">Revoke</button>
            <a href="/notifications">Cancel</a>
          </div>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Revoke notification'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      input,
      t.type({notificationId: UUID}).decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
      ),
      E.chain(({notificationId}) =>
        pipe(
          readModel.notifications.getById(notificationId),
          E.fromNullable(
            failureWithStatus('No such notification', StatusCodes.NOT_FOUND)()
          ),
          E.map(notification => ({notificationId, title: notification.title}))
        )
      ),
      TE.fromEither
    );

export const revokeForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
