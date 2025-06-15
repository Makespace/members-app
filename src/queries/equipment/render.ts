import {pipe} from 'fp-ts/lib/function';
import {displayDate} from '../../templates/display-date';
import {renderMemberNumber} from '../../templates/member-number';
import {
  Html,
  html,
  joinHtml,
  sanitizeOption,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {ViewModel} from './view-model';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {DateTime} from 'luxon';
import {UUID} from 'io-ts-types';
import {renderMembersAsList} from '../../templates/member-link-list';
import {currentTrainingSheetButton} from '../shared-render/current-training-sheet-button';
import {
  EquipmentQuizResults,
  MemberAwaitingTraining,
  OrphanedPassedQuiz,
} from '../../read-models/external-state/equipment-quiz';

const trainersList = (trainers: ViewModel['equipment']['trainers']) =>
  pipe(
    trainers,
    RA.match(
      () => html`<p>This equipment needs trainers.</p>`,
      renderMembersAsList
    )
  );

const isOwner = (viewModel: ViewModel) => viewModel.isSuperUserOrOwnerOfArea;

const isTrainerOrOwner = (viewModel: ViewModel) =>
  viewModel.isSuperUserOrTrainerOfArea || viewModel.isSuperUserOrOwnerOfArea;

const trainMember = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isTrainerOrOwner),
    O.map(viewModel => viewModel.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/mark-member-trained?equipmentId=${id}"
            >Mark member as trained</a
          >
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const addTrainer = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isOwner),
    O.map(viewModel => viewModel.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/add-trainer?equipment=${id}"> Add a trainer </a>
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const registerSheet = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isTrainerOrOwner),
    O.map(viewModel => viewModel.equipment.id),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/add-training-sheet?equipmentId=${id}">
            Register training sheet
          </a>
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const currentSheet = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isTrainerOrOwner),
    O.flatMap(viewModel => viewModel.equipment.trainingSheetId),
    O.map(currentTrainingSheetButton),
    O.getOrElse(() => html``)
  );

const removeTrainingSheet = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isTrainerOrOwner),
    O.flatMap(viewModel =>
      O.isNone(viewModel.equipment.trainingSheetId)
        ? O.none
        : O.some(viewModel.equipment.id)
    ),
    O.map(
      id =>
        html` <li>
          <a href="/equipment/remove-training-sheet?equipmentId=${id}">
            Remove training sheet
          </a>
        </li>`
    ),
    O.getOrElse(() => html``)
  );

const equipmentActions = (viewModel: ViewModel) => html`
  <ul>
    ${trainMember(viewModel)} ${addTrainer(viewModel)}
    ${registerSheet(viewModel)} ${currentSheet(viewModel)}
    ${removeTrainingSheet(viewModel)}
  </ul>
`;

const currentlyTrainedUsersTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.equipment.trainedMembers,
    RA.map(
      member =>
        html`<tr>
          <td>${sanitizeString(O.getOrElse(() => '')(member.name))}</td>
          <td>${renderMemberNumber(member.memberNumber)}</td>
          <td>${displayDate(DateTime.fromJSDate(member.trainedSince))}</td>
          <td>
            ${O.isNone(member.trainedByMemberNumber)
              ? ''
              : renderMemberNumber(member.trainedByMemberNumber.value)}
          </td>
          <td>
            <form action="/equipment/revoke-member-trained" method="post">
              <input
                type="hidden"
                name="equipmentId"
                value="${viewModel.equipment.id}"
              />
              <input
                type="hidden"
                name="memberNumber"
                value="${member.memberNumber}"
              />
              <button type="submit">Revoke Training</button>
            </form>
          </td>
        </tr>`
    ),
    joinHtml,
    rows => html`
      <h2>Currently Trained Users</h2>
      <table>
        <tr>
          <th>Name</th>
          <th>Member Number</th>
          <th>Trained at</th>
          <th>Trained by</th>
          <th>Actions</th>
        </tr>
        ${rows}
      </table>
    `
  );

const waitingForTrainingRow =
  (equipmentId: UUID) => (member: MemberAwaitingTraining) => html`
    <tr class="passed_training_quiz_row">
      <td>${sanitizeString(O.getOrElse(() => 'unknown')(member.name))}</td>
      <td>${renderMemberNumber(member.memberNumber)}</td>
      <td>${displayDate(DateTime.fromJSDate(member.waitingSince))}</td>
      <td>
        <form action="/equipment/mark-member-trained" method="post">
          <input type="hidden" name="equipmentId" value="${equipmentId}" />
          <input
            type="hidden"
            name="memberNumber"
            value="${member.memberNumber}"
          />
          <button type="submit">Mark as trained</button>
        </form>
      </td>
    </tr>
  `;

const waitingForTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.quizResults,
    O.map(r =>
      pipe(
        r.membersAwaitingTraining,
        RA.map(waitingForTrainingRow(viewModel.equipment.id)),
        RA.match(
          () => html`<p>No one is waiting for training</p>`,
          rows => html`
            <table>
              <tr>
                <th hidden>Quiz ID</th>
                <th>Name</th>
                <th>Member Number</th>
                <th>Waiting Since</th>
                <th>Actions</th>
              </tr>
              ${joinHtml(rows)}
            </table>
          `
        )
      )
    ),
    O.getOrElse(() => html`<p>No training quiz data available</p>`)
  );

const passedUnknownQuizRow = (unknownQuiz: OrphanedPassedQuiz) => html`
  <tr class="passed_training_quiz_row">
    <td>${displayDate(DateTime.fromJSDate(unknownQuiz.waitingSince))}</td>
    ${O.isSome(unknownQuiz.memberNumberProvided)
      ? html`<td>
          ${renderMemberNumber(unknownQuiz.memberNumberProvided.value)}
        </td>`
      : html`<td>${sanitizeOption(unknownQuiz.memberNumberProvided)}</td>`}
    <td>${sanitizeOption(unknownQuiz.emailProvided)}</td>
  </tr>
`;

const unknownMemberWaitingForTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.quizResults,
    O.map(qr =>
      pipe(
        qr.unknownMembersAwaitingTraining,
        RA.map(passedUnknownQuizRow),
        RA.match(
          () => html``,
          rows => html`
            <h3>Waiting for Training - Unknown Member</h3>
            <p>Quizes passed by unknown members.</p>
            <table>
              <tr>
                <th>Timestamp</th>
                <th>Member Number Provided</th>
                <th>Email Provided</th>
              </tr>
              ${joinHtml(rows)}
            </table>
          `
        )
      )
    ),
    O.getOrElse(() => html`<p>No training quiz data available</p>`)
  );

const failedQuizRow = (row: EquipmentQuizResults['failedQuizes'][0]) => html`
  <tr class="failed_training_quiz_row">
    <td>${displayDate(DateTime.fromJSDate(row.response_submitted))}</td>
    <td>
      ${pipe(
        O.fromNullable(row.member_number_provided),
        O.map(renderMemberNumber),
        O.getOrElse(() => html`-`)
      )}
    </td>
    <td>${row.score} / ${row.max_score} (${row.percentage}%)</td>
  </tr>
`;

const failedQuizTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.quizResults,
    O.map(r =>
      pipe(
        r.failedQuizes,
        RA.map(failedQuizRow),
        RA.match(
          () => html``,
          rows => html`
            <h3>Failed quizes</h3>
            <p>
              Members who haven't passed (but have attempted) the quiz recently
            </p>
            <table>
              <tr>
                <th>Timestamp</th>
                <th>Member Number</th>
                <th>Score</th>
              </tr>
              ${joinHtml(rows)}
            </table>
          `
        )
      )
    ),
    O.getOrElse(() => html``)
  );

const renderLastRefresh = (lastQuizSync: O.Option<Date>): Html =>
  O.isSome(lastQuizSync)
    ? html`Last refresh: ${displayDate(DateTime.fromJSDate(lastQuizSync.value))}`
    : html`Last refresh date unknown`;

const trainingQuizResults = (viewModel: ViewModel) => html`
  <h2>Training Quiz Results</h2>
  ${renderLastRefresh(
    pipe(
      viewModel.quizResults,
      O.flatMap(r => r.lastQuizSync)
    )
  )}
  <h3>Waiting for Training</h3>
  ${waitingForTrainingTable(viewModel)} ${failedQuizTrainingTable(viewModel)}
  ${unknownMemberWaitingForTrainingTable(viewModel)}
`;

export const render = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    (viewModel: ViewModel) => html`
      <div class="stack">
        <h1>${sanitizeString(viewModel.equipment.name)}</h1>
        ${equipmentActions(viewModel)}
        <h2>Trainers</h2>
        ${trainersList(viewModel.equipment.trainers)}
        ${currentlyTrainedUsersTable(viewModel)}
        ${isTrainerOrOwner(viewModel) ? trainingQuizResults(viewModel) : html``}
      </div>
    `,
    toLoggedInContent(sanitizeString(viewModel.equipment.name))
  );
