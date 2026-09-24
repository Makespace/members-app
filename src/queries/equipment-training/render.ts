import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {renderTrainingSparkline} from '../../templates/training-sparkline';
import {displayDate} from '../../templates/display-date';
import {
  categoryBadge,
  categoryDescription,
} from '../../templates/equipment-category';
import {Progress, ViewModel} from './construct-view-model';

const MEETUP = 'https://www.meetup.com/makespace/';
const MANAGEMENT_EMAIL = 'management@makespace.org';

const emailLink = (address: string) =>
  html`<a href="mailto:${safe(encodeURIComponent(address))}"
    >${sanitizeString(address)}</a
  >`;

// Where the member stands, in the second person, because this page exists to
// answer "what do I do next?" for the person reading it.
const progressPanel = (progress: Progress): Html => {
  switch (progress.tag) {
    case 'trained':
      return html`<div class="training-step__state training-step__state--done">
        <p>
          <strong>You are trained on this equipment.</strong> Marked trained on
          ${displayDate(DateTime.fromJSDate(progress.since))}.
        </p>
      </div>`;
    case 'passed':
      return html`<div class="training-step__state training-step__state--done">
        <p>
          <strong>You passed the online quiz</strong> on
          ${displayDate(DateTime.fromJSDate(progress.completedAt))}. Next:
          an in-person training session.
        </p>
      </div>`;
    case 'failed':
      return html`<div class="training-step__state training-step__state--todo">
        <p>
          <strong>You have taken the online quiz but not passed it yet.</strong>
          Your best attempt scored ${safe(String(progress.score))} out of
          ${safe(String(progress.maxScore))} on
          ${displayDate(DateTime.fromJSDate(progress.completedAt))}. You can
          take it again.
        </p>
      </div>`;
    case 'not-attempted':
      return html`<div class="training-step__state training-step__state--todo">
        <p><strong>You need to take the online quiz.</strong></p>
      </div>`;
    case 'no-quiz':
      return html`<div class="training-step__state training-step__state--todo">
        <p>
          No online quiz is registered for this equipment in the app yet, so
          your result cannot be shown here. The equipment guide is still the
          place to start.
        </p>
      </div>`;
  }
};

// The people who can actually run a practical, with what each of them has
// done recently: deciding whether to wait for a session or email the owners
// is easier with the record in front of you than with a count.
const trainerList = (viewModel: ViewModel) =>
  html`
        <ul class="training-trainers">
          ${joinHtml(
            viewModel.trainers.map(
              trainer => html`
                <li>
                  <span
                    >${pipe(
                      trainer.name,
                      O.match(
                        () =>
                          html`Member
                          ${safe(String(trainer.memberNumber))}`,
                        name => html`${sanitizeString(name)}`
                      )
                    )}</span
                  >
                  ${renderTrainingSparkline(trainer.trainingsByQuarter)}
                </li>
              `
            )
          )}
        </ul>
      `;

const practicalStep = (viewModel: ViewModel) => html`
  <li
    class="training-step${viewModel.progress.tag === 'passed' ||
    viewModel.progress.tag === 'trained'
      ? safe('')
      : safe(' training-step--waiting')}"
  >
    <h2>2. Attend an in-person training session</h2>
    <p>
      Check the
      <a href="${safe(MEETUP)}">Makespace Meetup group</a>
      for a practical assessment session. If there is no practical scheduled
      there, please email
      ${pipe(
        viewModel.area.email,
        O.match(
          () => html`the owners of ${sanitizeString(viewModel.area.name)}.`,
          // The address is written out rather than linked as "email us",
          // because someone reading this on a phone may want to type it into
          // their own mail app.
          email => html`${emailLink(email)}.`
        )
      )}
    </p>
    ${viewModel.trainers.length === 0
      ? // Nobody can run a practical here, so waiting for one to appear on
        // Meetup is waiting for nothing: say who to ask instead.
        html`<p>
          There are no active trainers for this equipment. Contact
          ${emailLink(MANAGEMENT_EMAIL)}
          ${pipe(
            viewModel.area.email,
            O.match(
              () => html``,
              email => html`and ${emailLink(email)}`
            )
          )}
          to arrange a training.
        </p>`
      : html`<p>
          This piece of equipment has
          ${safe(String(viewModel.trainers.length))} active
          trainer${viewModel.trainers.length === 1 ? safe('') : safe('s')}.
          Please keep in mind that trainers are volunteers!
        </p>`}
    <dl class="training-summary">
      <dt>Last training occurred</dt>
      <dd>
        ${pipe(
          viewModel.lastTraining,
          O.match(
            () => html`No trainings recorded yet`,
            date => html`${displayDate(DateTime.fromJSDate(date))}`
          )
        )}
      </dd>
      ${viewModel.trainers.length === 0
        ? html``
        : html`<dt>Active trainers</dt>
            <dd>${trainerList(viewModel)}</dd>`}
    </dl>
  </li>
`;

// Orange and green equipment has no training to get, so the page says so
// rather than walking someone through steps that do not apply to them.
const noTrainingNeeded = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>${sanitizeString(viewModel.equipment.name)}</h1>
    <p>
      ${categoryBadge(viewModel.equipment.category)} —
      ${categoryDescription(viewModel.equipment.category)}
    </p>
    <p>
      There is no training to book for this equipment.
      <a href="${safe(viewModel.guideUrl)}">Read the equipment guide</a>
      before using it.
    </p>
    <p>
      <a href="/equipment/${safe(viewModel.equipment.id)}"
        >Back to ${sanitizeString(viewModel.equipment.name)}</a
      >
    </p>
  </div>
`;

export const render = (viewModel: ViewModel): Html => {
  if (viewModel.equipment.category !== 'red') {
    return noTrainingNeeded(viewModel);
  }
  return html`
    <div class="stack">
      <h1>Get trained on ${sanitizeString(viewModel.equipment.name)}</h1>
      <p>
        ${categoryBadge(viewModel.equipment.category)} —
        ${categoryDescription(viewModel.equipment.category)}
      </p>
      <ol class="training-steps">
        <li class="training-step">
          <h2>1. Pass the online quiz</h2>
          ${progressPanel(viewModel.progress)}
          <p>
            The quiz is on the equipment guide for this machine, which is also
            where you learn how it works.
          </p>
          <p>
            <a class="button" href="${safe(viewModel.guideUrl)}"
              >Go to the equipment guide</a
            >
          </p>
        </li>
        ${practicalStep(viewModel)}
      </ol>
      <p>
        <a href="/equipment/${safe(viewModel.equipment.id)}"
          >Back to ${sanitizeString(viewModel.equipment.name)}</a
        >
      </p>
    </div>
  `;
};
