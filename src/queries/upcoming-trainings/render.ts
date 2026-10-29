import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {logInPath} from '../../authentication/login/routes';
import {
  renderDescription,
  trainerLabel,
  yourPlace,
} from '../shared-render/upcoming-training-sessions';
import {bookOnMeetup} from '../shared-render/meetup-trainings';
import {
  UpcomingMeetupTraining,
  UpcomingTraining,
  ViewModel,
} from './construct-view-model';

// The page is laid out after Tufte's Envisioning Information: every training
// is one row of the same shape, whichever calendar it came from, so the eye
// compares trainings rather than layouts; the only filled button is the one
// real decision (Sign up); colour is kept to small spots on a quiet page; and
// a six-week strip at the top gives the overall picture before the detail.

const MEETUP = 'https://www.meetup.com/makespace/';
const ZONE = 'Europe/London';

type Machine = {id: string; name: string; areaName: string};

// Both kinds of training, said the same way.
type Row = {
  source: 'app' | 'meetup';
  startsAt: Date;
  endsAt: Date;
  machine: O.Option<Machine>;
  // Meetup's title for a Meetup training, which is what people will see when
  // they get there; nothing for the app's, which are named by the machine.
  title: O.Option<string>;
  who: Html;
  trained: boolean;
  capacity: {filled: number; total: number; text: Html};
  description: Html;
  action: Html;
};

const london = (date: Date) =>
  DateTime.fromJSDate(date).setZone(ZONE).setLocale('en-GB');

// "18.00–21.00": a dot is quieter between hours and minutes than a colon, and
// is how British timetables have long written it.
const times = (row: Pick<Row, 'startsAt' | 'endsAt'>) =>
  safe(
    `${london(row.startsAt).toFormat('HH.mm')}–${london(row.endsAt).toFormat(
      'HH.mm'
    )}`
  );

const dayKey = (date: Date) => london(date).toFormat('yyyy-LL-dd');

// "Today", "Tomorrow", "in 5 days": how far off it is matters more than the
// date when deciding whether you can make it.
const fromNow = (day: DateTime, now: Date): string => {
  const days = Math.round(
    day.startOf('day').diff(london(now).startOf('day'), 'days').days
  );
  return days === 0
    ? 'Today'
    : days === 1
      ? 'Tomorrow'
      : days < 14
        ? `in ${days} days`
        : '';
};

// One mark per place, filled for each taken: the marks both count and, down
// the page, form a picture of which trainings still have room.
const MAX_DOTS = 12;
const dots = (filled: number, total: number): Html =>
  total === 0 || total > MAX_DOTS
    ? html``
    : html`<span class="capacity__dots" aria-hidden="true"
        >${safe(
          '●'.repeat(Math.min(filled, total)) +
            '○'.repeat(Math.max(total - filled, 0))
        )}</span
      >`;

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
    href="/equipment/${safe(equipmentId)}/training"
    >Get trained</a
  >
  <span class="training-row__note">${reason}</span>`;

const logInToSignUp = html`<a
  class="button-outline button-outline--small"
  href="${safe(logInPath)}?next=${safe(encodeURIComponent('/training'))}"
  >Log in to sign up</a
