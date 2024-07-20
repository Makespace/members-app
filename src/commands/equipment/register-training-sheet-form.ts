import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, sanitizeString} from '../../types/html';
import {User} from '../../types';
import {Form} from '../../types/form';
import {pageTemplate} from '../../templates';
import {getEquipmentName} from './get-equipment-name';
import {getEquipmentIdFromForm} from './get-equipment-id-from-form';
import {UUID} from 'io-ts-types';

type ViewModel = {
  user: User;
  equipmentId: UUID;
  equipmentName: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>
        Register training sheet for ${sanitizeString(viewModel.equipmentName)}
      </h1>
      <form action="/equipment/add-training-sheet" method="post">
        <label for="trainingSheetId">What is the sheet id?</label>
        <input type="text" name="trainingSheetId" id="trainingSheetId" />
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipmentId}"
        />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Register training sheet', viewModel.user)
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
