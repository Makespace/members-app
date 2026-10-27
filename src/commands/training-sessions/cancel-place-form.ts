import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {html, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {
  toTrainingSessionView,
  TrainingSessionView,
} from '../../queries/shared-render/upcoming-training-sessions';
import {canCancelPlace} from '../../training-sessions/sign-ups';
import {isCancelled, sessionContextFromQuery} from './session-context';
import {backToTraining, renderSessionSummary} from './render-session-summary';

type ViewModel = {
  equipment: {id: string; name: string};
  session: TrainingSessionView;
  booked: boolean;
  canCancel: boolean;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack">
        <h1>Cancel your place</h1>
        ${renderSessionSummary(viewModel.equipment.name, viewModel.session)}
        ${!viewModel.booked
          ? html`<p>You are not booked on this training.</p>`
          : !viewModel.canCancel
            ? html`<p>
                This training has already started, so your place can no
                longer be cancelled here.
              </p>`
            : html`
                <p>
                  The trainer will be told, and your place will be open for
                  somebody else.
                </p>
                <form
                  action="/training-sessions/cancel-place?next=${safe(
                    encodeURIComponent(
                      `/equipment/${viewModel.equipment.id}/training`
                    )
                  )}"
                  method="post"
                >
                  <input
                    type="hidden"
                    name="sessionId"
                    value="${safe(viewModel.session.id)}"
                  />
                  <button type="submit">Cancel my place</button>
                </form>
              `}
        ${backToTraining(viewModel.equipment.id, viewModel.equipment.name)}
      </div>
    `,
    toLoggedInContent(safe('Cancel your place'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel, user}) =>
    pipe(
      sessionContextFromQuery(readModel, input),
      TE.fromEither,
      TE.map(({session, equipment}) => ({
        equipment: {id: equipment.id, name: equipment.name},
        session: toTrainingSessionView(
          readModel,
          equipment,
          O.some({memberNumber: user.memberNumber, now: new Date()})
        )(session),
        booked: session.attendees.includes(user.memberNumber),
        canCancel: canCancelPlace(
          {...session, cancelled: isCancelled(session)},
          new Date()
        ),
      }))
    );

export const cancelPlaceForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
