import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {getEquipmentIdFromForm} from './get-equipment-id-from-form';
import {UUID} from 'io-ts-types';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {currentTrainingSheetButton} from '../../queries/shared-render/current-training-sheet-button';

type ViewModel = {
  equipmentId: UUID;
  equipmentName: string;
  currentTrainingSheetId: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>
        Are you sure you wish to remove the current training sheet for
        ${sanitizeString(viewModel.equipmentName)}?
      </h1>
      ${currentTrainingSheetButton(viewModel.currentTrainingSheetId)}
      <form action="/equipment/remove-training-sheet" method="del">
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipmentId}"
        />
        <button type="submit">Confirm</button>
      </form>
    `,
    toLoggedInContent(safe('Remove training sheet'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
      E.bind('equipmentId', () => getEquipmentIdFromForm(input)),
      E.bind('equipment', ({equipmentId}) =>
        pipe(
          equipmentId,
          readModel.equipment.get,
          E.fromOption(() =>
            failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
          )
        )
      ),
      E.bind('equipmentName', ({equipment}) => E.right(equipment.name)),
      E.bind('currentTrainingSheetId', ({equipment}) =>
        pipe(
          equipment.trainingSheetId,
          E.fromOption(() =>
            failureWithStatus(
              'No training sheet currently registered',
              StatusCodes.NOT_FOUND
            )()
          )
        )
      )
    );

export const removeTrainingSheetForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
