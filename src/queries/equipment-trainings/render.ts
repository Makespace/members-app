import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {
  TrainingSessionView,
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

const sessionRow = (equipmentId: UUID) => (session: TrainingSessionView) => html`
  <tr>
    <td>${sessionDay(session)}</td>
    <td>${sessionTimes(session)}</td>
    <td>${trainerLabel(session)}</td>
    <td>${spacesLeft(session)}</td>
    <td>${renderDescription(session)}</td>
    <td>
      <a class="button" href="${arrangeHref(equipmentId, O.some(session.id))}"
        >Duplicate</a
      >
    </td>
  </tr>
`;

const sessionTable = (
  equipmentId: UUID,
  sessions: ReadonlyArray<TrainingSessionView>,
  empty: Html
) =>
  sessions.length === 0
    ? html`<p class="upcoming-trainings__empty">${empty}</p>`
    : html`
        <table class="training-sessions-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Time</th>
              <th>Trainer</th>
              <th>Spaces</th>
              <th>Description</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(sessions.map(sessionRow(equipmentId)))}
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
    ${sessionTable(
      viewModel.equipment.id,
      viewModel.upcoming,
      html`No trainings are arranged yet.`
    )}
    <h2>Previous</h2>
    ${sessionTable(
      viewModel.equipment.id,
      viewModel.previous,
      html`No trainings have been arranged in the app before.`
    )}
    <p>
      <a href="/equipment/${safe(viewModel.equipment.id)}"
        >Back to ${sanitizeString(viewModel.equipment.name)}</a
      >
    </p>
  </div>
`;
