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

// Banners dismiss via a direct POST; this confirmation page only exists for
// anyone who lands on the GET route directly.
type ViewModel = {notificationId: UUID; title: string};

const renderForm: Form<ViewModel>['renderForm'] = viewModel =>
  pipe(
    html`
      <div class="stack">
        <h1>Dismiss notification</h1>
        <p>
          Hide <strong>${sanitizeString(viewModel.title)}</strong> for
          yourself? It won't be shown to you again.
        </p>
        <form action="/notifications/dismiss" method="post" class="stack">
          <input
            type="hidden"
            name="notificationId"
            value="${safe(viewModel.notificationId)}"
          />
          <button type="submit">Dismiss</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Dismiss notification'))
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
            failureWithStatus(
              'No such notification',
              StatusCodes.NOT_FOUND
            )()
          ),
          E.map(notification => ({
            notificationId,
            title: notification.title,
          }))
        )
      ),
      TE.fromEither
    );

export const dismissForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
