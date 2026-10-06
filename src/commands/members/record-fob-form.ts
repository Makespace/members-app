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
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Record a Paxton fob</h1>
      <p>
        Copy these from the fob's row in the Paxton export. Recording a fob id
        that is already on file updates its access level, or moves it to this
        member if someone else held it.
      </p>
      <form action="?next=/member/${viewModel.memberNumber}" method="post">
        <label for="fobId">Fob id</label>
        <input type="number" name="fobId" id="fobId" min="0" required />
        <label for="accessLevel">Access level</label>
        <input type="text" name="accessLevel" id="accessLevel" required />
        <label for="paxtonName">Name in Paxton</label>
        <input type="text" name="paxtonName" id="paxtonName" required />
        <input
          type="hidden"
          name="memberNumber"
          value="${viewModel.memberNumber}"
        />
        <button type="submit">Record fob</button>
      </form>
    `,
    toLoggedInContent(safe('Record a Paxton fob'))
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
      })),
      TE.fromEither
    );

export const recordFobForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
