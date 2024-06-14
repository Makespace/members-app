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
        html`<ul>
          ${items.join('\n')}
        </ul>`
    )
  );

export const render = (viewModel: ViewModel) => html`
  <h1>${viewModel.equipment.name}</h1>
  <h2>Trainers</h2>
  ${renderTrainers(viewModel.equipment.trainers)}
  <a href="/equipment/add-training-sheet?equipmentId=${viewModel.equipment.id}"
    >Register training sheet</a
  >
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
      <th>Email</th>
      <th></th>
      <th></th>
      <th></th>
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
            <td>${result.timestamp.toISO() ?? ''}</td>
            <td>${result.email}</td>
            <td>
              ${result.score} / ${result.maxScore} (${result.percentage}%)
            </td>
          </tr>`
      )
    ).join('\n')}
  </table>
`;

export const renderTrainingQuizResults = (viewModel: ViewModel) => html`
  <h1>${viewModel.equipment.name} Training Quiz Results</h1>
  <h2>Passed</h2>
  ${renderTrainingQuizResultsTable(viewModel.trainingQuizResults.passed)}
  <h2>All Results</h2>
  ${renderTrainingQuizResultsTable(viewModel.trainingQuizResults.all)}
`;
