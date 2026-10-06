import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {html, safe, toLoggedInContent} from '../../types/html';
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
  fobId: number;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Remove a Paxton fob</h1>
      <p>
        Remove fob ${viewModel.fobId} from member ${viewModel.memberNumber}'s
        record? This only changes what the app knows about; it does not
        change anything in Paxton.
      </p>
      <form action="?next=/member/${viewModel.memberNumber}" method="post">
        <input type="hidden" name="fobId" value="${viewModel.fobId}" />
        <input
          type="hidden"
          name="memberNumber"
          value="${viewModel.memberNumber}"
        />
        <button type="submit">Remove fob</button>
      </form>
    `,
    toLoggedInContent(safe('Remove a Paxton fob'))
  );

const paramsCodec = t.strict({
  member: tt.NumberFromString,
  fob: tt.NumberFromString,
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
        fobId: params.fob,
      })),
      TE.fromEither
    );

export const removeFobForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
