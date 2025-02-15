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
  user: User;
  memberNumber: number;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Edit pronouns</h1>
      <form action="?next=/member/${viewModel.user.memberNumber}" method="post">
        <label for="name">New pronouns</label>
        <input type="text" name="pronouns" id="pronouns" />
        <input
          type="hidden"
          name="memberNumber"
          value="${viewModel.memberNumber}"
        />
        <button type="submit">Confirm</button>
      </form>
    `,
    toLoggedInContent(safe('Edit pronouns'))
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
