import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {User} from '../../types';
import {Form} from '../../types/form';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

type ViewModel = {
  user: User;
  memberNumber: number;
  emailAddress: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Change primary email</h1>
      <form action="?next=/me" method="post">
        <label for="email">Email address</label>
        <input
          type="email"
          name="email"
          id="email"
          value="${sanitizeString(viewModel.emailAddress)}"
        />
        <input
          type="hidden"
          name="memberNumber"
          value="${viewModel.memberNumber}"
        />
        <button type="submit">Make primary</button>
      </form>
    `,
    toLoggedInContent(safe('Change primary email'))
  );

const paramsCodec = t.strict({
  member: tt.NumberFromString,
  email: t.string,
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
        emailAddress: params.email,
      }))
    );

export const changePrimaryEmailForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
