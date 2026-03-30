import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {EmailAddressCodec, User} from '../../types';
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
  isSelf: boolean;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel.isSelf
    ? html`<p>
      In order to finish adding an email to your profile it needs to be verified. Click the button below
      to send an email with a verification link to '${sanitizeString(viewModel.emailAddress)}'
    </p>`
    : html`<p>
      In order to finish adding an email to this profile (member number ${viewModel.memberNumber}) it needs to be verified.
      Click the button below to send an email with a verification link to '${sanitizeString(viewModel.emailAddress)}'
    </p>`,
    (description) => html`
      <h1>Send email verification</h1>
      ${description}
      <form action="?next=/member/${viewModel.memberNumber}" method="post">
        <input
          type="hidden"
          name="email"
          id="email"
          value="${sanitizeString(viewModel.emailAddress)}"
          readonly
        />
        <input
          type="hidden"
          name="memberNumber"
          value="${viewModel.memberNumber}"
        />
        <button type="submit">Send verification email</button>
      </form>
    `,
    toLoggedInContent(safe('Send email verification'))
  );

const paramsCodec = t.strict({
  member: tt.NumberFromString,
  email: EmailAddressCodec,
});

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user}) =>
    TE.fromEither(
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
          isSelf: user.memberNumber === params.member,
        }))
      )
    );

export const sendEmailVerificationForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
