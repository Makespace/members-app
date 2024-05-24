import {flow, pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';
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
import {Form} from '../../types/form';
import {readModels} from '../../read-models';

type ViewModel = {
  user: User;
  areaId: string;
  members: ReadonlyArray<{
    number: number;
    email: string;
  }>;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel.members,
    RA.map(
      member =>
        html`<tr>
          <td>${member.email}</td>
          <td>${member.number}</td>
          <td>
            <form action="#" method="post">
              <input
                type="hidden"
                name="memberNumber"
                value="${member.number}"
              />
              <input type="hidden" name="areaId" value="${viewModel.areaId}" />
              <button type="submit">Add</button>
            </form>
          </td>
        </tr>`
    ),
    tableRows => html`
      <h1>Add an owner</h1>
      <table>
        <tr>
          <th>E-Mail</th>
          <th>Member Number</th>
          <th></th>
        </tr>
        ${tableRows.join('\n')}
      </table>
    `,
    pageTemplate('Add Owner', O.some(viewModel.user))
  );

const paramsCodec = t.strict({
  area: t.string,
});

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, events}): E.Either<FailureWithStatus, ViewModel> =>
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
      E.map(params => params.area),
      E.map(areaId => ({
        user,
        areaId,
        members: readModels.members.getAll(events),
      }))
    );

export const addOwnerForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
