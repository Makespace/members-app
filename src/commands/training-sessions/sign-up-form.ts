import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {
  html,
  Html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {Form} from '../../types/form';
import {
  toTrainingSessionView,
  TrainingSessionView,
} from '../../queries/shared-render/upcoming-training-sessions';
import {
  Readiness,
  readinessFor,
} from '../../queries/equipment-training/construct-view-model';
import {isCancelled, sessionContextFromQuery} from './session-context';
import {SignUpStatus, signUpStatus} from '../../training-sessions/sign-ups';
import {backToTraining, renderSessionSummary} from './render-session-summary';

type ViewModel = {
  equipment: {id: string; name: string};
  session: TrainingSessionView;
  status: SignUpStatus;
  // Anything that should come first - other machines, or the quiz - is worth
  // saying before they take a place, without stopping them.
  readiness: Readiness;
};

const notReadyWarning = (readiness: Readiness): Html => {
  switch (readiness.tag) {
    case 'ready':
      return html``;
    case 'needs-quiz':
      return html`<div class="training-step__state training-step__state--todo">
        <p>
          <strong>You have not passed the online quiz yet.</strong> Please pass
          it before the training: the trainer will expect you to know the
          material.
        </p>
      </div>`;
    case 'needs-prerequisites':
      return html`<div class="training-step__state training-step__state--todo">
        <p>
          <strong
            >You are not trained on
            ${joinHtml(
              readiness.missing.map(
                (machine, index) =>
                  html`${index === 0 ? safe('') : safe(', ')}${sanitizeString(
                    machine.name
                  )}`
              )
            )}
            yet.</strong
          >
          This training builds on it, so please be trained on it first.
        </p>
      </div>`;
  }
};

const signUpHere = (viewModel: ViewModel): Html => {
  const id = safe(viewModel.session.id);
  switch (viewModel.status) {
    case 'open':
      return html`
        ${notReadyWarning(viewModel.readiness)}
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
      TE.map(context => ({
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
        readiness: readinessFor(deps, user, context.equipment),
      }))
    );

export const signUpForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
