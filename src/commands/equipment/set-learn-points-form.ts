import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {html, safe, sanitizeString, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {getEquipmentIdFromForm} from './get-equipment-id-from-form';
import {UUID} from 'io-ts-types';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {
  MAX_LEARN_POINT_LENGTH,
  MAX_LEARN_POINTS,
} from '../../types/learn-points';

type ViewModel = {
  equipmentId: UUID;
  equipmentName: string;
  current: ReadonlyArray<string>;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>
        What to learn about ${sanitizeString(viewModel.equipmentName)}
      </h1>
      <p>
        Printed as a list under "Learn" on this machine's sign, in place of
        the general "What this equipment is for and how to use it." Say what
        a member most needs to know before using it - for example, how to
        empty it, or how to put it away.
      </p>
      <form action="/equipment/set-learn-points" method="post" class="stack">
        <label for="learnPoints"
          >One point per line - at most ${safe(String(MAX_LEARN_POINTS))},
          each up to ${safe(String(MAX_LEARN_POINT_LENGTH))} characters</label
        >
        <textarea
          name="learnPoints"
          id="learnPoints"
          rows="${safe(String(MAX_LEARN_POINTS + 1))}"
          cols="60"
          placeholder="How to change the dust bag and dispose of it&#10;How to tidy the equipment away after use"
        >
${sanitizeString(viewModel.current.join('\n'))}</textarea
        >
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipmentId}"
        />
        <button type="submit">Save</button>
      </form>
      <p>
        <small
          >Leave it empty to go back to the general sentence. Reprint the sign
          to put the change on the wall.</small
        >
      </p>
    `,
    toLoggedInContent(safe('What to learn'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel}) =>
    pipe(
      E.Do,
      E.bind('equipmentId', () => getEquipmentIdFromForm(input)),
      E.bind('equipment', ({equipmentId}) =>
        pipe(
          readModel.equipment.get(equipmentId),
          E.fromOption(
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)
          )
        )
      ),
      E.map(({equipmentId, equipment}) => ({
        equipmentId,
        equipmentName: equipment.name,
        current: equipment.learnPoints,
      })),
      TE.fromEither
    );

export const setLearnPointsForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
