import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html, safe} from '../../types/html';
import {User} from '../../types';
import {Form} from '../../types/form';
import {memberInput} from '../../templates/member-input';
import {readModels} from '../../read-models';
import {Member} from '../../read-models/members';

type ViewModel = {
  user: User;
  members: ReadonlyArray<Member>;
};

const render = (viewModel: ViewModel) => html`
  <h1>Declare super user</h1>
  <form action="#" method="post">
    <label for="number">
      Which member number would you like receive super user privileges?
    </label>
    ${memberInput(viewModel.members)}
    <button type="submit">Confirm and send</button>
  </form>
`;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    render,
    pageTemplate(safe('Declare super user'), viewModel.user)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  () =>
  ({events, user}) =>
    pipe(
      {user},
      E.right,
      E.let('members', () =>
        [...readModels.members.getAllDetails(events).values()].filter(
          member => !member.isSuperUser
        )
      )
    );

export const declareForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
