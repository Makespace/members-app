import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {
  html,
  Safe,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {getEquipmentIdFromForm} from '../equipment/get-equipment-id-from-form';
import {Member} from '../../read-models/members';
import {Equipment} from '../../read-models/shared-state/return-types';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {memberNumberInputMinimal} from '../../templates/member-input-minimal';
import {dateTimeInput} from '../../templates/date-time-input';
import {DateTime} from 'luxon';

type ViewModel = {
  equipment: Equipment;
  membersNotAlreadyTrained: ReadonlyArray<Member>;
};

// TODO - Drop down suggestion list of users.
// TODO - Warning if you try and mark a member as trained who hasn't done the quiz (for now we allow this for flexibility).

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h3 style="color:red;">
        This page is WIP - The datamodel is setup but the input's here aren't
        particularly user friendly
      </h1>
      <h1>
        [Admin] Mark a member as trained on
        ${sanitizeString(viewModel.equipment.name)} by a specific trainer
      </h1>
      <p>
        Ideally the actual trainer should be marking people as trained from
        their own account. Admins stepping in to do so should only be used when
        that isn't possible.
      </p>
      <form action="/equipment/mark-member-trained-by" method="post">
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipment.id}"
        />
        ${memberNumberInputMinimal(
          'trainedByMemberNumber' as Safe,
          'Select trainer' as Safe,
          viewModel.equipment.trainers
        )}
        ${dateTimeInput(
          'trainedAt' as Safe,
          'When was the training?' as Safe,
          DateTime.now(),
          O.none,
          O.some({
            value: DateTime.now(),
            tooltip: 'Training time cannot be in the future' as Safe,
          })
        )}
        ${memberNumberInputMinimal(
          'memberNumber' as Safe,
          'Select newly trained member' as Safe,
          viewModel.membersNotAlreadyTrained
        )}
        <button type="submit">Confirm</button>
      </form>
    `,
    toLoggedInContent(safe('Member Training Complete'))
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
      E.let('members', () => readModel.members.getAll()),
      E.bind('membersNotAlreadyTrained', ({equipment_id, members}) =>
        E.right(
          members.filter(
            member => !member.trainedOn.map(t => t.id).includes(equipment_id)
          )
        )
      )
    );

export const markMemberTrainedByForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
