import {pipe} from 'fp-ts/lib/function';
import {html} from '../../types/html';
import {ViewModel} from './view-model';

export const render = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    (_viewModel: ViewModel) => html`
      <div class="stack">
        <h1>Trouble tickets</h1>
      </div>
    `
  );
