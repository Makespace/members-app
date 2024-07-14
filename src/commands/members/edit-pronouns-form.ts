import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import * as O from 'fp-ts/Option';
import {User} from '../../types';
import {Form} from '../../types/form';
import * as t from 'io-ts';
import * as tt from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import Handlebars, {SafeString} from 'handlebars';

type ViewModel = {
  user: User;
  memberNumber: number;
};

const RENDER_EDIT_PRONOUNS_TEMPLATE = Handlebars.compile(`
  <h1>Edit pronouns</h1>
  <form action="?next=/member/{{user.memberNumber}}" method="post">
    <label for="name">New pronouns</label>
    <input type="text" name="pronouns" id="pronouns" />
    <input
      type="hidden"
      name="memberNumber"
      value="{{memberNumber}}"
    />
    <button type="submit">Confirm</button>
  </form>
`);

const renderForm = (viewModel: ViewModel) =>
  pageTemplate(
    'Edit pronouns',
    viewModel.user
  )(new SafeString(RENDER_EDIT_PRONOUNS_TEMPLATE(viewModel)));

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
      E.map(params => params.member),
      E.map(memberNumber => ({
        user,
        memberNumber,
      }))
    );

export const editPronounsForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
