import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {getEquipmentIdFromForm} from '../equipment/get-equipment-id-from-form';
import {memberInput} from '../../templates/member-input';
import {Member} from '../../read-models/members';
import {Equipment} from '../../read-models/shared-state/return-types';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

type ViewModel = {
  equipment: Equipment;
  members: ReadonlyArray<Member>;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>
        Revoke member training on ${sanitizeString(viewModel.equipment.name)}
      </h1>
      <form action="/equipment/revoke-member-trained" method="post">
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipment.id}"
        />
        ${memberInput(viewModel.members)}
        <button type="submit">Confirm</button>
      </form>
    `,
    toLoggedInContent(safe('Revoke Training'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
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

export const revokeMemberTrainedForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
