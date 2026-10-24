import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';
import {DateTime} from 'luxon';
import {StatusCodes} from 'http-status-codes';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {Equipment, Member} from '../../read-models/shared-state/return-types';
import {failureWithStatus} from '../../types/failure-with-status';
import {getEquipmentIdFromForm} from '../equipment/get-equipment-id-from-form';
import {isEquipmentTrainer} from '../authentication-helpers/is-equipment-trainer';
import {MAX_SPACES} from './arrange-training';

type ViewModel = {
  equipment: Equipment;
  today: string;
  members: ReadonlyArray<Member>;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Arrange a training on ${sanitizeString(viewModel.equipment.name)}</h1>
      <form
        action="/equipment/arrange-training?next=${safe(
          encodeURIComponent(`/equipment/${viewModel.equipment.id}`)
        )}"
        method="post"
      >
        <input type="hidden" name="sessionId" value="${v4() as UUID}" />
        <input
          type="hidden"
          name="equipmentId"
          value="${viewModel.equipment.id}"
        />
        <label for="date">Day</label>
        <input
          type="date"
          name="date"
          id="date"
          min="${safe(viewModel.today)}"
          required
        />
        <label for="startTime">Start time</label>
        <input type="time" name="startTime" id="startTime" required />
        <label for="endTime">End time</label>
        <input type="time" name="endTime" id="endTime" required />
        <label for="spaces">Number of spaces</label>
        <input
          type="number"
          name="spaces"
          id="spaces"
          min="1"
          max="${safe(String(MAX_SPACES))}"
          step="1"
          required
        />
        <fieldset>
          <legend>Members already booked in (optional)</legend>
          <p>
            If you have arranged this training with someone directly, add them
            here. They take up some of the spaces, and the rest stay open for
            others to join.
          </p>
          <datalist id="training-members">
            ${joinHtml(
              viewModel.members.map(
                member =>
                  html`<option value="${member.memberNumber}">
                    ${pipe(
                      member.name,
                      O.match(
                        () => html`Member ${member.memberNumber}`,
                        name => html`${sanitizeString(name)}`
                      )
                    )}
                  </option>`
              )
            )}
          </datalist>
          <div id="training-attendees" class="stack">
            <input
              type="text"
              inputmode="numeric"
              name="attendees"
              list="training-members"
              aria-label="Member number"
              placeholder="Start typing a name or member number"
            />
          </div>
          <button type="button" id="training-add-attendee">
            Add another member
          </button>
          <script>
            document
              .getElementById('training-add-attendee')
              .addEventListener('click', () => {
                const inputs = document.getElementById('training-attendees');
                const next = inputs.querySelector('input').cloneNode();
                next.value = '';
                inputs.appendChild(next);
                next.focus();
              });
          </script>
        </fieldset>
        <button type="submit">Arrange training</button>
      </form>
    `,
    toLoggedInContent(safe('Arrange a training'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel, user}) =>
    pipe(
      getEquipmentIdFromForm(input),
      E.chain(equipmentId =>
        pipe(
          readModel.equipment.get(equipmentId),
          E.fromOption(() =>
            failureWithStatus('Unknown equipment', StatusCodes.NOT_FOUND)()
          )
        )
      ),
      E.filterOrElse(
        equipment =>
          isEquipmentTrainer({
            actor: {tag: 'user', user},
            rm: readModel,
            input: {equipmentId: equipment.id},
          }),
        () =>
          failureWithStatus(
            'Only trainers on this equipment can arrange a training',
            StatusCodes.FORBIDDEN
          )()
      ),
      E.map(equipment => ({
        equipment,
        today: DateTime.now().setZone('Europe/London').toISODate() ?? '',
        members: readModel.members.getAll(),
      })),
      TE.fromEither
    );

export const arrangeTrainingForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