>`;

const appRow = (viewModel: ViewModel, training: UpcomingTraining): Row => {
  const session = training.session;
  const left = Math.max(session.spaces - session.booked, 0);
  return {
    source: 'app',
    startsAt: session.startsAt,
    endsAt: session.endsAt,
    machine: O.some(training.equipment),
    title: O.none,
    who: html`with ${trainerLabel(session)}`,
    trained: training.trained,
    capacity: {
      filled: session.booked,
      total: session.spaces,
      text:
        left === 0
          ? html`full`
          : html`${safe(String(left))} of ${safe(String(session.spaces))}
            left`,
    },
    description: renderDescription(session),
    // Whatever comes before the practical - other machines, or the quiz -
    // comes first, so somebody who still needs it is sent to the machine's
    // training page instead of straight into a session.
    action: !viewModel.loggedIn
      ? logInToSignUp
      : pipe(
          firstThing(training),
          O.filter(() =>
            O.exists(status => status === 'open')(session.yourStatus)
          ),
          O.match(
            () => yourPlace(session),
            reason => getTrainedFirst(training.equipment.id, reason)
          )
        ),
  };
};

// Meetup counts the host among those going, so its numbers are given as
// Meetup gives them.
const meetupRow = (training: UpcomingMeetupTraining): Row => {
  const meetup = training.meetup;
  return {
    source: 'meetup',
    startsAt: meetup.startsAt,
    endsAt: meetup.endsAt,
    machine: training.equipment,
    title: O.some(meetup.title),
    // The red spot already says it is on Meetup.
    who: html``,
    trained: training.trained,
    capacity: {
      filled: meetup.going,
      total: meetup.maxTickets,
      text: meetup.rsvpsClosed
        ? html`RSVPs closed`
        : meetup.maxTickets > 0
          ? html`${safe(String(meetup.going))} going · limit
            ${safe(String(meetup.maxTickets))}`
          : html`${safe(String(meetup.going))} going`,
    },
    description: html``,
    action: pipe(
      O.Do,
      O.bind('equipment', () => training.equipment),
      O.bind('reason', () => firstThing(training)),
      O.match(
        () => bookOnMeetup(meetup),
        ({equipment, reason}) => getTrainedFirst(equipment.id, reason)
      )
    ),
  };
};

// Where a training is arranged, as a small mark: the Makespace logo for the
// app, Meetup's for Meetup. Marks rather than colours, as red and green read
// as full and not full.
const sourceSpot = (source: Row['source']) =>
  source === 'app'
    ? html`<img
        class="source-icon"
        src="/static/MS-LOGO-txpt-512.png"
        alt="Arranged in this app"
        title="Arranged in this app"
      />`
    : html`<img
        class="source-icon"
        src="/static/icons/meetup.svg"
        alt="On Meetup"
        title="On Meetup"
      />`;

const renderRow = (row: Row): Html => html`
  <li class="training-row">
    <div class="training-row__time">${times(row)}</div>
    <div class="training-row__what">
      <div>
        ${sourceSpot(row.source)}
        ${pipe(
          row.machine,
          O.match(
            () =>
              html`<strong
                >${sanitizeString(O.getOrElse(() => '')(row.title))}</strong
              >`,
            machine =>
              html`<a href="/equipment/${safe(machine.id)}"
                  ><strong>${sanitizeString(machine.name)}</strong></a
                >
                <span class="training-row__area"
                  >${sanitizeString(machine.areaName)}</span
                >`
          )
        )}
        ${row.trained
          ? html`<span class="training-row__trained"
              >✓ you're trained on this</span
            >`
          : html``}
      </div>
      <div class="training-row__detail">
        ${row.who}${O.isSome(row.machine) && O.isSome(row.title)
          ? html`${sanitizeString(row.title.value)}`
          : html``}
      </div>
      <div class="training-row__description">${row.description}</div>
    </div>
    <div class="training-row__capacity">
      ${dots(row.capacity.filled, row.capacity.total)}
      <span>${row.capacity.text}</span>
    </div>
    <div class="training-row__action">${row.action}</div>
  </li>
