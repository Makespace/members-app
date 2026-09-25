import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';

// The mailbox archives via a direct POST from each row; this confirmation
// page only exists for anyone who lands on the GET route. It names the
// conversation by id alone - a subject line is member correspondence, and
// this page cannot check who is asking.
type ViewModel = {conversationId: string};

const renderForm: Form<ViewModel>['renderForm'] = viewModel =>
  pipe(
    html`
      <div class="stack">
        <h1>Archive conversation</h1>
        <p>
          Put this conversation out of sight? It stays in the mailbox under
          "show archived", and can be brought back.
        </p>
        <form action="/mailbox/archive" method="post" class="stack">
          <input
            type="hidden"
            name="conversationId"
            value="${sanitizeString(viewModel.conversationId)}"
          />
          <button type="submit">Archive</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Archive conversation'))
  );

const constructForm: Form<ViewModel>['constructForm'] = input => () =>
  pipe(
    input,
    t.type({conversationId: t.string}).decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    TE.fromEither
  );

export const archiveForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
