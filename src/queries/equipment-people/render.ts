import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {
  html,
  Html,
  joinHtml,
  safe,
  sanitizeOption,
  sanitizeString,
} from '../../types/html';
import {displayDate} from '../../templates/display-date';
import {renderMember} from '../../templates/member';
import {renderMemberNumber} from '../../templates/member-number';
import {PersonSummary, ViewModel} from './construct-view-model';

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

const page = (viewModel: ViewModel, heading: Html, body: Html) => html`
  <div class="stack">
    <h1>${heading}</h1>
    <p>${sanitizeString(viewModel.equipment.name)}</p>
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
    html`Currently trained users`,
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

const markTrainedButton = (viewModel: ViewModel, memberNumber: number) => html`
  <form action="/equipment/mark-member-trained" method="post">
    <input type="hidden" name="equipmentId" value="${viewModel.equipment.id}" />
    <input type="hidden" name="memberNumber" value="${memberNumber}" />
    <button type="submit">Mark as trained</button>
  </form>
`;

// Quizzes passed by someone the app cannot match to a member. They belong
// with the rest of the passes - they are people waiting too - rather than
// filed under the failures.
const unknownWaiting = (viewModel: ViewModel) =>
  viewModel.waitingUnknown.length === 0
    ? html``
    : html`
        <h2>Waiting for training - unknown member</h2>
        <p>
          Quizzes passed by someone whose member number or email did not match
          anybody. Adding the address to their record links them up.
        </p>
        <table>
          <tr>
            <th>Timestamp</th>
            <th>Member number provided</th>
            <th>Email provided</th>
          </tr>
          ${joinHtml(
            viewModel.waitingUnknown.map(
              quiz => html`
                <tr>
                  <td>
                    ${displayDate(DateTime.fromJSDate(quiz.waitingSince))}
                  </td>
                  <td>
                    ${pipe(
                      quiz.memberNumberProvided,
                      O.match(
                        () => html`-`,
                        renderMemberNumber
                      )
                    )}
                  </td>
                  <td>${sanitizeOption(quiz.emailProvided)}</td>
                </tr>
              `
            )
          )}
        </table>
      `;

export const renderQuizResults = (viewModel: ViewModel) =>
  page(
    viewModel,
    html`Training quiz results`,
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
      ${pipe(
        viewModel.waiting,
        RA.map(
          member => html`
            <tr>
              <td>${person(member, viewModel.isTrainerOrOwner)}</td>
              <td>${displayDate(DateTime.fromJSDate(member.waitingSince))}</td>
              ${viewModel.isTrainer
                ? html`<td>
                    ${markTrainedButton(viewModel, member.memberNumber)}
                  </td>`
                : html``}
            </tr>
          `
        ),
        RA.match(
          () => html`<p>No one is waiting for training</p>`,
          rows => html`
            <table>
              <tr>
                <th>Member</th>
                <th>Quiz passed</th>
                ${viewModel.isTrainer ? html`<th>Actions</th>` : html``}
              </tr>
              ${joinHtml(rows)}
            </table>
          `
        )
      )}
      ${unknownWaiting(viewModel)}
    `
  );

export const renderFailedQuizzes = (viewModel: ViewModel) =>
  page(
    viewModel,
    html`Failed quizzes`,
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
