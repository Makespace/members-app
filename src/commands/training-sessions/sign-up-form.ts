import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {html, Html, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {
  toTrainingSessionView,
  TrainingSessionView,
} from '../../queries/shared-render/upcoming-training-sessions';
import {constructViewModel as getTrainedViewModel} from '../../queries/equipment-training/construct-view-model';
import {isCancelled, sessionContextFromQuery} from './session-context';
import {SignUpStatus, signUpStatus} from '../../training-sessions/sign-ups';
import {backToTraining, renderSessionSummary} from './render-session-summary';

type ViewModel = {
  equipment: {id: string; name: string};
  session: TrainingSessionView;
  status: SignUpStatus;
  // Not passed the quiz and not trained already: worth saying before they
  // take a place, without stopping them.
  quizWarning: boolean;
};

const signUpHere = (viewModel: ViewModel): Html => {
  const id = safe(viewModel.session.id);
  switch (viewModel.status) {
    case 'open':
      return html`
        ${viewModel.quizWarning
          ? html`<div class="training-step__state training-step__state--todo">
              <p>
                <strong>You have not passed the online quiz yet.</strong> Please
                pass it before the training: the trainer will expect you to know
                the material.
              </p>
            </div>`
          : html``}
        <form
          action="/training-sessions/sign-up?next=${safe(
            encodeURIComponent(`/equipment/${viewModel.equipment.id}/training`)
          )}"
          method="post"
        >
          <input type="hidden" name="sessionId" value="${id}" />
          <button type="submit">Sign up</button>
        </form>
      `;
    case 'booked':
      return html`<p>
        You are already booked on this training.
        <a href="/training-sessions/cancel-place?sessionId=${id}"
          >Cancel your place</a
        >
      </p>`;
    case 'trainer':
      return html`<p>You are the trainer for this one.</p>`;
    case 'closed':
      return html`<p>Sign-ups for this training have closed.</p>`;
    case 'full':
      return html`<p>This training is full.</p>`;
    case 'cancelled':
      return html`<p>This training has been cancelled.</p>`;
  }
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack">
        <h1>Sign up for a training</h1>
        ${renderSessionSummary(viewModel.equipment.name, viewModel.session)}
        ${signUpHere(viewModel)}
        ${backToTraining(viewModel.equipment.id, viewModel.equipment.name)}
      </div>
    `,
    toLoggedInContent(safe('Sign up for a training'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({readModel, user, deps}) =>
    pipe(
      sessionContextFromQuery(readModel, input),
      TE.fromEither,
      TE.bindTo('context'),
      TE.bind('progress', ({context}) =>
        getTrainedViewModel(deps, user)(context.equipment.id)
      ),
      TE.map(({context, progress}) => ({
        equipment: {id: context.equipment.id, name: context.equipment.name},
        session: toTrainingSessionView(
          readModel,
          context.equipment
        )(context.session),
        status: signUpStatus(
          {...context.session, cancelled: isCancelled(context.session)},
          user.memberNumber,
          new Date()
        ),
        quizWarning:
          progress.quiz.tag !== 'passed' && O.isNone(progress.trainedSince),
      }))
    );

export const signUpForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
