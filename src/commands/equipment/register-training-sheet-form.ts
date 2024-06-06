import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {DomainEvent, User} from '../../types';
import {v4} from 'uuid';
import {Form} from '../../types/form';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {readModels} from '../../read-models';

type ViewModel = {
  equipmentId: string;
  equipmentName: string;
};

const renderForm = (viewModel: ViewModel) =>
  html`
    <h1>Register training sheet for ${viewModel.equipmentName}</h1>
    <form action="/equipment/add-training-sheet" method="post">
      <label for="trainingSheetId">What is the sheet id?</label>
      <input type="text" name="trainingSheetId" id="trainingSheetId" />
      <input type="hidden" name="equipmentId" value="${viewModel.equipmentId}" />
      <button type="submit">Confirm and send</button>
    </form>
  `

const getEquipmentIdCodec = t.strict({
  equipmentId: t.string
});

const getEquipmentId = (input: unknown) =>
  pipe(
    input,
    getEquipmentIdCodec.decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    E.map(({equipmentId}) => equipmentId)
  );

const getEquipmentName = (events: ReadonlyArray<DomainEvent>, equipmentId: t.TypeOf<typeof getEquipmentIdCodec>['equipmentId']) =>
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
  ({user, events}) =>
    pipe(
      E.Do,
      E.bind('equipmentId', () => getEquipmentId(input)),
      E.bind('equipmentName', ({equipmentId}) => getEquipmentName(events, equipmentId)),
    );

export const registerTrainingSheetForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
