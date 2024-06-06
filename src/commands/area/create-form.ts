import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {User} from '../../types';
import {v4} from 'uuid';
import {Form} from '../../types/form';

type ViewModel = {
  user: User;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Create an area</h1>
      <form action="#" method="post">
        <label for="name">What is this area called</label>
        <input type="text" name="name" id="name" />
        <input type="hidden" name="id" value="${v4()}" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Create Area', O.some(viewModel.user))
  );

export const createForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    () =>
    ({user}) =>
      E.right({user}),
};
