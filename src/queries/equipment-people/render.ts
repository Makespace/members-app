import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {
  html,
  Html,
  joinHtml,
  safe,
  sanitizeString,
} from '../../types/html';
import {displayDate} from '../../templates/display-date';
import {renderMember} from '../../templates/member';
import {renderMemberNumber} from '../../templates/member-number';
import {
  PersonSummary,
  SEARCH_RESULT_LIMIT,
  TrainingRow,
  ViewModel,
} from './construct-view-model';

// One cell for a person, the way the areas page does it: name, number and -
// for the people who act on these lists - their address to copy.
const person = (summary: PersonSummary, includePrivate: boolean): Html =>
  pipe(
    summary.primaryEmailAddress,
    O.match(
      () => html`
        <div>
          ${sanitizeString(O.getOrElse(() => '-')(summary.name))}
          (${renderMemberNumber(summary.memberNumber)})
        </div>
      `,
      primaryEmailAddress =>
        renderMember(
          {
            name: summary.name,
            memberNumber: summary.memberNumber,
            primaryEmailAddress,
          },
          includePrivate
        )
    )
  );

const backToEquipment = (viewModel: ViewModel) => html`
  <p>
    <a href="/equipment/${safe(viewModel.equipment.id)}"
      >Back to ${sanitizeString(viewModel.equipment.name)}</a
    >
  </p>
`;

// One line says which machine and which list: "Band Saw training quiz
// results", not a heading with the machine's name floating under it.
const page = (viewModel: ViewModel, heading: Html, body: Html) => html`
  <div class="stack">
    <h1>${sanitizeString(viewModel.equipment.name)} ${heading}</h1>
    ${body} ${backToEquipment(viewModel)}
  </div>
`;

const revokeButton = (viewModel: ViewModel, memberNumber: number) => html`
  <form action="/equipment/revoke-member-trained" method="post">
    <input type="hidden" name="equipmentId" value="${viewModel.equipment.id}" />
    <input type="hidden" name="memberNumber" value="${memberNumber}" />
    <button type="submit">Revoke Training</button>
  </form>
`;

export const renderTrainedUsers = (viewModel: ViewModel) =>
  page(
    viewModel,
    html`currently trained users`,
    pipe(
      viewModel.trained,
      RA.map(
        member => html`
          <tr>
            <td>${person(member, viewModel.isTrainerOrOwner)}</td>
            <td>${displayDate(DateTime.fromJSDate(member.trainedSince))}</td>
            <td>
              ${pipe(
                member.trainedByMemberNumber,
                O.match(
                  () => html`-`,
                  renderMemberNumber
                )
              )}
            </td>
            ${viewModel.isTrainer
              ? html`<td>${revokeButton(viewModel, member.memberNumber)}</td>`
              : html``}
          </tr>
        `
      ),
      RA.match(
        () => html`<p>Nobody is currently trained on this equipment.</p>`,
        rows => html`
          <table>
            <tr>
              <th>Member</th>
              <th>Trained at</th>
              <th>Trained by</th>
              ${viewModel.isTrainer ? html`<th>Actions</th>` : html``}
            </tr>
            ${joinHtml(rows)}
          </table>
        `
      )
    )
  );

// This page, with the search kept, so a press lands back where it was made
// rather than on the areas page.
const quizResultsPath = (viewModel: ViewModel) =>
  `/equipment/${viewModel.equipment.id}/quiz-results` +
  pipe(
    viewModel.search,
    O.match(
      () => '',
      ({query}) => `?q=${encodeURIComponent(query)}`
    )
  );

const markTrainedButton = (viewModel: ViewModel, memberNumber: number) => html`
  <form
    class="training-mark"
    action="/equipment/mark-member-trained?next=${safe(
      encodeURIComponent(quizResultsPath(viewModel))
    )}"
    method="post"
  >
    <input type="hidden" name="equipmentId" value="${viewModel.equipment.id}" />
    <input type="hidden" name="memberNumber" value="${memberNumber}" />
    <button type="submit">Mark as trained</button>
  </form>
`;

