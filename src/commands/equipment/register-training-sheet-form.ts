import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {getEquipmentName} from './get-equipment-name';
import {getEquipmentIdFromForm} from './get-equipment-id-from-form';
import {UUID} from 'io-ts-types';

type ViewModel = {
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
    toLoggedInContent(safe('Register training sheet'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({events}) =>
    pipe(
      E.Do,
      E.bind('equipmentId', () => getEquipmentIdFromForm(input)),
      E.bind('equipmentName', ({equipmentId}) =>
        getEquipmentName(events, equipmentId)
      )
    );

export const registerTrainingSheetForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
