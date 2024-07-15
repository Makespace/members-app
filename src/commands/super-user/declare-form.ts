import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {User, MemberDetails} from '../../types';
import {Form} from '../../types/form';
import Handlebars, {SafeString} from 'handlebars';
import {readModels} from '../../read-models';

type ViewModel = {
  user: User;
  members: ReadonlyArray<MemberDetails>;
};

const RENDER_DECLARE_SUPER_USER_TEMPLATE = Handlebars.compile(
  `
      <h1>Declare super user</h1>
      <form action="#" method="post">
        <label for="number">
          Which member number would you like receive super user privileges?
        </label>
        {{> memberInput members }}
        <button type="submit">Confirm and send</button>
      </form>
    `
);

const renderForm = (viewModel: ViewModel) =>
  pageTemplate(
    'Declare super user',
    viewModel.user
  )(new SafeString(RENDER_DECLARE_SUPER_USER_TEMPLATE(viewModel)));

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
