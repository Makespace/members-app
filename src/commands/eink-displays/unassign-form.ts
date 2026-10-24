import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {html, safe, toLoggedInContentWithBackLink} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';
import {parseDisplayNumber} from '../../eink/display-number';

// A bare confirmation for the GET route; the displays page posts directly.
type ViewModel = {displayNumber: number};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack">
        <h1>Clear e-ink display ${safe(viewModel.displayNumber.toString())}</h1>
        <p>It will show "not set up" until it is given a machine again.</p>
        <form action="/e-ink/unassign" method="post" class="stack">
          <input
            type="hidden"
            name="displayNumber"
            value="${safe(viewModel.displayNumber.toString())}"
          />
          <button type="submit">Clear</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Clear e-ink display'), {
      href: '/e-ink',
      label: 'E-ink displays',
    })
  );

const constructForm: Form<ViewModel>['constructForm'] = input => () =>
  pipe(
    parseDisplayNumber(
      typeof input === 'object' && input !== null && 'displayNumber' in input
        ? input.displayNumber
        : undefined
    ),
    E.fromNullable(
      failureWithStatus('Unknown display number', StatusCodes.BAD_REQUEST)()
    ),
    E.map(displayNumber => ({displayNumber})),
    TE.fromEither
  );

export const unassignForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
