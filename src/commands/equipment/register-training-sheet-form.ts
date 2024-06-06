import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {html} from '../../types/html';
import {DomainEvent, User} from '../../types';
import {Form} from '../../types/form';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {readModels} from '../../read-models';
import {pageTemplate} from '../../templates';

type ViewModel = {
  user: User;
  equipmentId: string;
  equipmentName: string;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Register training sheet for ${viewModel.equipmentName}</h1>
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
    pageTemplate('Register training sheet', O.some(viewModel.user))
  );

const getEquipmentIdCodec = t.strict({
  equipmentId: t.string,
});

const getEquipmentId = (input: unknown) =>
  pipe(
    input,
    getEquipmentIdCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    E.map(({equipmentId}) => equipmentId)
  );

const getEquipmentName = (
  events: ReadonlyArray<DomainEvent>,
  equipmentId: t.TypeOf<typeof getEquipmentIdCodec>['equipmentId']
) =>
  pipe(
    equipmentId,
    readModels.equipment.get(events),
    E.fromOption(() =>
      failureWithStatus('No such equipment', StatusCodes.NOT_FOUND)()
    ),
    E.map(equipment => equipment.name)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({events, user}) =>
    pipe(
      {user},
      E.right,
      E.bind('equipmentId', () => getEquipmentId(input)),
      E.bind('equipmentName', ({equipmentId}) =>
        getEquipmentName(events, equipmentId)
      )
    );

export const registerTrainingSheetForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
