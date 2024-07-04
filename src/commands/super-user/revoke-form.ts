import {flow, pipe} from 'fp-ts/lib/function';
import * as tt from 'io-ts-types';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import * as O from 'fp-ts/Option';
import {User} from '../../types';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {Form} from '../../types/form';
import Handlebars, {SafeString} from 'handlebars';

type ViewModel = {
  user: User;
  toBeRevoked: number;
};

const RENDER_REVOKE_SUPER_USER_TEMPLATE = Handlebars.compile(`
  <h1>Revoke super user</h1>
  <p>
    Are you sure you would like to revoke this members super-user
    privileges?
  </p>
  <dl>
    <dt>Member number</dt>
    <dd>{{#member_number toBeRevoked}}</dd>
  </dl>
  <form action="#" method="post">
    <input
      type="hidden"
      name="memberNumber"
      value="{{toBeRevoked}}"
    />
    <button type="submit">Confirm and send</button>
  </form>
`);

const renderForm = (viewModel: ViewModel) =>
  pageTemplate(
    'Revoke super user',
    O.some(viewModel.user)
  )(new SafeString(RENDER_REVOKE_SUPER_USER_TEMPLATE(viewModel)));

const paramsCodec = t.strict({
  memberNumber: tt.IntFromString,
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
        toBeRevoked: params.memberNumber,
      }))
    );

export const revokeForm: Form<ViewModel> = {
  renderForm: renderForm,
  constructForm,
};
