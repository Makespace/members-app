import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {
  renderDescription,
  sessionTimes,
  spacesLeft,
  trainerLabel,
  yourPlace,
} from '../shared-render/upcoming-training-sessions';
import {UpcomingTraining, ViewModel} from './construct-view-model';

const MEETUP = 'https://www.meetup.com/makespace/';

// "Saturday 7 November", in UK time: the heading a member scans for.
const dayOf = (training: UpcomingTraining) =>
  DateTime.fromJSDate(training.session.startsAt)
    .setZone('Europe/London')
    .setLocale('en-GB')
    .toFormat('cccc d LLLL');

// Consecutive trainings on the same day, in the order given.
const byDay = (trainings: ReadonlyArray<UpcomingTraining>) =>
  trainings.reduce<Array<{day: string; trainings: UpcomingTraining[]}>>(
    (days, training) => {
      const day = dayOf(training);
      const last = days.at(-1);
      if (last !== undefined && last.day === day) {
        last.trainings.push(training);
      } else {
        days.push({day, trainings: [training]});
      }
      return days;
    },
    []
  );

const firstThing = (training: UpcomingTraining): O.Option<Html> => {
  switch (training.readiness.tag) {
    case 'ready':
      return O.none;
    case 'needs-quiz':
      return O.some(html`Pass the online quiz first.`);
    case 'needs-prerequisites':
      return O.some(
        html`Get trained on
        ${joinHtml(
          training.readiness.missing.map(
            (machine, index) =>
              html`${index === 0 ? safe('') : safe(', ')}${sanitizeString(
                machine.name
              )}`
          )
        )}
        first.`
      );
  }
};

// Whatever comes before the practical - other machines, or the quiz - comes
// first, so somebody who still needs it is sent to the machine's training
// page, which walks them through it, instead of straight into a session.
// Everything else is as on that page.
const action = (training: UpcomingTraining): Html =>
  pipe(
    firstThing(training),
    O.filter(() =>
      O.exists(status => status === 'open')(training.session.yourStatus)
    ),
    O.match(
      () => yourPlace(training.session),
      reason => html`<a
          class="button"
          href="/equipment/${safe(training.equipment.id)}/training"
          >Get trained</a
        >
        <span class="training-session__closed">${reason}</span>`
    )
  );

const renderTraining = (training: UpcomingTraining): Html => {
  const {equipment, session} = training;
  return html`
    <li class="upcoming-training">
      <div class="upcoming-training__time">${sessionTimes(session)}</div>
      <div class="upcoming-training__details">
        <a href="/equipment/${safe(equipment.id)}"
          ><strong>${sanitizeString(equipment.name)}</strong></a
        >
        <span class="upcoming-training__area"
          >${sanitizeString(equipment.areaName)}</span
        >
        ${training.trained
          ? html`<span class="tag tag--trained"
              >You're already trained on this</span
            >`
          : html``}
        <div>with ${trainerLabel(session)} · ${spacesLeft(session)}</div>
        ${renderDescription(session)}
        <div class="training-session__actions">${action(training)}</div>
      </div>
    </li>
  `;
};

const plural = (count: number, one: string, many: string) =>
  count === 1 ? one : many;

// Says what is being left out and how to see it, so nobody wonders where a
// session they heard about has gone.
const filter = (viewModel: ViewModel): Html =>
  viewModel.showingTrained
    ? html`<p class="training-filter">
        Including equipment you're already trained on.
        <a href="/training">Hide them</a>
      </p>`
    : viewModel.hiddenEquipment === 0
      ? html``
      : html`<p class="training-filter">
          ${safe(String(viewModel.hiddenEquipment))}
          ${safe(
            plural(
              viewModel.hiddenEquipment,
              'piece of equipment is',
              'pieces of equipment are'
            )
          )}
          hidden because you're already trained on
          ${safe(plural(viewModel.hiddenEquipment, 'it', 'them'))}.
          <a href="/training?show=trained">Show them</a>
        </p>`;

const empty = (viewModel: ViewModel): Html =>
  viewModel.hiddenEquipment > 0
    ? html`No trainings are arranged in the app for equipment you're not
        trained on yet.`
    : html`No trainings are arranged in the app right now.`;

export const render = (viewModel: ViewModel): Html => html`
  <div class="stack">
    <h1>Get trained</h1>
    <p>
      Trainers also put sessions on the
      <a href="${safe(MEETUP)}">Makespace Meetup group</a>.
    </p>
    ${filter(viewModel)}
    ${viewModel.trainings.length === 0
      ? html`<p class="upcoming-trainings__empty">${empty(viewModel)}</p>`
      : joinHtml(
          byDay(viewModel.trainings).map(
            ({day, trainings}) => html`
              <section class="upcoming-training-day">
                <h2>${sanitizeString(day)}</h2>
                <ul class="upcoming-training-list">
                  ${joinHtml(trainings.map(renderTraining))}
                </ul>
              </section>
            `
          )
        )}
  </div>
`;
