import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {html, joinHtml, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {failureWithStatus} from '../../types/failure-with-status';
import {
  personLabel,
  toTrainingSessionView,
  TrainingSessionView,
} from '../../queries/shared-render/upcoming-training-sessions';
import {isEquipmentTrainer} from '../authentication-helpers/is-equipment-trainer';
import {isCancelled, sessionContextFromQuery} from './session-context';
import {renderSessionSummary} from './render-session-summary';
import {MAX_REASON_LENGTH} from './cancel';

type ViewModel = {
  equipment: {id: string; name: string};
  session: TrainingSessionView;
  alreadyCancelled: boolean;
};

const backToTrainings = (viewModel: ViewModel) =>
  html`<p>
    <a href="/equipment/${safe(viewModel.equipment.id)}/trainings"
      >Back to trainings</a
    >
  </p>`;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack">
        <h1>Cancel a training</h1>
        ${renderSessionSummary(viewModel.equipment.name, viewModel.session)}
        ${viewModel.alreadyCancelled
          ? html`<p>This training has already been cancelled.</p>`
          : html`
              ${viewModel.session.attendees.length === 0
                ? html`<p>Nobody is booked on it yet.</p>`
                : html`<p>These members are booked and will be emailed:</p>
                    <ul>
                      ${joinHtml(
                        viewModel.session.attendees.map(
                          attendee => html`<li>${personLabel(attendee)}</li>`
                        )
                      )}
                    </ul>`}
              <form
                action="/training-sessions/cancel?next=${safe(
                  encodeURIComponent(
                    `/equipment/${viewModel.equipment.id}/trainings`
                  )
                )}"
                method="post"
              >
                <input
                  type="hidden"
                  name="sessionId"
                  value="${safe(viewModel.session.id)}"
                />
                <label for="reason">Reason (optional)</label>
                <textarea
                  name="reason"
                  id="reason"
                  rows="3"
                  maxlength="${safe(String(MAX_REASON_LENGTH))}"
                ></textarea>
                <p class="form-hint">Included in the email to them.</p>
                <button type="submit">Cancel this training</button>
              </form>
            `}
        ${backToTrainings(viewModel)}
      </div>
    `,
    toLoggedInContent(safe('Cancel a training'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel, user}) =>
    pipe(
      sessionContextFromQuery(readModel, input),
      E.filterOrElse(
        ({equipment}) =>
          isEquipmentTrainer({
            actor: {tag: 'user', user},
            rm: readModel,
            input: {equipmentId: equipment.id},
          }),
        () =>
          failureWithStatus(
            'Only trainers on this equipment can cancel its trainings',
            StatusCodes.FORBIDDEN
          )()
      ),
      E.map(({session, equipment}) => ({
        equipment: {id: equipment.id, name: equipment.name},
        session: toTrainingSessionView(readModel, equipment)(session),
        alreadyCancelled: isCancelled(session),
      })),
      TE.fromEither
    );

export const cancelForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
