import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {displayDate} from '../../templates/display-date';
import {renderMemberNumber} from '../../templates/member-number';
import {
  blankIfEmpty,
  displayIfEmpty,
  html,
  joinHtml,
  optionalSafe,
  sanitizeString,
} from '../../types/html';
import {
  QuizResultUnknownMemberViewModel,
  QuizResultViewModel,
  ViewModel,
} from './view-model';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';

const trainersList = (trainers: ViewModel['equipment']['trainers']) => html`
  <h2>Trainers</h2>
  <ul>
    ${pipe(
      trainers,
      displayIfEmpty(html`<p>This equipment needs trainers.</p>`)(arr =>
        pipe(
          arr,
          RA.map(
            memberNumber => html`<li>${renderMemberNumber(memberNumber)}</li>`
          ),
          joinHtml
        )
      )
    )}
  </ul>
`;

const trainerEquipmentActions = (equipment: ViewModel['equipment']) => html`
  <li>
    <a
      href="/equipment/mark-member-trained?equipmentId=${sanitizeString(
        equipment.id
      )}"
      >Mark member as trained</a
    >
  </li>
`;

const ownerEquipmentActions = (equipment: ViewModel['equipment']) => html`
  <li>
    <a href="/equipment/add-trainer?equipment=${sanitizeString(equipment.id)}">
      Add a trainer
    </a>
  </li>
  <li>
    <a
      href="/equipment/add-training-sheet?equipmentId=${sanitizeString(
        equipment.id
      )}"
    >
      Register training sheet
    </a>
  </li>
`;

const equipmentActions = (viewModel: ViewModel) => html`
  <ul>
    ${viewModel.isSuperUserOrOwnerOfArea
      ? ownerEquipmentActions(viewModel.equipment)
      : html``}
    ${viewModel.isSuperUserOrTrainerOfArea
      ? trainerEquipmentActions(viewModel.equipment)
      : html``}
  </ul>
`;

const currentlyTrainedUsersTable = (viewModel: ViewModel) => html`
  <h2>Currently Trained Users</h2>
  <table>
    <tr>
      <th>Member Number</th>
    </tr>
    ${pipe(
      viewModel.equipment.trainedMembers,
      RA.map(
        memberNumber =>
          html`<tr>
            <td>${renderMemberNumber(memberNumber)}</td>
          </tr>`
      ),
      joinHtml
    )}
  </table>
`;

const waitingForTrainingRow = (quiz: QuizResultViewModel) => html`
  <tr class="passed_training_quiz_row">
    <td hidden>${sanitizeString(quiz.id)}</td>
    <td>${displayDate(quiz.timestamp)}</td>
    <td>${renderMemberNumber(quiz.memberNumber)}</td>
    <td>${quiz.score} / ${quiz.maxScore} (${quiz.percentage}%)</td>
    <td><button>Mark as trained</button></td>
    <td hidden>
      ${joinHtml(quiz.otherAttempts.map(sanitizeString).map(v => html`${v}`))}
    </td>
  </tr>
`;

const waitingForTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.trainingQuizResults.quizPassedNotTrained.knownMember,
    displayIfEmpty(html`<p>No one is waiting for training</p>`)(
      passedQuizes => html`
        <tr>
          <th hidden>Quiz ID</th>
          <th>Timestamp</th>
          <th>Member Number</th>
          <th>Score</th>
          <th>Actions</th>
          <th hidden>Other Attempts</th>
        </tr>
        ${pipe(passedQuizes, RA.map(waitingForTrainingRow), joinHtml)}
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
      : html`<td>${optionalSafe(unknownQuiz.memberNumberProvided)}</td>`}
    <td>${optionalSafe(unknownQuiz.emailProvided)}</td>
    <td>
      ${unknownQuiz.score} / ${unknownQuiz.maxScore}
      (${unknownQuiz.percentage}%)
    </td>
  </tr>
`;

const unknownMemberWaitingForTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.trainingQuizResults.quizPassedNotTrained.unknownMember,
    blankIfEmpty(
      unknownQuizes => html`
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
          ${pipe(unknownQuizes, RA.map(passedUnknownQuizRow), joinHtml)}
        </table>
      `
    )
  );

const failedKnownQuizRow = (knownQuiz: QuizResultViewModel) => html`
  <tr class="failed_training_quiz_row">
    <td hidden>${sanitizeString(knownQuiz.id)}</td>
    <td>${displayDate(knownQuiz.timestamp)}</td>
    <td>${renderMemberNumber(knownQuiz.memberNumber)}</td>
    <td>
      ${knownQuiz.score} / ${knownQuiz.maxScore} (${knownQuiz.percentage}%)
    </td>
    <td hidden>
      ${joinHtml(
        knownQuiz.otherAttempts.map(sanitizeString).map(v => html`${v}`)
      )}
    </td>
  </tr>
`;

const failedQuizTrainingTable = (viewModel: ViewModel) =>
  pipe(
    viewModel.trainingQuizResults.failedQuizNotTrained.knownMember,
    blankIfEmpty(
      pipe(
        knownQuizes => html`
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
            ${pipe(knownQuizes, RA.map(failedKnownQuizRow), joinHtml)}
          </table>
        `
      )
    )
  );

const trainingQuizResults = (viewModel: ViewModel) => html`
  <h2>Training Quiz Results</h2>
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
      ${currentlyTrainedUsersTable(viewModel)} ${trainingQuizResults(viewModel)}
    `,
    pageTemplate(viewModel.equipment.name, viewModel.user)
  );
