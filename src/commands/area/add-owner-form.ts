import {flow, pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {User} from '../../types';
import * as t from 'io-ts';
import {StatusCodes} from 'http-status-codes';
import {formatValidationErrors} from 'io-ts-reporters';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failureWithStatus';

type ViewModel = {
  user: User;
  areaId: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Add an owner</h1>
      <form action="#" method="post">
        <label for="memberNumber">Member number of new owner</label>
        <input type="text" name="memberNumber" id="memberNumber" />
        <input type="hidden" name="areaId" value="${viewModel.areaId}" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Add Owner', O.some(viewModel.user))
  );

const paramsCodec = t.strict({
  area: t.string,
});

const constructForm =
  (input: unknown) =>
  (user: User): E.Either<FailureWithStatus, ViewModel> =>
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
        areaId: params.area,
      }))
    );

export const addOwnerForm = {
  renderForm,
  constructForm,
};
