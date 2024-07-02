import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import * as O from 'fp-ts/Option';
import {User} from '../../types';
import {Form} from '../../types/form';
import Handlebars, {SafeString} from 'handlebars';

type ViewModel = {
  user: User;
};

const RENDER_DECLARE_SUPER_USER_TEMPLATE = Handlebars.compile(
  `
      <h1>Declare super user</h1>
      <form action="#" method="post">
        <label for="number">
          Which member number would you like receive super user privileges?
        </label>
        <input type="type" name="memberNumber" id="number" />
        <button type="submit">Confirm and send</button>
      </form>
    `
);

const render = (viewModel: ViewModel) =>
  pageTemplate(
    'Declare super user',
    O.some(viewModel.user)
  )(new SafeString(RENDER_DECLARE_SUPER_USER_TEMPLATE(viewModel)));

export const declareForm: Form<ViewModel> = {
  renderForm: render,
  constructForm:
    () =>
    ({user}) =>
      E.right({user}),
};
