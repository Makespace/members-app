import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {memberInput} from '../../templates/member-input';
import {Member} from '../../read-models/members';

type ViewModel = {
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
  pipe(viewModel, render, toLoggedInContent(safe('Declare super user')));

const constructForm: Form<ViewModel>['constructForm'] =
  () =>
  ({readModel, user}) =>
    pipe(
      {user},
      E.right,
      E.let('members', () =>
        readModel.members.getAll().filter(member => !member.isSuperUser)
      )
    );

export const declareForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
