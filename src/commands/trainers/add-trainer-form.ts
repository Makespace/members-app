import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {DomainEvent, Member, User} from '../../types';
import {Form} from '../../types/form';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {readModels} from '../../read-models';
import Handlebars, {SafeString} from 'handlebars';

type ViewModel = {
  user: User;
  members: ReadonlyArray<Member>;
  equipmentId: string;
  equipmentName: string;
};

const RENDER_ADD_TRAINER_FORM_TEMPLATE = Handlebars.compile(`
  <h1>Add a trainer</h1>
  <table data-gridjs>
    <thead>
      <tr>
        <th>E-Mail</th>
        <th>Member Number</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody>
      {{#each members}}
        <tr>
          <td>{{this.email}}</td>
          <td>{{this.number}}</td>
          <td>
            <form action="#" method="post">
              <input type="hidden" name="memberNumber" value="{{this.number}}" />
              <input
                type="hidden"
                name="equipmentId"
                value="{{@root.equipmentId}}"
              />
              <button type="submit">Add</button>
            </form>
          </td>
        </tr>
      {{/each}}
    </tbody>
  </table>
`);

const renderForm = (viewModel: ViewModel) =>
  pageTemplate(
    'Add Trainer',
    viewModel.user
  )(new SafeString(RENDER_ADD_TRAINER_FORM_TEMPLATE(viewModel)));

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
