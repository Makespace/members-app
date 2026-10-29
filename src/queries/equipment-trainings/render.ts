import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {DateTime} from 'luxon';
import {
  TrainingSessionView,
  personLabel,
  renderDescription,
  sessionDay,
  sessionTimes,
  sessionWhen,
  spacesLeft,
  trainerLabel,
} from '../shared-render/upcoming-training-sessions';
import {meetupNumbers} from '../shared-render/meetup-trainings';
import {ViewModel, WaitingMember} from './construct-view-model';

const arrangeHref = (equipmentId: UUID, from: O.Option<UUID>) =>
  safe(
    `/equipment/arrange-training?equipmentId=${equipmentId}${pipe(
      from,
      O.match(
        () => '',
        id => `&from=${id}`
      )
    )}`
  );

// Who is coming, by name: the trainer is deciding whether to set off.
const bookings = (session: TrainingSessionView): Html =>
  O.isSome(session.cancelled)
    ? html`<span class="tag tag--cancelled">Cancelled</span>
        ${session.cancelled.value.reason === ''
          ? html``
          : html`<div class="training-session__reason">
              ${sanitizeString(session.cancelled.value.reason)}
            </div>`}`
    : html`
        <div>${spacesLeft(session)}</div>
        ${session.attendees.length === 0
          ? html``
          : html`<ul class="training-session__attendees">
              ${joinHtml(
                session.attendees.map(
                  attendee => html`<li>${personLabel(attendee)}</li>`
                )
              )}
            </ul>`}
      `;

const sessionRow =
  (equipmentId: UUID, canCancel: boolean, canArrange: boolean) =>
  (session: TrainingSessionView) => html`
    <tr>
      <td>${sessionDay(session)}</td>
      <td>${sessionTimes(session)}</td>
      <td>${trainerLabel(session)}</td>
      <td>${bookings(session)}</td>
      <td>${renderDescription(session)}</td>
      <td class="training-session__row-actions">
        ${canArrange
          ? html`<a
              class="button"
              href="${arrangeHref(equipmentId, O.some(session.id))}"
              >Duplicate</a
            >`
          : html``}
        ${canArrange && canCancel && O.isNone(session.cancelled)
          ? html`<a
              href="/training-sessions/cancel?sessionId=${safe(session.id)}"
              >Cancel</a
            >`
          : html``}
      </td>
    </tr>
  `;

const sessionTable = (
  equipmentId: UUID,
  sessions: ReadonlyArray<TrainingSessionView>,
  options: {empty: Html; canCancel: boolean; canArrange: boolean}
) =>
  sessions.length === 0
    ? html`<p class="upcoming-trainings__empty">${options.empty}</p>`
    : html`
        <table class="training-sessions-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Time</th>
              <th>Trainer</th>
              <th>Booked</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(
              sessions.map(
                sessionRow(equipmentId, options.canCancel, options.canArrange)
              )
            )}
          </tbody>
        </table>
      `;

const day = (date: Date) =>
  safe(
    DateTime.fromJSDate(date)
      .setZone('Europe/London')
      .setLocale('en-GB')
      .toFormat('d LLL yyyy')
  );

// "3 days", "5 weeks", "4 months": how long, said the way people say it.
const howLong = (since: Date, now: Date): string => {
  const days = Math.max(
    0,
    Math.floor((now.getTime() - since.getTime()) / (24 * 60 * 60 * 1000))
  );
  const say = (count: number, unit: string) =>
    `${count} ${unit}${count === 1 ? '' : 's'}`;
  return days < 14
    ? say(days, 'day')
    : days < 9 * 7
      ? say(Math.floor(days / 7), 'week')
      : say(Math.floor(days / 30), 'month');
};