`;

const byDay = (rows: ReadonlyArray<Row>) =>
  [...rows]
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .reduce<Array<{key: string; day: DateTime; rows: Row[]}>>((days, row) => {
      const key = dayKey(row.startsAt);
      const last = days.at(-1);
      if (last !== undefined && last.key === key) {
        last.rows.push(row);
      } else {
        days.push({key, day: london(row.startsAt), rows: [row]});
      }
      return days;
    }, []);

const renderDays = (rows: ReadonlyArray<Row>, now: Date): Html =>
  joinHtml(
    byDay(rows).map(
      ({key, day, rows}) => html`
        <section class="training-day" id="day-${safe(key)}">
          <h2 class="training-day__heading">
            ${safe(day.toFormat('cccc d LLLL'))}
            <span class="training-day__when">${safe(fromNow(day, now))}</span>
          </h2>
          <ul class="training-rows">
            ${joinHtml(rows.map(renderRow))}
          </ul>
        </section>
      `
    )
  );

// The next six weeks, a week to a line, with a mark for each training: how
// much is on, and which weeks are thin, before reading any one of them.
const WEEKS = 6;
// Days with machine trainings link to that day; a day with only other Meetup
// trainings links to where those are listed.
const overview = (
  machineRows: ReadonlyArray<Row>,
  otherRows: ReadonlyArray<Row>,
  now: Date
): Html => {
  const start = london(now).startOf('week');
  const onDay = new Map<string, Row[]>();
  for (const row of [...machineRows, ...otherRows]) {
    const key = dayKey(row.startsAt);
    onDay.set(key, [...(onDay.get(key) ?? []), row]);
  }
  const listedDays = new Set(machineRows.map(row => dayKey(row.startsAt)));
  const target = (key: string) =>
    listedDays.has(key) ? `#day-${key}` : '#other-trainings';
  const today = dayKey(now);
  const weeks = Array.from({length: WEEKS}, (_, week) =>
    Array.from({length: 7}, (_, day) => start.plus({weeks: week, days: day}))
  );
  return html`
    <table class="training-overview">
      <caption class="visually-hidden">
        Trainings in the next six weeks
      </caption>
      <thead>
        <tr>
          ${joinHtml(
            ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(
              letter => html`<th scope="col">${safe(letter)}</th>`
            )
          )}
        </tr>
      </thead>
      <tbody>
        ${joinHtml(
          weeks.map(
            days => html`<tr>
              ${joinHtml(
                days.map(day => {
                  const key = day.toFormat('yyyy-LL-dd');
                  const these = onDay.get(key) ?? [];
                  const past = key < today;
                  const label = html`<span class="training-overview__date"
                      >${safe(day.toFormat(day.day === 1 ? 'd LLL' : 'd'))}</span
                    >${joinHtml(these.map(row => sourceSpot(row.source)))}`;
                  return html`<td
                    class="${past
                      ? safe('training-overview__past')
                      : key === today
                        ? safe('training-overview__today')
                        : safe('')}"
                  >
                    ${these.length === 0
                      ? label
                      : html`<a href="${safe(target(key))}">${label}</a>`}
                  </td>`;
                })
              )}
            </tr>`
          )
        )}
      </tbody>
    </table>
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
    ? html`No trainings are coming up for equipment you're not trained on
        yet.`
    : html`No trainings are coming up right now.`;

export const render = (viewModel: ViewModel, now: Date = new Date()): Html => {
  const machineRows = [
    ...viewModel.trainings.map(training => appRow(viewModel, training)),
    ...viewModel.meetupTrainings
      .filter(training => O.isSome(training.equipment))
      .map(meetupRow),
  ];
  // Meetup trainings that are not for a machine (first aid, say) are kept
  // apart, so they do not interrupt the machine trainings.
  const otherRows = viewModel.meetupTrainings
    .filter(training => O.isNone(training.equipment))
    .map(meetupRow);
  return html`
    <div class="stack training-calendar">
      <h1>Get trained</h1>
      <p class="training-legend">
        ${sourceSpot('app')} arranged in this app
        ${sourceSpot('meetup')} on the
        <a href="${safe(MEETUP)}">Makespace Meetup group</a>, booked there
      </p>
      ${filter(viewModel)}
      ${machineRows.length + otherRows.length === 0
        ? html`<p class="upcoming-trainings__empty">${empty(viewModel)}</p>`
        : html`
            ${overview(machineRows, otherRows, now)}
            ${renderDays(machineRows, now)}
            ${otherRows.length === 0
              ? html``
              : html`<section class="training-other" id="other-trainings">
                  <h2>Other trainings on Meetup</h2>
                  <ul class="training-rows">
                    ${joinHtml(
                      [...otherRows]
                        .sort(
                          (a, b) => a.startsAt.getTime() - b.startsAt.getTime()
                        )
                        .map(
                          row => html`${renderRow({
                            ...row,
                            who: html`${safe(
                              london(row.startsAt).toFormat('ccc d LLL')
                            )}`,
                          })}`
                        )
                    )}
                  </ul>
                </section>`}
          `}
    </div>
  `;
};
