import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {ViewModel} from './view-model';

export const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Create an area</h1>
      <form action="#" method="post">
        <label for="name">What is this area called</label>
        <input type="text" name="name" id="name" />
        <label for="description"
          >Describe this area, add notes and relevant links (optional)</label
        >
        <textarea name="description" id="description" rows="10"></textarea>
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Create Area', O.some(viewModel.user))
  );
