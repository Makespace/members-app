import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {User} from '../../types';
import {Form} from '../../types/form';
import {pipe} from 'fp-ts/lib/function';
import {html} from '../../types/html';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';

type ViewModel = {
  user: User;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    () => html`
      <h1>Create an area</h1>
      <form action="#" method="post">
        <label for="name">What is this area called</label>
        <input type="text" name="name" id="name" />
        <input type="hidden" name="id" value="${v4() as UUID}" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Create Area', viewModel.user)
  );

export const createForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    () =>
    ({user}) =>
      E.right({user}),
};
