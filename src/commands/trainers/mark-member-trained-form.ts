import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, sanitizeString} from '../../types/html';
import {MemberDetails, User} from '../../types';
import {Form} from '../../types/form';
import {pageTemplate} from '../../templates';
import {getEquipmentName} from '../equipment/get-equipment-name';
import {getEquipmentIdFromForm} from '../equipment/get-equipment-id-from-form';
import {UUID} from 'io-ts-types';
import {memberInput} from '../../templates/member-input';
import {readModels} from '../../read-models';

type ViewModel = {
  user: User;
  equipmentId: UUID;
  equipmentName: string;
  members: ReadonlyArray<MemberDetails>;
};

// TODO - Drop down suggestion list of users.
// TODO - Warning if you try and mark a member as trained who hasn't done the quiz (for now we allow this for flexibility).

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>
        Mark a member as trained on ${sanitizeString(viewModel.equipmentName)}
      </h1>
      <form action="/equipment/mark-member-trained" method="post">
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipmentId}"
        />
        ${memberInput(viewModel.members)}
        <button type="submit">Confirm</button>
      </form>
    `,
    pageTemplate(safe('Member Training Complete'), viewModel.user)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({events, user}) =>
    pipe(
      {user},
      E.right,
      E.bind('equipmentId', () => getEquipmentIdFromForm(input)),
      E.bind('equipmentName', ({equipmentId}) =>
        getEquipmentName(events, equipmentId)
      ),
      E.let('members', () => {
        const memberDetails = readModels.members.getAllDetails(events);
        return [...memberDetails.values()];
      })
    );

export const markMemberTrainedForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
