import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pageTemplate} from '../../templates';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {User} from '../../types';
import {Form} from '../../types/form';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import * as RA from 'fp-ts/ReadonlyArray';
import {renderMemberNumber} from '../../templates/member-number';
import {UUID} from 'io-ts-types';
import {Equipment} from '../../read-models/shared-state/return-types';

type ViewModel = {
  user: User;
  members: ReadonlyArray<User>;
  equipment: Equipment;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel.members,
    RA.map(
      member =>
        html`<tr>
          <td>${sanitizeString(member.emailAddress)}</td>
          <td>${renderMemberNumber(member.memberNumber)}</td>
          <td>
            <form action="#" method="post">
              <input
                type="hidden"
                name="memberNumber"
                value="${member.memberNumber}"
              />
              <input
                type="hidden"
                name="equipmentId"
                value="${viewModel.equipment.id}"
              />
              <button type="submit">Add</button>
            </form>
          </td>
        </tr>`
    ),
    joinHtml,
    tableRows => html`
      <h1>Add a trainer</h1>
      <div id="wrapper"></div>
      <table id="all-members" data-gridjs>
        <thead>
          <tr>
            <th>E-Mail</th>
            <th>Member Number</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `,
    pageTemplate(safe('Add Trainer'), viewModel.user)
  );

const getEquipmentId = (input: unknown) =>
  pipe(
    input,
    t.strict({equipment: UUID}).decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    E.map(({equipment}) => equipment)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, readModel}) =>
    pipe(
      E.Do,
      E.bind('equipmentId', () => getEquipmentId(input)),
      E.bind('equipment', ({equipmentId}) => {
        const equipment = readModel.equipment.get(equipmentId);
        if (O.isNone(equipment)) {
          return E.left(
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)()
          );
        }
        return E.right(equipment.value);
      }),
      E.bind('user', () => E.right(user)),
      E.bind('members', () => E.right(readModel.members.getAll()))
    );

export const addTrainerForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
