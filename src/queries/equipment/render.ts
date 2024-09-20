import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {displayDate} from '../../templates/display-date';
import {renderMemberNumber} from '../../templates/member-number';
import {
  Html,
  html,
  joinHtml,
  sanitizeOption,
  sanitizeString,
} from '../../types/html';
import {ViewModel} from './view-model';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {MemberAwaitingTraining} from '../../read-models/shared-state/return-types';
import {DateTime} from 'luxon';

const trainersList = (trainers: ViewModel['equipment']['trainers']) =>
  pipe(
    trainers,
    RA.map(
      trainer => html`<li>${renderMemberNumber(trainer.memberNumber)}</li>`
    ),
    RA.match(
      () => html`<p>This equipment needs trainers.</p>`,
      items => html`
        <h2>Trainers</h2>
        <ul>
          ${joinHtml(items)}
        </ul>
      `
    )
  );

const isOwner = (viewModel: ViewModel) => viewModel.isSuperUserOrOwnerOfArea;
const isTrainerOrOwner = (viewModel: ViewModel) =>
  viewModel.isSuperUserOrTrainerOfArea || viewModel.isSuperUserOrOwnerOfArea;

const trainMember = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    O.of,
    O.filter(isOwner),
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
    O.map(trainingSheetId => sanitizeString(trainingSheetId)),
    O.map(trainingSheetId => {
      return html`<li>
        <a href="https://docs.google.com/spreadsheets/d/${trainingSheetId}">
          Current training sheet
        </a>
      </li>`;
    }),
    O.getOrElse(() => html``)
  );

const equipmentActions = (viewModel: ViewModel) => html`
  <ul>
    ${trainMember(viewModel)} ${addTrainer(viewModel)}
    ${registerSheet(viewModel)} ${currentSheet(viewModel)}
  </ul>
`;

const currentlyTrainedUsersTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.equipment.trainedMembers,
    RA.map(member => member.memberNumber),
    RA.map(renderMemberNumber),
    RA.map(
      memberNumberHtml =>
        html`<tr>
          <td>${memberNumberHtml}</td>
        </tr>`
    ),
    joinHtml,
    rows => html`
      <h2>Currently Trained Users</h2>
      <table>
        <tr>
          <th>Member Number</th>
        </tr>
        ${rows}
      </table>
    `
  );

const waitingForTrainingRow = (member: MemberAwaitingTraining) => html`
  <tr class="passed_training_quiz_row">
    <td hidden>${member.quizId}</td>
    <td>${displayDate(DateTime.fromJSDate(member.waitingSince))}</td>
    <td>${renderMemberNumber(member.memberNumber)}</td>
    <td><button>Mark as trained</button></td>
  </tr>
`;

const waitingForTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.equipment.membersAwaitingTraining,
    RA.map(waitingForTrainingRow),
    RA.match(
      () => html`<p>No one is waiting for training</p>`,
      rows => html`
        <tr>
          <th hidden>Quiz ID</th>
          <th>Waiting Since</th>
          <th>Member Number</th>
          <th>Actions</th>
        </tr>
        ${joinHtml(rows)}
      `
    )
  );

const passedUnknownQuizRow = (
  unknownQuiz: ViewModel['equipment']['orphanedPassedQuizes'][0]
) => html`
  <tr class="passed_training_quiz_row">
    <td hidden>${unknownQuiz.id}</td>
    <td>${displayDate(DateTime.fromJSDate(unknownQuiz.timestamp))}</td>
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
    viewModel.equipment.orphanedPassedQuizes,
    RA.map(passedUnknownQuizRow),
    RA.match(
      () => html``,
      rows => html`
        <h3>Waiting for Training - Unknown Member</h3>
        <p>
          Quizes passed by members without matching email and member numbers.
        </p>
        <table>
          <tr>
            <th hidden>Quiz ID</th>
            <th>Timestamp</th>
            <th>Member Number Provided</th>
            <th>Email Provided</th>
          </tr>
          ${joinHtml(rows)}
        </table>
      `
    )
  );

const failedKnownQuizRow = (
  knownQuiz: ViewModel['equipment']['failedQuizAttempts'][0]
) => html`
  <tr class="failed_training_quiz_row">
    <td hidden>${knownQuiz.quizId}</td>
    <td>${displayDate(DateTime.fromJSDate(knownQuiz.timestamp))}</td>
    <td>${renderMemberNumber(knownQuiz.memberNumber)}</td>
    <td>
      ${knownQuiz.score} / ${knownQuiz.maxScore} (${knownQuiz.percentage}%)
    </td>
  </tr>
`;

const failedQuizTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.equipment.failedQuizAttempts,
    RA.map(failedKnownQuizRow),
    RA.match(
      () => html``,
      rows => html`
        <h3>Failed quizes</h3>
        <p>Members who haven't passed (but have attempted) the quiz</p>
        <table>
          <tr>
            <th hidden>Quiz ID</th>
            <th>Timestamp</th>
            <th>Member Number</th>
            <th>Score</th>
          </tr>
          ${joinHtml(rows)}
        </table>
      `
    )
  );

const renderLastRefresh = (
  lastRefresh: ViewModel['equipment']['lastQuizSync']
): Html =>
  O.isSome(lastRefresh)
    ? html`Last refresh: ${displayDate(lastRefresh.value)}`
    : html`Last refresh date unknown`;

const trainingQuizResults = (viewModel: ViewModel) => html`
  <h2>Training Quiz Results</h2>
  ${renderLastRefresh(viewModel.equipment.lastQuizSync)}
  <h3>Waiting for Training</h3>
  ${waitingForTrainingTable(viewModel)}
  ${unknownMemberWaitingForTrainingTable(viewModel)}
  ${failedQuizTrainingTable(viewModel)}
`;

export const render = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    (viewModel: ViewModel) => html`
      <div class="stack">
        <h1>${sanitizeString(viewModel.equipment.name)}</h1>
        ${equipmentActions(viewModel)}
        ${trainersList(viewModel.equipment.trainers)}
        ${currentlyTrainedUsersTable(viewModel)}
        ${isTrainerOrOwner(viewModel) ? trainingQuizResults(viewModel) : html``}
      </div>
    `,
    pageTemplate(sanitizeString(viewModel.equipment.name), viewModel.user)
  );
