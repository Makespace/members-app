import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {User, MemberDetails} from '../../types';
import {Form} from '../../types/form';

import {readModels} from '../../read-models';
import {html} from '../../types/html';
import {memberInput} from '../../templates/member-input';

type ViewModel = {
  user: User;
  members: ReadonlyArray<MemberDetails>;
};

const renderForm = (viewModel: ViewModel) =>
  pageTemplate(
    'Declare super user',
    viewModel.user
  )(html`
    <h1>Declare super user</h1>
    <form action="#" method="post">
      <label for="number">
        Which member number would you like receive super user privileges?
      </label>
      ${memberInput(viewModel.members)}
      <button type="submit">Confirm and send</button>
    </form>
  `);

const constructForm: Form<ViewModel>['constructForm'] =
  () =>
  ({events, user}) =>
    pipe(
      {user},
      E.right,
      E.let('members', () => {
        const memberDetails = readModels.members.getAllDetails(events);
        return [...memberDetails.values()];
      })
    );

export const declareForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
