import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import {User} from '../../types';
import {Form} from '../../types/form';
import {pageTemplate} from '../../templates';
import {getEquipmentName} from './get-equipment-name';
import {getEquipmentIdFromForm} from './get-equipment-id-from-form';
import Handlebars, {SafeString} from 'handlebars';

type ViewModel = {
  user: User;
  equipmentId: string;
  equipmentName: string;
};

const RENDER_REGISTER_TRAINING_SHEET_TEMPLATE = Handlebars.compile(
  `
      <h1>Register training sheet for {{equipmentName}}</h1>
      <form action="/equipment/add-training-sheet" method="post">
        <label for="trainingSheetId">What is the sheet id?</label>
        <input type="text" name="trainingSheetId" id="trainingSheetId" />
        <input
          type="hidden"
          name="equipmentId"
          value="{{equipmentId}}"
        />
        <button type="submit">Confirm and send</button>
      </form>
    `
);

const renderForm = (viewModel: ViewModel) =>
  pageTemplate(
    'Register training sheet',
    viewModel.user
  )(new SafeString(RENDER_REGISTER_TRAINING_SHEET_TEMPLATE(viewModel)));

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
