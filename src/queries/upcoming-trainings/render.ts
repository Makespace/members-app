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

const renderTraining = ({equipment, session}: UpcomingTraining): Html => html`
  <li class="upcoming-training">
    <div class="upcoming-training__time">${sessionTimes(session)}</div>
    <div class="upcoming-training__details">
      <a href="/equipment/${safe(equipment.id)}/training"
        ><strong>${sanitizeString(equipment.name)}</strong></a
      >
      <span class="upcoming-training__area"
        >${sanitizeString(equipment.areaName)}</span
      >
      <div>with ${trainerLabel(session)} · ${spacesLeft(session)}</div>
      ${renderDescription(session)}
      <div class="training-session__actions">${yourPlace(session)}</div>
    </div>
  </li>
`;

export const render = (viewModel: ViewModel): Html => html`
  <div class="stack">
    <h1>Get trained</h1>
    <p>
      Every in-person training arranged in the app, soonest first. Trainers
      also put sessions on the
      <a href="${safe(MEETUP)}">Makespace Meetup group</a>. To find out what
      a machine needs before its training, open its page from
      <a href="/areas">Areas &amp; tools</a>.
    </p>
    ${viewModel.trainings.length === 0
      ? html`<p class="upcoming-trainings__empty">
          No trainings are arranged in the app right now.
        </p>`
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
