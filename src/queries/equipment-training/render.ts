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
import {renderInterest} from '../shared-render/training-interest';
import {renderUpcomingTrainingSessions} from '../shared-render/upcoming-training-sessions';

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

const missingPrerequisites = (viewModel: ViewModel) =>
  viewModel.prerequisites.filter(prerequisite => !prerequisite.trained);

const namesOf = (machines: ReadonlyArray<{name: string}>): Html =>
  joinHtml(
    machines.map(
      (machine, index) =>
        html`${index === 0
          ? safe('')
          : index === machines.length - 1
            ? safe(' and ')
            : safe(', ')}${sanitizeString(machine.name)}`
    )
  );

// What stops the practical, first thing first: nobody will book one before
// the machines it builds on, or before the quiz when the quiz is asked for.
const practicalBlocker = (viewModel: ViewModel): O.Option<Html> => {
  if (O.isSome(viewModel.trainedSince)) {
    return O.none;
  }
  const missing = missingPrerequisites(viewModel);
  if (missing.length > 0) {
    return O.some(html`You need to be trained on ${namesOf(missing)} first.`);
  }
  if (viewModel.quizRequired && viewModel.quiz.tag !== 'passed') {
    return O.some(html`You need to take the online quiz.`);
  }
  return O.none;
};

const practicalState = (viewModel: ViewModel): Html =>
  pipe(
    viewModel.trainedSince,
    O.match(
      () =>
        pipe(
          practicalBlocker(viewModel),
          O.match(
            () =>
              state(
                false,
                html`<p>
                  <strong>You need to attend an in-person training.</strong>
                </p>`
              ),
            // The step says what is actually blocking it rather than going
            // quiet.
            blocker => state(false, html`<p><strong>${blocker}</strong></p>`)
          )
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

const practicalStep = (viewModel: ViewModel, number: number) => html`
  <li
    class="training-step${O.isNone(practicalBlocker(viewModel))
      ? safe('')
      : safe(' training-step--waiting')}"
  >
    <h2>
      ${safe(String(number))}. Attend an in-person training session
    </h2>
    ${practicalState(viewModel)}
    <p>
      Training sessions can be organised on the
      <a href="${safe(MEETUP)}">Makespace Meetup group</a>
      or through this app.
      ${safe(String(viewModel.trainersUsingApp))}
      trainer${viewModel.trainersUsingApp === 1 ? safe('') : safe('s')} on
      this equipment
      ${viewModel.trainersUsingApp === 1 ? safe('has') : safe('have')} used the
      app to arrange a training session so far.
    </p>
    <h3>Upcoming trainings</h3>
    ${renderUpcomingTrainingSessions(
      viewModel.upcomingTrainings,
      {withDescriptions: true},
      viewModel.meetupTrainings
    )}
    ${O.isNone(viewModel.trainedSince)
      ? renderInterest(viewModel.equipment.id, viewModel.interestLastExpressed)
      : html``}
    <p>
      If there is no practical scheduled on Meetup or here, please email
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
      : html``}
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
            <dd>
              ${trainerList(viewModel)}
              <p class="training-trainers__note">
                Please keep in mind that trainers are volunteers!
              </p>
            </dd>`}
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
        ${joinHtml(
          steps(viewModel).map((step, index) => step(viewModel, index + 1))
        )}
        <!-- A further step belongs here once members countersign their
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

// The machines this one builds on, each with whether the member is trained
// on it and where to start if not.
const prerequisitesStep = (viewModel: ViewModel, number: number) => html`
  <li class="training-step">
    <h2>
      ${safe(String(number))}. Be trained on
      ${namesOf(viewModel.prerequisites)}
    </h2>
    ${O.isSome(viewModel.trainedSince) ||
    missingPrerequisites(viewModel).length === 0
      ? state(
          true,
          html`<p>
            <strong>You have done this.</strong>
          </p>`
        )
      : state(
          false,
          html`<p>
            <strong
              >This machine builds on
              ${viewModel.prerequisites.length === 1
                ? safe('that one')
                : safe('those')}, so you need to be trained on
              ${namesOf(missingPrerequisites(viewModel))} first.</strong
            >
          </p>`
        )}
    <ul class="training-prerequisites">
      ${joinHtml(
        viewModel.prerequisites.map(
          prerequisite => html`
            <li>
              <a href="/equipment/${safe(prerequisite.id)}/training"
                >${sanitizeString(prerequisite.name)}</a
              >
              —
              ${prerequisite.trained
                ? html`you are trained on it`
                : html`not yet`}
            </li>
          `
        )
      )}
    </ul>
  </li>
`;

const quizStep = (viewModel: ViewModel, number: number) => html`
        <li class="training-step">
          <h2>${safe(String(number))}. Pass the online quiz</h2>
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
`;

// The steps this machine asks for, in order. The machines it builds on come
// first, the quiz only when an owner who trains on it has not waived it, and
// the practical always.
const steps = (
  viewModel: ViewModel
): ReadonlyArray<(viewModel: ViewModel, number: number) => Html> => [
  ...(viewModel.prerequisites.length > 0 ? [prerequisitesStep] : []),
  ...(viewModel.quizRequired ? [quizStep] : []),
  practicalStep,
];
