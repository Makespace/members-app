import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, toLoggedInContent} from '../../types/html';
import {User} from '../../types';
import {Form} from '../../types/form';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

type ViewModel = {
  user: User; // The user logged in
  memberNumber: number; // The user we are updating the email for.

  // TODO - Show the emails already registered for this user.
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Add email</h1>
      <form action="?next=/member/${viewModel.memberNumber}" method="post">
        <label for="email">Email address</label>
        <input type="email" name="email" id="email" />
        <input
          type="hidden"
          name="memberNumber"
          value="${viewModel.memberNumber}"
        />
        <button type="submit">Add email</button>
      </form>
    `,
    toLoggedInContent(safe('Add email'))
  );

const paramsCodec = t.strict({
  member: tt.NumberFromString,
});

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user}) =>
    pipe(
      input,
      paramsCodec.decode,
      E.mapLeft(
        flow(
          formatValidationErrors,
          failureWithStatus(
            'Parameters submitted to the form were invalid',
            StatusCodes.BAD_REQUEST
          )
        )
      ),
      E.map(params => ({
        user,
        memberNumber: params.member,
      }))
    );

export const addEmailForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