// Greyed out rather than gone: the row is there to say the person was
// found, and the button to say what is missing before it can be pressed.
const disabledButton = (label: string, reason: string) => html`
  <button type="button" class="training-mark__disabled" disabled title="${safe(
    reason
  )}">
    ${safe(label)}
  </button>
`;

// A pass the app could not match: the number as typed, marked as unknown,
// the address as typed, and - if that address is somebody's - who.
const unknownPerson = (
  row: Extract<TrainingRow, {kind: 'unknown'}>,
  includePrivate: boolean
) => html`
  <div class="training-unknown">
    ${pipe(
      row.memberNumberProvided,
      O.match(
        () => html`<span>No member number given</span>`,
        number => html`${renderMemberNumber(number)}<b>?</b>
          <small>no member has this number</small>`
      )
    )}
  </div>
  ${includePrivate
    ? pipe(
        row.emailProvided,
        O.match(
          () => html``,
          email => html`<div><small>${sanitizeString(email)}</small></div>`
        )
      )
    : html``}
  ${pipe(
    row.possibleMatch,
    O.match(
      () => html``,
      match => html`
        <div class="training-unknown__match">
          Might be ${sanitizeString(O.getOrElse(() => '-')(match.name))}
          (${renderMemberNumber(match.memberNumber)}), whose address this is
        </div>
      `
    )
  )}
`;

const standingCell = (row: TrainingRow): Html => {
  if (row.kind === 'unknown') {
    return html`${displayDate(DateTime.fromJSDate(row.waitingSince))}`;
  }
  switch (row.standing.kind) {
    case 'passed':
      return html`${displayDate(DateTime.fromJSDate(row.standing.at))}`;
    case 'trained':
      return html`Already trained -
      ${displayDate(DateTime.fromJSDate(row.standing.since))}`;
    case 'not-passed':
      return html`<span class="training-not-passed"
        >No pass in the last year</span
      >`;
  }
};

const actionCell = (viewModel: ViewModel, row: TrainingRow): Html => {
  if (row.kind === 'unknown') {
    return disabledButton(
      'Mark as trained',
      'Nobody matches this pass. Add the address to their record to link it.'
    );
  }
  switch (row.standing.kind) {
    case 'passed':
      return markTrainedButton(viewModel, row.person.memberNumber);
    case 'trained':
      return disabledButton('Trained', 'Already trained on this equipment');
    case 'not-passed':
      return disabledButton(
        'Mark as trained',
        'They have not passed the quiz yet'
      );
  }
};

const trainingRow = (viewModel: ViewModel, row: TrainingRow) => html`
  <tr class="${row.kind === 'unknown' ? safe('training-row--unknown') : safe('')}">
    <td>
      ${row.kind === 'unknown'
        ? unknownPerson(row, viewModel.isTrainerOrOwner)
        : person(row.person, viewModel.isTrainerOrOwner)}
    </td>
    <td>${standingCell(row)}</td>
    ${viewModel.isTrainer ? html`<td>${actionCell(viewModel, row)}</td>` : html``}
  </tr>
`;

const trainingTable = (
  viewModel: ViewModel,
  rows: ReadonlyArray<TrainingRow>,
  whenEmpty: Html
) =>
  rows.length === 0
    ? whenEmpty
    : html`
        <table class="training-table">
          <tr>
            <th>Member</th>
            <th>Quiz passed</th>
            ${viewModel.isTrainer ? html`<th>Actions</th>` : html``}
          </tr>
          ${joinHtml(rows.map(row => trainingRow(viewModel, row)))}
        </table>
      `;

const searchBox = (viewModel: ViewModel) => html`
  <form method="get" class="training-search" role="search">
    <label for="training-search-q">Find a member</label>
    <input
      type="search"
      id="training-search-q"
      name="q"
      value="${sanitizeString(
        pipe(
          viewModel.search,
          O.match(
            () => '',
            ({query}) => query
          )
        )
      )}"
      placeholder="Member number, name or email"
    />
    <button type="submit">Search</button>
  </form>
`;

