import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {displayDate} from '../../templates/display-date';
import {renderMemberNumber} from '../../templates/member-number';
import {
  commaHtml,
  Html,
  html,
  joinHtml,
  sanitizeOption,
  sanitizeString,
} from '../../types/html';
import {
  QuizResultUnknownMemberViewModel,
  QuizResultViewModel,
  ViewModel,
} from './view-model';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';

const trainersList = (trainers: ViewModel['equipment']['trainers']) =>
  pipe(
    trainers,
    RA.map(memberNumber => html`<li>${renderMemberNumber(memberNumber)}</li>`),
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

// Hidden by default behind a visibility toggle.
const renderOtherAttempts = commaHtml;

const waitingForTrainingRow = (quiz: QuizResultViewModel) =>
  pipe(
    quiz.otherAttempts,
    renderOtherAttempts,
    otherAttempts => html`
      <tr class="passed_training_quiz_row">
        <td hidden>${quiz.id}</td>
        <td>${displayDate(quiz.timestamp)}</td>
        <td>${renderMemberNumber(quiz.memberNumber)}</td>
        <td>${quiz.score} / ${quiz.maxScore} (${quiz.percentage}%)</td>
        <td><button>Mark as trained</button></td>
        <td hidden>${otherAttempts}</td>
      </tr>
    `
  );

const waitingForTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.trainingQuizResults.quizPassedNotTrained.knownMember,
    RA.map(waitingForTrainingRow),
    RA.match(
      () => html`<p>No one is waiting for training</p>`,
      rows => html`
        <tr>
          <th hidden>Quiz ID</th>
          <th>Timestamp</th>
          <th>Member Number</th>
          <th>Score</th>
          <th>Actions</th>
          <th hidden>Other Attempts</th>
        </tr>
        ${joinHtml(rows)}
      `
    )
  );

const passedUnknownQuizRow = (
  unknownQuiz: QuizResultUnknownMemberViewModel
) => html`
  <tr class="passed_training_quiz_row">
    <td hidden>${sanitizeString(unknownQuiz.id)}</td>
    <td>${displayDate(unknownQuiz.timestamp)}</td>
    ${O.isSome(unknownQuiz.memberNumberProvided)
      ? html`<td>
          ${renderMemberNumber(unknownQuiz.memberNumberProvided.value)}
        </td>`
      : html`<td>${sanitizeOption(unknownQuiz.memberNumberProvided)}</td>`}
    <td>${sanitizeOption(unknownQuiz.emailProvided)}</td>
    <td>
      ${unknownQuiz.score} / ${unknownQuiz.maxScore}
      (${unknownQuiz.percentage}%)
    </td>
  </tr>
`;

const unknownMemberWaitingForTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.trainingQuizResults.quizPassedNotTrained.unknownMember,
    RA.map(passedUnknownQuizRow),
    RA.match(
      () => html``,
      rows => html`
        <h3>Waiting for Training - Unknown Member</h3>
        <p>
          Quizes completed by members without matching email and member numbers.
        </p>
        <table>
          <tr>
            <th hidden>Quiz ID</th>
            <th>Timestamp</th>
            <th>Member Number Provided</th>
            <th>Email Provided</th>
            <th>Score</th>
          </tr>
          ${joinHtml(rows)}
        </table>
      `
    )
  );

const failedKnownQuizRow = (knownQuiz: QuizResultViewModel) =>
  pipe(
    knownQuiz.otherAttempts,
    renderOtherAttempts,
    otherAttempts => html`
      <tr class="failed_training_quiz_row">
        <td hidden>${knownQuiz.id}</td>
        <td>${displayDate(knownQuiz.timestamp)}</td>
        <td>${renderMemberNumber(knownQuiz.memberNumber)}</td>
        <td>
          ${knownQuiz.score} / ${knownQuiz.maxScore} (${knownQuiz.percentage}%)
        </td>
        <td hidden>${otherAttempts}</td>
      </tr>
    `
  );

const failedQuizTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.trainingQuizResults.failedQuizNotTrained.knownMember,
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
            <th hidden>Other Attempts</th>
          </tr>
          ${joinHtml(rows)}
        </table>
      `
    )
  );

const renderLastRefresh = (
  lastRefresh: ViewModel['trainingQuizResults']['lastRefresh']
): Html =>
  O.isSome(lastRefresh)
    ? html`Last refresh: ${displayDate(lastRefresh.value)}`
    : html`Last refresh date unknown`;

const trainingQuizResults = (viewModel: ViewModel) => html`
  <h2>Training Quiz Results</h2>
  ${renderLastRefresh(viewModel.trainingQuizResults.lastRefresh)}
  <h3>Waiting for Training</h3>
  ${waitingForTrainingTable(viewModel)}
  ${unknownMemberWaitingForTrainingTable(viewModel)}
  ${failedQuizTrainingTable(viewModel)}
`;

export const render = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    (viewModel: ViewModel) => html`
      <h1>${sanitizeString(viewModel.equipment.name)}</h1>
      ${equipmentActions(viewModel)}
      ${trainersList(viewModel.equipment.trainers)}
      ${currentlyTrainedUsersTable(viewModel)}
      ${isTrainerOrOwner(viewModel) ? trainingQuizResults(viewModel) : html``}
    `,
    pageTemplate(sanitizeString(viewModel.equipment.name), viewModel.user)
  );
