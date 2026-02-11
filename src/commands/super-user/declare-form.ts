import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, Safe, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {memberSelector} from '../../templates/member-selector';
import {Member} from '../../read-models/members';

type ViewModel = {
  members: ReadonlyArray<Member>;
};

const render = (viewModel: ViewModel) => html`
  <h1>Declare super user</h1>
  <form action="#" method="post">
    <label for="memberNumber-search">
      Which member would you like to receive super user privileges?
    </label>
    ${memberSelector('memberNumber' as Safe, null, viewModel.members)}
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
