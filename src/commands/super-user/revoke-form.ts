import {flow, pipe} from 'fp-ts/lib/function';
import * as tt from 'io-ts-types';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {html, safe, toLoggedInContent} from '../../types/html';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {Form} from '../../types/form';
import {renderMemberNumber} from '../../templates/member-number';

type ViewModel = {
  toBeRevoked: number;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Revoke super user</h1>
      <p>
        Are you sure you would like to revoke this members super-user
        privileges?
      </p>
      <dl>
        <dt>Member number</dt>
        <dd>${renderMemberNumber(viewModel.toBeRevoked)}</dd>
      </dl>
      <form action="#" method="post">
        <input
          type="hidden"
          name="memberNumber"
          value="${viewModel.toBeRevoked}"
        />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    toLoggedInContent(safe('Revoke super user'))
  );

const paramsCodec = t.strict({
  memberNumber: tt.IntFromString,
});

const constructForm: Form<ViewModel>['constructForm'] = input => () =>
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
      toBeRevoked: params.memberNumber,
    }))
  );

export const revokeForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
