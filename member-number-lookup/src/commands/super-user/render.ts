import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {ViewModel} from './view-model';

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Declare super user</h1>
      <form action="#" method="post">
        <label for="number">
          Which member number would you like receive super user privileges?
        </label>
        <input type="text" name="number" id="number" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Declare super user', O.some(viewModel.user))
  );
