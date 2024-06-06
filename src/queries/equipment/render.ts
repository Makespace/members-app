import {html} from '../../types/html';
import {ViewModel} from './view-model';

export const render = (viewModel: ViewModel) => html`
  <h1>${viewModel.equipment.name}</h1>
  <a href="/equipment/add-training-sheet?equipmentId=${viewModel.equipment.id}"
    >Register training sheet</a
  >
`;
