import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import * as O from 'fp-ts/Option';
import {User} from '../../types';
import {v4} from 'uuid';
import {Form} from '../../types/form';
import {SafeString} from 'handlebars';

type ViewModel = {
  user: User;
};

const CREATE_FORM_TEMPLATE = Handlebars.compile(
  `
      <h1>Create an area</h1>
      <form action="#" method="post">
        <label for="name">What is this area called</label>
        <input type="text" name="name" id="name" />
        <input type="hidden" name="id" value="{{areaId}}" />
        <button type="submit">Confirm and send</button>
      </form>
    `
);

const renderForm = (viewModel: ViewModel) =>
  pageTemplate(
    'Create Area',
    O.some(viewModel.user)
  )(
    new SafeString(
      CREATE_FORM_TEMPLATE({
        areaId: v4(),
      })
    )
  );

export const createForm: Form<ViewModel> = {
  renderForm,
  constructForm:
    () =>
    ({user}) =>
      E.right({user}),
};
