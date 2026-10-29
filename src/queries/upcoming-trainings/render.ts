import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {logInPath} from '../../authentication/login/routes';
import {
  renderDescription,
  sessionTimes,
  spacesLeft,
  trainerLabel,
  yourPlace,
} from '../shared-render/upcoming-training-sessions';
import {
  bookOnMeetup,
  meetupNumbers,
  onMeetupTag,
} from '../shared-render/meetup-trainings';
import {
  UpcomingMeetupTraining,
  UpcomingTraining,
  ViewModel,
} from './construct-view-model';

const MEETUP = 'https://www.meetup.com/makespace/';

type Entry =
  | {kind: 'app'; training: UpcomingTraining}
  | {kind: 'meetup'; training: UpcomingMeetupTraining};

const startOf = (entry: Entry) =>
  entry.kind === 'app'
    ? entry.training.session.startsAt
    : entry.training.meetup.startsAt;

// "Saturday 7 November", in UK time: the heading a member scans for.
const dayOf = (entry: Entry) =>
  DateTime.fromJSDate(startOf(entry))
    .setZone('Europe/London')
    .setLocale('en-GB')
    .toFormat('cccc d LLLL');

const london = (date: Date) =>
  DateTime.fromJSDate(date).setZone('Europe/London').toFormat('HH:mm');

// Both kinds together, soonest first, then gathered under their day.
const byDay = (viewModel: ViewModel) =>
  [
    ...viewModel.trainings.map(training => ({kind: 'app', training}) as const),
    ...viewModel.meetupTrainings.map(
      training => ({kind: 'meetup', training}) as const
    ),
  ]
    .sort((a, b) => startOf(a).getTime() - startOf(b).getTime())
    .reduce<Array<{day: string; entries: Entry[]}>>((days, entry) => {
      const day = dayOf(entry);
      const last = days.at(-1);
      if (last !== undefined && last.day === day) {
        last.entries.push(entry);
      } else {
        days.push({day, entries: [entry]});
      }
      return days;
    }, []);

const firstThing = (
  training: UpcomingTraining | UpcomingMeetupTraining
): O.Option<Html> => {
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

const getTrainedFirst = (equipmentId: string, reason: Html) => html`<a
    class="button"
    href="/equipment/${safe(equipmentId)}/training"
    >Get trained</a
  >
  <span class="training-session__closed">${reason}</span>`;

// Somebody not logged in can see everything but sign up to nothing in the
// app; logging in brings them back here.
const logInToSignUp = html`<a
  class="button-outline"
  href="${safe(logInPath)}?next=${safe(encodeURIComponent('/training'))}"
  >Log in to sign up</a
>`;

// Whatever comes before the practical - other machines, or the quiz - comes
// first, so somebody who still needs it is sent to the machine's training
// page, which walks them through it, instead of straight into a session.
// Everything else is as on that page.
const appAction = (viewModel: ViewModel, training: UpcomingTraining): Html =>
  !viewModel.loggedIn
    ? logInToSignUp
    : pipe(
        firstThing(training),
        O.filter(() =>
          O.exists(status => status === 'open')(training.session.yourStatus)
        ),
        O.match(
          () => yourPlace(training.session),
          reason => getTrainedFirst(training.equipment.id, reason)
        )
      );

// Meetup trainings are booked on Meetup; the same "first things first"
// applies when the app knows which machine it is for.
const meetupAction = (training: UpcomingMeetupTraining): Html =>
  pipe(
    O.Do,
    O.bind('equipment', () => training.equipment),
    O.bind('reason', () => firstThing(training)),
    O.match(
      () => bookOnMeetup(training.meetup),
      ({equipment, reason}) => getTrainedFirst(equipment.id, reason)
    )
  );

const trainedTag = (trained: boolean) =>
  trained
    ? html`<span class="tag tag--trained">You're already trained on this</span>`
    : html``;

const machineLink = (equipment: {id: string; name: string; areaName: string}) =>
  html`<a href="/equipment/${safe(equipment.id)}"
      ><strong>${sanitizeString(equipment.name)}</strong></a
    >
    <span class="upcoming-training__area"
      >${sanitizeString(equipment.areaName)}</span
    >`;

const renderAppTraining = (
  viewModel: ViewModel,
  training: UpcomingTraining
): Html => html`
  <li class="upcoming-training">
    <div class="upcoming-training__time">
      ${sessionTimes(training.session)}
    </div>
    <div class="upcoming-training__details">
      ${machineLink(training.equipment)} ${trainedTag(training.trained)}
      <div>
        with ${trainerLabel(training.session)} ·
        ${spacesLeft(training.session)}
      </div>
      ${renderDescription(training.session)}
      <div class="training-session__actions">
        ${appAction(viewModel, training)}
      </div>
    </div>
  </li>
`;

// The machine when the app could tell which it is, and Meetup's own title
// either way, since that is what people will see when they get there.
const renderMeetupTraining = (training: UpcomingMeetupTraining): Html => html`
  <li class="upcoming-training">
    <div class="upcoming-training__time">
      ${safe(
        `${london(training.meetup.startsAt)}–${london(training.meetup.endsAt)}`
      )}
    </div>
    <div class="upcoming-training__details">
      ${pipe(
        training.equipment,
        O.match(
          () => html`<strong>${sanitizeString(training.meetup.title)}</strong>`,
          equipment => html`${machineLink(equipment)}`
        )
      )}
      ${onMeetupTag} ${trainedTag(training.trained)}
      ${O.isSome(training.equipment)
        ? html`<div>${sanitizeString(training.meetup.title)}</div>`
        : html``}
      <div>${meetupNumbers(training.meetup)}</div>
      <div class="training-session__actions">${meetupAction(training)}</div>
    </div>
  </li>
`;

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
    ? html`No trainings are coming up for equipment you're not trained on
        yet.`
    : html`No trainings are coming up right now.`;

export const render = (viewModel: ViewModel): Html => {
  const days = byDay(viewModel);
  return html`
    <div class="stack">
      <h1>Get trained</h1>
      <p>
        Trainings arranged in this app and on the
        <a href="${safe(MEETUP)}">Makespace Meetup group</a>, soonest first.
        Meetup trainings are booked on Meetup.
      </p>
      ${filter(viewModel)}
      ${days.length === 0
        ? html`<p class="upcoming-trainings__empty">${empty(viewModel)}</p>`
        : joinHtml(
            days.map(
              ({day, entries}) => html`
                <section class="upcoming-training-day">
                  <h2>${sanitizeString(day)}</h2>
                  <ul class="upcoming-training-list">
                    ${joinHtml(
                      entries.map(entry =>
                        entry.kind === 'app'
                          ? renderAppTraining(viewModel, entry.training)
                          : renderMeetupTraining(entry.training)
                      )
                    )}
                  </ul>
                </section>
              `
            )
          )}
    </div>
  `;
};
