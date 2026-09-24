import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {StatusCodes} from 'http-status-codes';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';
import {EquipmentCategory} from '../../types/equipment-category';
import {
  categoryBadge,
  categoryChoices,
} from '../../templates/equipment-category';

type ViewModel = {
  equipmentId: UUID;
  equipmentName: string;
  category: EquipmentCategory;
  trainedCount: number;
  trainerCount: number;
};

// Recategorising hides the training machinery rather than deleting anything,
// and that distinction is worth stating on the form: an owner about to move a
// machine off red wants to know what happens to the people already trained on
// it.
const trainingNote = (viewModel: ViewModel) =>
  viewModel.category !== 'red' ||
  viewModel.trainedCount + viewModel.trainerCount === 0
    ? html``
    : html`<p class="training-step__state training-step__state--todo">
        This machine has ${safe(String(viewModel.trainedCount))} trained
        member${viewModel.trainedCount === 1 ? safe('') : safe('s')} and
        ${safe(String(viewModel.trainerCount))}
        trainer${viewModel.trainerCount === 1 ? safe('') : safe('s')} on
        record. Making it orange or green keeps all of that - the records, the
        quiz results and the history - but stops showing it, because those
        colours need no training. Set it back to red and it all reappears.
      </p>`;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack">
        <h1>Sticker category for ${sanitizeString(viewModel.equipmentName)}</h1>
        <p>
          Currently ${categoryBadge(viewModel.category)}. The colour decides
          what the machine's sign says, whether it has training, and who may
          use it.
        </p>
        ${trainingNote(viewModel)}
        <form action="/equipment/set-category" method="post" class="stack">
          ${categoryChoices(['red', 'orange', 'green'], viewModel.category)}
          <input
            type="hidden"
            name="equipmentId"
            value="${safe(viewModel.equipmentId)}"
          />
          <button type="submit">Save</button>
        </form>
      </div>
    `,
    toLoggedInContent(safe('Sticker category'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      input,
      t.strict({equipmentId: UUID}).decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(
        failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)
      ),
      E.chain(({equipmentId}) =>
        pipe(
          readModel.equipment.get(equipmentId),
          E.fromOption(
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)
          ),
          E.map(equipment => ({
            equipmentId,
            equipmentName: equipment.name,
            category: equipment.category,
            trainedCount: equipment.trainedMembers.length,
            trainerCount: equipment.trainers.length,
          }))
        )
      ),
      TE.fromEither
    );

export const setCategoryForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
