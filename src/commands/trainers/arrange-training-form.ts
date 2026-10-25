import {pipe} from 'fp-ts/lib/function';
import * as t from 'io-ts';
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
import {SharedReadModel} from '../../read-models/shared-state';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {getEquipmentIdFromForm} from '../equipment/get-equipment-id-from-form';
import {isEquipmentTrainer} from '../authentication-helpers/is-equipment-trainer';
import {MAX_DESCRIPTION_LENGTH, MAX_SPACES} from './arrange-training';

// What the form starts out with. A duplicate keeps everything about the
// session it was copied from except the day, which is the thing that has to
// change, and the members booked in, who arranged that session and not this
// one.
type Prefill = {
  startTime: string;
  endTime: string;
  spaces: string;
  description: string;
};

type ViewModel = {
  equipment: Equipment;
  today: string;
  members: ReadonlyArray<Member>;
  duplicating: boolean;
  prefill: Prefill;
};

const londonTime = (date: Date) =>
  DateTime.fromJSDate(date).setZone('Europe/London').toFormat('HH:mm');

// Points members at the machine's page, where the guide and the quiz are.
const defaultDescription = (publicUrl: string, equipment: Equipment) =>
  `In-person training on [${equipment.name}](${publicUrl}/equipment/${equipment.id}). ` +
  'Please pass the online quiz before you come.';

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>
        ${viewModel.duplicating ? html`Duplicate a training` : html`Arrange a training`}
        on ${sanitizeString(viewModel.equipment.name)}
      </h1>
      ${viewModel.duplicating
        ? html`<p>
            Everything is copied from the earlier session apart from the day
            and the members booked in. Change anything else you need to.
          </p>`
        : html``}
      <form
        action="/equipment/arrange-training?next=${safe(
          encodeURIComponent(`/equipment/${viewModel.equipment.id}/trainings`)
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
          ${viewModel.duplicating ? html`autofocus` : html``}
        />
        <label for="startTime">Start time</label>
        <input
          type="time"
          name="startTime"
          id="startTime"
          value="${sanitizeString(viewModel.prefill.startTime)}"
          required
        />
        <label for="endTime">End time</label>
        <input
          type="time"
          name="endTime"
          id="endTime"
          value="${sanitizeString(viewModel.prefill.endTime)}"
          required
        />
        <label for="spaces">Number of spaces</label>
        <input
          type="number"
          name="spaces"
          id="spaces"
          min="1"
          max="${safe(String(MAX_SPACES))}"
          step="1"
          value="${sanitizeString(viewModel.prefill.spaces)}"
          required
        />
        <label for="description">Description</label>
        <textarea
          name="description"
          id="description"
          rows="4"
          maxlength="${safe(String(MAX_DESCRIPTION_LENGTH))}"
        >
${sanitizeString(viewModel.prefill.description)}</textarea
        >
        <p class="form-hint">
          Shown to members looking for a training. Links are written
          [like this](https://example.com).
        </p>
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
    toLoggedInContent(
      safe(viewModel.duplicating ? 'Duplicate a training' : 'Arrange a training')
    )
  );

const fromCodec = t.partial({from: UUID});

// The session to copy, which has to be one on this machine: copying another
// machine's session here would be a different training under this one's name.
const prefillFor = (
  input: unknown,
  readModel: SharedReadModel,
  equipment: Equipment
): E.Either<FailureWithStatus, O.Option<Prefill>> =>
  pipe(
    input,
    fromCodec.decode,
    E.mapLeft(() =>
      failureWithStatus('Invalid parameters', StatusCodes.BAD_REQUEST)()
    ),
    E.chain(({from}) =>
      from === undefined
        ? E.right(O.none)
        : pipe(
            readModel.trainingSessions.get(from),
            O.filter(session => session.equipmentId === equipment.id),
            E.fromOption(() =>
              failureWithStatus(
                'No such training on this equipment',
                StatusCodes.NOT_FOUND
              )()
            ),
            E.map(session =>
              O.some({
                startTime: londonTime(session.startsAt),
                endTime: londonTime(session.endsAt),
                spaces: String(session.spaces),
                description: session.description,
              })
            )
          )
    )
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel, user, deps}) =>
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
      E.chain(equipment =>
        pipe(
          prefillFor(input, readModel, equipment),
          E.map(prefill => ({
            equipment,
            today: DateTime.now().setZone('Europe/London').toISODate() ?? '',
            members: readModel.members.getAll(),
            duplicating: O.isSome(prefill),
            prefill: pipe(
              prefill,
              O.getOrElse(() => ({
                startTime: '',
                endTime: '',
                spaces: '',
                description: defaultDescription(
                  deps.conf.PUBLIC_URL,
                  equipment
                ),
              }))
            ),
          }))
        )
      ),
      TE.fromEither
    );

export const arrangeTrainingForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
