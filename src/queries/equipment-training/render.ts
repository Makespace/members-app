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
import {ViewModel} from './construct-view-model';

const MEETUP = 'https://www.meetup.com/makespace/';
const MANAGEMENT_EMAIL = 'management@makespace.org';

const emailLink = (address: string) =>
  html`<a href="mailto:${safe(encodeURIComponent(address))}"
    >${sanitizeString(address)}</a
  >`;

const state = (done: boolean, body: Html) =>
  html`<div
    class="training-step__state training-step__state--${done
      ? safe('done')
      : safe('todo')}"
  >
    ${body}
  </div>`;

// Where the member stands on each step, in the second person, because this
// page exists to answer "what do I do next?" for the person reading it. Both
// steps carry one, so the answer is legible from either half of the page.
const quizState = (viewModel: ViewModel): Html => {
  // Trained members who never took the quiz are not behind on anything: the
  // quiz came in long after most of the training records did.
  if (O.isSome(viewModel.trainedSince) && viewModel.quiz.tag !== 'passed') {
    return state(
      true,
      html`<p>
        <strong>You are already trained on this equipment</strong>, so you do
        not need to take the quiz.
      </p>`
    );
  }
  switch (viewModel.quiz.tag) {
    case 'passed':
      return state(
        true,
        html`<p>
          <strong>You passed the online quiz</strong> on
          ${displayDate(DateTime.fromJSDate(viewModel.quiz.completedAt))}.
        </p>`
      );
    case 'failed':
      return state(
        false,
        html`<p>
          <strong>You have taken the online quiz but not passed it yet.</strong>
          Your best attempt scored ${safe(String(viewModel.quiz.score))} out of
          ${safe(String(viewModel.quiz.maxScore))} on
          ${displayDate(DateTime.fromJSDate(viewModel.quiz.completedAt))}. You
          can take it again.
        </p>`
      );
    case 'not-attempted':
      return state(
        false,
        html`<p><strong>You need to take the online quiz.</strong></p>`
      );
    case 'no-quiz':
      return state(
        false,
        html`<p>
          No online quiz is registered for this equipment in the app yet, so
          your result cannot be shown here. The equipment guide is still the
          place to start.
        </p>`
      );
  }
};

const practicalState = (viewModel: ViewModel): Html =>
  pipe(
    viewModel.trainedSince,
    O.match(
      () =>
        viewModel.quiz.tag === 'passed'
          ? state(
              false,
              html`<p>
                <strong>You need to attend an in-person training.</strong>
              </p>`
            )
          : // Nobody will book a practical before the quiz is passed, so the
            // step says what is actually blocking it rather than going quiet.
            state(
              false,
              html`<p><strong>You need to take the online quiz.</strong></p>`
            ),
      trainedSince =>
        state(
          true,
          html`<p>
            <strong>You have completed an in-person training</strong> on
            ${displayDate(DateTime.fromJSDate(trainedSince))}. You are welcome
            to take the training again whenever you would like a refresher.
          </p>`
        )
    )
  );

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
    class="training-step${viewModel.quiz.tag === 'passed' ||
    O.isSome(viewModel.trainedSince)
      ? safe('')
      : safe(' training-step--waiting')}"
  >
    <h2>2. Attend an in-person training session</h2>
    ${practicalState(viewModel)}
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
      ${pipe(
        viewModel.guideUrl,
        O.match(
          () => html`Read its guide on
            <a href="https://equipment.makespace.org"
              >equipment.makespace.org</a
            >
            before using it.`,
          guideUrl =>
            html`<a href="${safe(guideUrl)}">Read the equipment guide</a>
              before using it.`
        )
      )}
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
          ${quizState(viewModel)}
          ${pipe(
            viewModel.guideUrl,
            O.match(
              // Nobody has recorded where this machine's guide lives, and the
              // app will not invent an address: say so, rather than sending
              // the member to a page that may not exist.
              () => html`<p>
                The guide for this machine has not been recorded in the app
                yet, so there is no link to give you. You will find it on
                <a href="https://equipment.makespace.org"
                  >equipment.makespace.org</a
                >, and an owner can record the address from this machine's
                page so the next person gets a link.
              </p>`,
              guideUrl => html`
                <p>
                  The quiz is on the equipment guide for this machine, which is
                  also where you learn how it works.
                </p>
                <p>
                  <a class="button" href="${safe(guideUrl)}"
                    >Go to the equipment guide</a
                  >
                </p>
              `
            )
          )}
        </li>
        ${practicalStep(viewModel)}
        <!-- A third step belongs here once members countersign their
             training to say they are happy with what they were shown and
             confident to use the machine. -->
      </ol>
      <p>
        <a href="/equipment/${safe(viewModel.equipment.id)}"
          >Back to ${sanitizeString(viewModel.equipment.name)}</a
        >
      </p>
    </div>
  `;
};