// The search filters the one table: with something typed, the table holds
// the matches and a line above it says so and offers everybody back.
const waitingOrMatches = (viewModel: ViewModel) =>
  pipe(
    viewModel.search,
    O.match(
      () =>
        trainingTable(
          viewModel,
          viewModel.waiting,
          html`<p>No one is waiting for training</p>`
        ),
      ({query, results}) => html`
        <p class="training-search__summary">
          ${results.length === SEARCH_RESULT_LIMIT
            ? html`The first ${SEARCH_RESULT_LIMIT} matching`
            : html`Matching`}
          &ldquo;${sanitizeString(query)}&rdquo;
          ${results.length === SEARCH_RESULT_LIMIT
            ? html`- try a member number or more of the name.`
            : html``}
          <a href="/equipment/${safe(viewModel.equipment.id)}/quiz-results"
            >Show everyone waiting</a
          >
        </p>
        ${trainingTable(
          viewModel,
          results,
          html`<p>Nobody matches &ldquo;${sanitizeString(query)}&rdquo;.</p>`
        )}
      `
    )
  );

// Pressing "Mark as trained" marks the row where it is, so a trainer working
// down the list is not thrown back to the top of a reloaded page each time.
// The browser's own submit remains the fallback for anything the post
// refuses, so the page can then say what went wrong.
const markInPlace = () => html`
  <script>
    (function () {
      if (!window.fetch) return;
      document.querySelectorAll('form.training-mark').forEach(function (form) {
        form.addEventListener('submit', function (event) {
          var row = form.closest('tr');
          var button = form.querySelector('button');
          if (!row || !button) return;
          event.preventDefault();
          button.disabled = true;
          // Url-encoded, as the browser would send it: the server reads no
          // other kind of form body.
          fetch(form.getAttribute('action'), {
            method: 'POST',
            body: new URLSearchParams(new FormData(form)),
            credentials: 'same-origin',
          })
            .then(function (response) {
              if (!response.ok) throw new Error('not ok');
              row.classList.add('training-row--trained');
              button.textContent = 'Trained';
              button.setAttribute('title', 'Marked as trained just now');
            })
            .catch(function () {
              button.disabled = false;
              form.submit();
            });
        });
      });
    })();
  </script>
`;

export const renderQuizResults = (viewModel: ViewModel) =>
  page(
    viewModel,
    html`training quiz results`,
    html`
      <p>
        ${pipe(
          viewModel.lastQuizSync,
          O.match(
            () => html`Last refresh date unknown`,
            at => html`Last refresh: ${displayDate(DateTime.fromJSDate(at))}`
          )
        )}
      </p>
      <h2>Waiting for training</h2>
      ${searchBox(viewModel)} ${waitingOrMatches(viewModel)}
      ${viewModel.isTrainer ? markInPlace() : html``}
    `
  );

export const renderFailedQuizzes = (viewModel: ViewModel) =>
  page(
    viewModel,
    html`failed quizzes`,
    html`
      <p>Members who have attempted the quiz recently without passing it.</p>
      ${pipe(
        viewModel.failed,
        RA.map(
          row => html`
            <tr>
              <td>${displayDate(DateTime.fromJSDate(row.completedAt))}</td>
              <td>
                ${pipe(
                  row.memberNumberProvided,
                  O.match(
                    () => html`-`,
                    renderMemberNumber
                  )
                )}
              </td>
              <td>${row.score} / ${row.maxScore} (${row.percentage}%)</td>
            </tr>
          `
        ),
        RA.match(
          () => html`<p>Nobody has failed the quiz recently.</p>`,
          rows => html`
            <table>
              <tr>
                <th>Timestamp</th>
                <th>Member number</th>
                <th>Score</th>
              </tr>
              ${joinHtml(rows)}
            </table>
          `
        )
      )}
    `
  );
