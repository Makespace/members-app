import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';

// See archive-form: a bare confirmation for the GET route only.
type ViewModel = {conversationId: string};

const renderForm: Form<ViewModel>['renderForm'] = viewModel =>
  pipe(
    html`
      <div class="stack">
        <h1>Unarchive conversation</h1>
        <p>Bring this conversation back into the mailbox?</p>
        <form action="/mailbox/unarchive" method="post" class="stack">
          <input
            type="hidden"
            name="conversationId"
            value="${sanitizeString(viewModel.conversationId)}"
          />
          <button type="submit">Unarchive</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Unarchive conversation'))
  );

const constructForm: Form<ViewModel>['constructForm'] = input => () =>
  pipe(
    input,
    t.type({conversationId: t.string}).decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    TE.fromEither
  );

export const unarchiveForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
