import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {User} from '../../types';
import {Form} from '../../types/form';

type ViewModel = {
  user: User;
};

const render = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Declare super user</h1>
      <form action="#" method="post">
        <label for="number">
          Which member number would you like receive super user privileges?
        </label>
        <input type="type" name="memberNumber" id="number" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Declare super user', O.some(viewModel.user))
  );

export const declareForm: Form<ViewModel> = {
  renderForm: render,
  constructForm:
    () =>
    ({user}) =>
      E.right({user}),
};
