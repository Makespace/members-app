import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {DomainEvent, User} from '../../types';
import {Form} from '../../types/form';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {readModels} from '../../read-models';
import * as RA from 'fp-ts/ReadonlyArray';

type ViewModel = {
  user: User;
  members: ReadonlyArray<{
    number: number;
    email: string;
  }>;
  equipmentId: string;
  equipmentName: string;
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
              <input
                type="hidden"
                name="equipmentId"
                value="${viewModel.equipmentId}"
              />
              <button type="submit">Add</button>
            </form>
          </td>
        </tr>`
    ),
    tableRows => html`
      <h1>Add a trainer</h1>
      <div id="wrapper"></div>
      <table id="all-members">
        <thead>
          <tr>
            <th>E-Mail</th>
            <th>Member Number</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${tableRows.join('\n')}
        </tbody>
      </table>
      <script>
        new gridjs.Grid({
          from: document.getElementById('all-members'),
          search: true,
          language: {
            search: {
              placeholder: 'Search...',
            },
          },
        }).render(document.getElementById('wrapper'));
      </script>
    `,
    pageTemplate('Add Trainer', O.some(viewModel.user))
  );

const getEquipmentId = (input: unknown) =>
  pipe(
    input,
    t.strict({equipment: t.string}).decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    E.map(({equipment}) => equipment)
  );

const getEquipmentName = (
  events: ReadonlyArray<DomainEvent>,
  equipmentId: string
) =>
  pipe(
    equipmentId,
    readModels.equipment.get(events),
    E.fromOption(() =>
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
    ),
    E.map(equipment => equipment.name)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, events}) =>
    pipe(
      E.Do,
      E.bind('equipmentId', () => getEquipmentId(input)),
      E.bind('equipmentName', ({equipmentId}) =>
        getEquipmentName(events, equipmentId)
      ),
      E.bind('user', () => E.right(user)),
      E.bind('members', () => E.right(readModels.members.getAll(events)))
    );

export const addTrainerForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
