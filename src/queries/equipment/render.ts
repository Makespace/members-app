import {pageTemplate} from '../../templates';
import {displayDate} from '../../templates/display-date';
import {renderMemberNumber} from '../../templates/member-number';
import {html, joinHtml, optionalSafe, sanitizeString} from '../../types/html';
import {ViewModel} from './view-model';
import * as O from 'fp-ts/Option';

const trainersList = (trainers: ViewModel['equipment']['trainers']) => html`
  <h2>Trainers</h2>
  <ul>
    ${trainers.length > 0
      ? joinHtml(
          trainers.map(
            memberNumber => html`<li>${renderMemberNumber(memberNumber)}</li>`
          )
        )
      : html`<p>This equipment needs trainers.</p>`}
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
    ${joinHtml(
      viewModel.equipment.trainedMembers.map(
        memberNumber =>
          html`<tr>
            <td>${renderMemberNumber(memberNumber)}</td>
          </tr>`
      )
    )}
  </table>
`;

const waitingForTrainingTable = (viewModel: ViewModel) => html`
  <table>
    ${viewModel.trainingQuizResults.quizPassedNotTrained.knownMember.length > 0
      ? html`
          <tr>
            <th hidden>Quiz ID</th>
            <th>Timestamp</th>
            <th>Member Number</th>
            <th>Score</th>
            <th>Actions</th>
            <th hidden>Other Attempts</th>
          </tr>
          ${joinHtml(
            viewModel.trainingQuizResults.quizPassedNotTrained.knownMember.map(
              quiz => html`
                <tr class="passed_training_quiz_row">
                  <td hidden>${sanitizeString(quiz.id)}</td>
                  <td>${displayDate(quiz.timestamp)}</td>
                  <td>${renderMemberNumber(quiz.memberNumber)}</td>
                  <td>
                    ${quiz.score} / ${quiz.maxScore} (${quiz.percentage}%)
                  </td>
                  <td><button>Mark as trained</button></td>
                  <td hidden>
                    ${joinHtml(
                      quiz.otherAttempts
                        .map(sanitizeString)
                        .map(v => html`${v}`)
                    )}
                  </td>
                </tr>
              `
            )
          )}
        `
      : html`<p>No one is waiting for training</p>`}
  </table>
`;

const unknownMemberWaitingForTrainingTable = (viewModel: ViewModel) => html`
  ${viewModel.trainingQuizResults.quizPassedNotTrained.unknownMember.length > 0
    ? html`
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
          ${joinHtml(
            viewModel.trainingQuizResults.quizPassedNotTrained.unknownMember.map(
              unknownQuiz => html`
                <tr class="passed_training_quiz_row">
                  <td hidden>${sanitizeString(unknownQuiz.id)}</td>
                  <td>${displayDate(unknownQuiz.timestamp)}</td>
                  ${O.isSome(unknownQuiz.memberNumberProvided)
                    ? html`<td>
                        ${renderMemberNumber(
                          unknownQuiz.memberNumberProvided.value
                        )}
                      </td>`
                    : html`<td>
                        ${optionalSafe(unknownQuiz.memberNumberProvided)}
                      </td>`}
                  <td>${optionalSafe(unknownQuiz.emailProvided)}</td>
                  <td>
                    ${unknownQuiz.score} / ${unknownQuiz.maxScore}
                    (${unknownQuiz.percentage}%)
                  </td>
                </tr>
              `
            )
          )}
        </table>
      `
    : html``}
`;

const failedQuizTrainingTable = (viewModel: ViewModel) => html`
  ${viewModel.trainingQuizResults.failedQuizNotTrained.knownMember.length > 0
    ? html`
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
          ${joinHtml(
            viewModel.trainingQuizResults.failedQuizNotTrained.knownMember.map(
              member => html`
                <tr class="failed_training_quiz_row">
                  <td hidden>${sanitizeString(member.id)}</td>
                  <td>${displayDate(member.timestamp)}</td>
                  <td>${renderMemberNumber(member.memberNumber)}</td>
                  <td>
                    ${member.score} / ${member.maxScore} (${member.percentage}%)
                  </td>
                  <td hidden>
                    ${joinHtml(
                      member.otherAttempts
                        .map(sanitizeString)
                        .map(v => html`${v}`)
                    )}
                  </td>
                </tr>
              `
            )
          )}
        </table>
      `
    : html``}
`;

const trainingQuizResults = (viewModel: ViewModel) => html`
  <h2>Training Quiz Results</h2>
  <h3>Waiting for Training</h3>
  ${waitingForTrainingTable(viewModel)}
  ${unknownMemberWaitingForTrainingTable(viewModel)}
  ${failedQuizTrainingTable(viewModel)}
`;

export const render = (viewModel: ViewModel) =>
  pageTemplate(
    viewModel.equipment.name,
    viewModel.user
  )(html`
    <h1>${sanitizeString(viewModel.equipment.name)}</h1>
    ${equipmentActions(viewModel)} ${trainersList(viewModel.equipment.trainers)}
    ${currentlyTrainedUsersTable(viewModel)} ${trainingQuizResults(viewModel)}
  `);
