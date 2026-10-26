import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {
  TrainingSessionView,
  personLabel,
  renderDescription,
  sessionDay,
  sessionTimes,
  spacesLeft,
  trainerLabel,
} from '../shared-render/upcoming-training-sessions';
import {ViewModel} from './construct-view-model';

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
  (equipmentId: UUID, canCancel: boolean) =>
  (session: TrainingSessionView) => html`
    <tr>
      <td>${sessionDay(session)}</td>
      <td>${sessionTimes(session)}</td>
      <td>${trainerLabel(session)}</td>
      <td>${bookings(session)}</td>
      <td>${renderDescription(session)}</td>
      <td class="training-session__row-actions">
        <a
          class="button"
          href="${arrangeHref(equipmentId, O.some(session.id))}"
          >Duplicate</a
        >
        ${canCancel && O.isNone(session.cancelled)
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
  options: {empty: Html; canCancel: boolean}
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
              sessions.map(sessionRow(equipmentId, options.canCancel))
            )}
          </tbody>
        </table>
      `;

export const render = (viewModel: ViewModel): Html => html`
  <div class="stack">
    <h1>Trainings on ${sanitizeString(viewModel.equipment.name)}</h1>
    <p class="eq-cards__actions">
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
    </p>
    <h2>Upcoming</h2>
    ${sessionTable(viewModel.equipment.id, viewModel.upcoming, {
      empty: html`No trainings are arranged yet.`,
      canCancel: true,
    })}
    <h2>Previous</h2>
    ${sessionTable(viewModel.equipment.id, viewModel.previous, {
      empty: html`No trainings have been arranged in the app before.`,
      canCancel: false,
    })}
    <p>
      <a href="/equipment/${safe(viewModel.equipment.id)}"
        >Back to ${sanitizeString(viewModel.equipment.name)}</a
      >
    </p>
  </div>
`;