const waitingRow = (now: Date) => (member: WaitingMember) => html`
  <tr>
    <td>
      ${pipe(
        member.name,
        O.match(
          () => html`Member ${safe(String(member.memberNumber))}`,
          name =>
            html`${sanitizeString(name)}
              <span class="waiting__number"
                >${safe(String(member.memberNumber))}</span
              >`
        )
      )}
    </td>
    <td>
      <strong>${safe(howLong(member.waitingSince, now))}</strong>
      <div class="waiting__since">
        since ${day(member.waitingSince)},
        ${member.passedQuiz
          ? html`passed the quiz`
          : html`first said so`}
      </div>
    </td>
    <td>
      ${pipe(
        member.lastExpressedInterest,
        O.match(
          () => html`<span class="waiting__none">not yet</span>`,
          at => html`${day(at)}`
        )
      )}
    </td>
    <td>
      ${pipe(
        member.bookedOn,
        O.match(
          () => html``,
          at => html`${day(at)}`
        )
      )}
    </td>
  </tr>
`;

// Who is waiting, longest first: what an owner or trainer needs to decide
// whether another session is due, and how big it should be.
const waitingSection = (viewModel: ViewModel): Html => html`
  <section class="stack">
    <h2>Waiting for training</h2>
    ${viewModel.waiting.length === 0
      ? html`<p class="upcoming-trainings__empty">
          Nobody is waiting: nobody untrained has passed the quiz or told the
          trainers they would like training.
        </p>`
      : html`
          <p class="waiting__summary">
            ${safe(String(viewModel.waiting.length))}
            ${viewModel.waiting.length === 1
              ? safe('member is')
              : safe('members are')}
            waiting, the longest for
            ${safe(howLong(viewModel.waiting[0].waitingSince, viewModel.now))}.
            ${safe(
              String(
                viewModel.waiting.filter(m => O.isSome(m.bookedOn)).length
              )
            )}
            booked on an upcoming training.
          </p>
          <table class="waiting-table">
            <thead>
              <tr>
                <th>Member</th>
                <th>Waiting</th>
                <th>Last said they would like training</th>
                <th>Booked</th>
              </tr>
            </thead>
            <tbody>
              ${joinHtml(viewModel.waiting.map(waitingRow(viewModel.now)))}
            </tbody>
          </table>
        `}
  </section>
`;

const meetupList = (viewModel: ViewModel): Html =>
  viewModel.meetupTrainings.length === 0
    ? html``
    : html`
        <h3 class="trainings__subheading">On Meetup</h3>
        <ul class="trainings__meetup">
          ${joinHtml(
            viewModel.meetupTrainings.map(
              training => html`<li>
                <img
                  class="source-icon"
                  src="/static/icons/meetup.svg"
                  alt="On Meetup"
                />
                <strong>${sessionWhen(training)}</strong>
                ${sanitizeString(training.title)} ·
                ${meetupNumbers(training)} ·
                <a
                  href="${sanitizeString(training.url)}"
                  target="_blank"
                  rel="noreferrer"
                  >On Meetup ↗</a
                >
              </li>`
            )
          )}
        </ul>
      `;

export const render = (viewModel: ViewModel): Html => html`
  <div class="stack">
    <h1>Trainings on ${sanitizeString(viewModel.equipment.name)}</h1>
    ${viewModel.canArrange
      ? html`<p class="eq-cards__actions">
          <a
            class="button"
            href="${arrangeHref(viewModel.equipment.id, O.none)}"
            >Add a new training</a
          >
          ${pipe(
            viewModel.lastOwnSessionId,
            O.match(
              () => html``,
              id => html`<a
                class="button"
                href="${arrangeHref(viewModel.equipment.id, O.some(id))}"
                >Duplicate your last training session</a
              >`
            )
          )}
        </p>`
      : html``}
    ${waitingSection(viewModel)}
    <h2>Upcoming</h2>
    ${sessionTable(viewModel.equipment.id, viewModel.upcoming, {
      empty: html`No trainings are arranged in the app yet.`,
      canCancel: true,
      canArrange: viewModel.canArrange,
    })}
    ${meetupList(viewModel)}
    <h2>Previous</h2>
    ${sessionTable(viewModel.equipment.id, viewModel.previous, {
      empty: html`No trainings have been arranged in the app before.`,
      canCancel: false,
      canArrange: viewModel.canArrange,
    })}
    <p>
      <a href="/equipment/${safe(viewModel.equipment.id)}"
        >Back to ${sanitizeString(viewModel.equipment.name)}</a
      >
    </p>
  </div>
`;
