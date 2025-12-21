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
import {memberSelector} from '../../templates/member-selector';
import {Member} from '../../read-models/members';
import {Equipment} from '../../read-models/shared-state/return-types';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {dateTimeInput} from '../../templates/date-time-input';
import {DateTime} from 'luxon';

type ViewModel = {
  equipment: Equipment;
  members: ReadonlyArray<Member>;
  trainerMemberNumber: number;
};

// TODO - Warning if you try and mark a member as trained who hasn't done the quiz (for now we allow this for flexibility).

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>
        Mark a member as trained on ${sanitizeString(viewModel.equipment.name)}
      </h1>
      <form action="/equipment/mark-member-trained-by" method="post">
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipment.id}"
        />
        <input
          type="hidden"
          name="trainedByMemberNumber"
          value="${viewModel.trainerMemberNumber}"
        />
        ${memberSelector('memberNumber' as Safe, null, viewModel.members)}
        ${dateTimeInput(
          'trainedAt' as Safe,
          'When was the training?' as Safe,
          DateTime.now(),
          O.some({
            value: DateTime.now().minus({months: 1}),
            tooltip: 'Training date cannot be more than 1 month ago' as Safe,
          }),
          O.some({
            value: DateTime.now(),
            tooltip: 'Training time cannot be in the future' as Safe,
          })
        )}
        <button type="submit">Confirm</button>
      </form>
    `,
    toLoggedInContent(safe('Mark Member Trained'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel, user}) =>
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
      E.let('trainerMemberNumber', () => user.memberNumber)
    );

export const markMemberTrainedForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
