import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {UUID} from 'io-ts-types';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {getEquipmentName} from './get-equipment-name';
import {getEquipmentIdFromForm} from './get-equipment-id-from-form';
import { isAdminOrSuperUser } from '../authentication-helpers/is-admin-or-super-user';

type ViewModel = {
  equipmentId: UUID;
  equipmentName: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Retire '${sanitizeString(viewModel.equipmentName)}'?</h1>
        <p>
          It will be hidden from members looking for training. Existing training
          records are kept.
        </p>
        <form action="/equipment/mark-obsolete" method="post">
          <input type="hidden" name="id" value="${viewModel.equipmentId}" />
          <button type="submit">Confirm and retire</button>
        </form>
      </div>
    `,
    toLoggedInContent(html`Retire equipment`)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
      E.bind('equipmentId', () => getEquipmentIdFromForm(input)),
      E.bind('equipmentName', ({equipmentId}) =>
        getEquipmentName(readModel, equipmentId)
      ),
      TE.fromEither
    );

export const markEquipmentObsoleteForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: isAdminOrSuperUser,
};
