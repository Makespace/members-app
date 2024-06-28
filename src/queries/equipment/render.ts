import {pipe} from 'fp-ts/lib/function';
import {html} from '../../types/html';
import {QuizResultViewModel, ViewModel} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';

const renderTrainers = (trainers: ViewModel['equipment']['trainers']) =>
  pipe(
    trainers,
    RA.map(trainer => html`<li>${trainer}</li>`),
    RA.match(
      () => html`<p>This equipment needs trainers.</p>`,
      items =>
        html`<h2>Trainers</h2>
          <ul>
            ${items.join('\n')}
          </ul>`
    )
  );

const renderEquipmentTrainerActions = (viewModel: ViewModel) => html`
  <li>
    <a
      href="/equipment/mark-member-trained?equipmentId=${viewModel.equipment
        .id}"
      >Mark member as trained</a
    >
  </li>
`;

const renderOwnerEquipmentActions = (viewModel: ViewModel) => html`
  <li>
    <a href="/equipment/add-trainer?equipment=${viewModel.equipment.id}"
      >Add a trainer</a
    >
  </li>
  <li>
    <a
      href="/equipment/add-training-sheet?equipmentId=${viewModel.equipment.id}"
      >Register training sheet</a
    >
  </li>
`;

const renderEquipmentActions = (viewModel: ViewModel) => html`
  <ul>
    ${viewModel.isSuperUserOrOwnerOfArea
      ? renderOwnerEquipmentActions(viewModel)
      : ''}
    ${viewModel.isSuperUserOrTrainerOfArea
      ? renderEquipmentTrainerActions(viewModel)
      : ''}
  </ul>
`;

export const render = (viewModel: ViewModel) => html`
  <h1>${viewModel.equipment.name}</h1>
  ${renderEquipmentActions(viewModel)}
  ${renderTrainers(viewModel.equipment.trainers)}
  ${renderCurrentlyTrainedUsersTable(viewModel)}
  ${renderTrainingQuizResults(viewModel)}
`;

// TODO
// 1. Realistically people only care about training quiz results for people who have passed the quiz and aren't already signed off.
// 2. Dates aren't displayed using the users locale.

const renderTrainingQuizResultsTable = (
  trainingQuizResults: ReadonlyArray<QuizResultViewModel>
) => html`
  <table>
    <tr>
      <th>Timestamp</th>
      <th>Email</th>
      <th>Score</th>
    </tr>

    ${pipe(
      trainingQuizResults,
      RA.map(
        result =>
          html`<tr
            class=${result.passed
              ? 'passed_training_quiz_row'
              : 'failed_training_quiz_row'}
          >
            <td>${result.timestamp.toFormat('yyyy-mm-dd HH:mm') ?? ''}</td>
            <td>${result.email}</td>
            <td>
              ${result.score} / ${result.maxScore} (${result.percentage}%)
            </td>
          </tr>`
      )
    ).join('\n')}
  </table>
`;

const renderTrainingQuizResults = (viewModel: ViewModel) => html`
  <h2>Training Quiz Results</h2>
  <h3>Passed</h3>
  ${renderTrainingQuizResultsTable(viewModel.trainingQuizResults.passed)}
  <h3>All Results</h3>
  ${renderTrainingQuizResultsTable(viewModel.trainingQuizResults.all)}
`;

const renderCurrentlyTrainedUsersTable = (viewModel: ViewModel) => html`
  <h2>Currently Trained Users</h2>
  <table>
    <tr>
      <th>Member Number</th>
    </tr>
    ${pipe(
      viewModel.equipment.trainedMembers,
      RA.map(
        trainedMember =>
          html`<tr>
            <td>${trainedMember}</td>
          </tr>`
      )
    ).join('\n')}
  </table>
`;
