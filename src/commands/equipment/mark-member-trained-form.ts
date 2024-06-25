import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {html} from '../../types/html';
import {User} from '../../types';
import {Form} from '../../types/form';
import {pageTemplate} from '../../templates';
import {getEquipmentName} from './get-equipment-name';
import {getEquipmentIdFromForm} from './get-equipment-id-from-form';

type ViewModel = {
  user: User;
  equipmentId: string;
  equipmentName: string;
};

// TODO - Drop down suggestion list of users.

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Mark a member as trained on ${viewModel.equipmentName}</h1>
      <form action="/equipment/user-trained" method="post">
        <label for="memberEmail">What is the members email?</label>
        <input type="text" name="memberEmail" id="memberEmail" />
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipmentId}"
        />
        <button type="submit">Confirm</button>
      </form>
    `,
    pageTemplate('Member Training Complete', O.some(viewModel.user))
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

export const registerTrainingSheetForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
