import {html} from '../../types/html';
import {ViewModel} from './view-model';

export const render = (viewModel: ViewModel) =>
  html`<h1>${viewModel.name}</h1>`;
