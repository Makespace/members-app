import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, sanitizeString} from '../../types/html';
import {User} from '../../types';
import {Form} from '../../types/form';
import {pageTemplate} from '../../templates';
import {getEquipmentName} from '../equipment/get-equipment-name';
import {getEquipmentIdFromForm} from '../equipment/get-equipment-id-from-form';

type ViewModel = {
  user: User;
  equipmentId: string;
  equipmentName: string;
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
        <label for="memberNumber">What is the members' number?</label>
        <input type="text" name="memberNumber" id="memberNumber" />
        <input
          type="hidden"
          name="equipmentId"
          value="${sanitizeString(viewModel.equipmentId)}"
        />
        <button type="submit">Confirm</button>
      </form>
    `,
    pageTemplate('Member Training Complete', viewModel.user)
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
      )
    );

export const markMemberTrainedForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
