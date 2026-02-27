import * as E from 'fp-ts/Either';
import {Form} from '../../types/form';
import {pipe} from 'fp-ts/lib/function';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {getEquipmentIdFromForm} from './get-equipment-id-from-form';
import {getEquipmentName} from './get-equipment-name';

type ViewModel = {
  equipmentId: string;
  equipmentName: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Remove '${sanitizeString(viewModel.equipmentName)}'?</h1>
        <form action="#" method="post">
          <input
            type="hidden"
            name="id"
            value="${safe(viewModel.equipmentId)}"
          />
          <button type="submit">Confirm and send</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Remove Equipment'))
  );

export const removeEquipmentForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    input =>
    ({readModel}) =>
      pipe(
        E.Do,
        E.bind('equipmentId', () => getEquipmentIdFromForm(input)),
        E.bind('equipmentName', ({equipmentId}) =>
          getEquipmentName(readModel, equipmentId)
        )
      ),
};
