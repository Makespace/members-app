import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {html, safe, sanitizeString} from '../../types/html';
import {User} from '../../types';
import {Form} from '../../types/form';
import {pageTemplate} from '../../templates';
import {getEquipmentIdFromForm} from '../equipment/get-equipment-id-from-form';
import {memberInput} from '../../templates/member-input';
import {Member} from '../../read-models/members';
import {Equipment} from '../../read-models/shared-state/return-types';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

type ViewModel = {
  user: User;
  equipment: Equipment;
  members: ReadonlyArray<Member>;
};

// TODO - Drop down suggestion list of users.
// TODO - Warning if you try and mark a member as trained who hasn't done the quiz (for now we allow this for flexibility).

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>
        Mark a member as trained on ${sanitizeString(viewModel.equipment.name)}
      </h1>
      <form action="/equipment/mark-member-trained" method="post">
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipment.id}"
        />
        ${memberInput(viewModel.members)}
        <button type="submit">Confirm</button>
      </form>
    `,
    pageTemplate(safe('Member Training Complete'), viewModel.user)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user, readModel}) =>
    pipe(
      {user},
      E.right,
      E.bind('equipment_id', () => getEquipmentIdFromForm(input)),
      E.bind('equipment', ({equipment_id}) => {
        const equipment = readModel.equipment.get(equipment_id);
        if (O.isNone(equipment)) {
          return E.left(
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)()
          );
        }
        return E.right(equipment.value);
      }),
      E.let('members', () => readModel.members.getAll())
    );

export const markMemberTrainedForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
