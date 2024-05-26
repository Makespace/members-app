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
      <h1>Add equipment</h1>
      <form action="#" method="post">
        <label for="name">What is this Equipment called</label>
        <input type="text" name="name" id="name" />
        <input type="hidden" name="id" value="${v4()}" />
        <input type="hidden" name="areaId" value="foo" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Create Equipment', O.some(viewModel.user))
  );

export const addForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    () =>
    ({user}) =>
      E.right({user}),
};
