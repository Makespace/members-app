import {pipe} from 'fp-ts/lib/function';
import {html} from '../../types/html';
import {ViewModel} from './view-model';
import {render as renderTrainingQuizResults} from './training-quiz/render';
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
