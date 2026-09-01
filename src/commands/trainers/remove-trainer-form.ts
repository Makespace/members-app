import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {formatValidationErrors} from 'io-ts-reporters';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import * as RA from 'fp-ts/ReadonlyArray';
import {renderMemberNumber} from '../../templates/member-number';
import {UUID} from 'io-ts-types';
import {Equipment} from '../../read-models/shared-state/return-types';

type ViewModel = {
  equipment: Equipment;
};

const noTrainersToRemove = pipe(
  html`
    <div class="stack">
      <h1>Remove a trainer</h1>
      <p>This equipment has no trainers to remove.</p>
    </div>
  `,
  toLoggedInContent(safe('Remove Trainer'))
);

const renderForm = (viewModel: ViewModel) => {
  if (viewModel.equipment.trainers.length === 0) {
    return noTrainersToRemove;
  }

  return pipe(
    viewModel.equipment.trainers,
    RA.map(
      trainer =>
        html`<tr>
          <td>${sanitizeString(trainer.primaryEmailAddress)}</td>
          <td>${renderMemberNumber(trainer.memberNumber)}</td>
          <td>
            <form action="#" method="post">
              <input
                type="hidden"
                name="memberNumber"
                value="${trainer.memberNumber}"
              />
              <input
                type="hidden"
                name="equipmentId"
                value="${viewModel.equipment.id}"
              />
              <button type="submit">Remove</button>
            </form>
          </td>
        </tr>`
    ),
    joinHtml,
    tableRows => html`
      <h1>Remove a trainer for ${sanitizeString(viewModel.equipment.name)}</h1>
      <div id="wrapper"></div>
      <table id="all-trainers" data-gridjs>
        <thead>
          <tr>
            <th>E-Mail</th>
            <th>Member Number</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `,
    toLoggedInContent(safe('Remove Trainer'))
  );
};

const getEquipmentId = (input: unknown) =>
  pipe(
    input,
    t.strict({equipment: UUID}).decode,
    E.mapLeft(formatValidationErrors),
    E.mapLeft(failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)),
    E.map(({equipment}) => equipment)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
      E.bind('equipmentId', () => getEquipmentId(input)),
      E.bind('equipment', ({equipmentId}) => {
        const equipment = readModel.equipment.get(equipmentId);
        if (O.isNone(equipment)) {
          return E.left(
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)()
          );
        }
        return E.right(equipment.value);
      }),
      E.map(({equipment}) => ({equipment})),
      TE.fromEither
    );

export const removeTrainerForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
