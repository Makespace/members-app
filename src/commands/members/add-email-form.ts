import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, toLoggedInContent} from '../../types/html';
import {User} from '../../types';
import {Form} from '../../types/form';

type ViewModel = {
  user: User; // The user logged in
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Add email</h1>
      <form action="?next=/member/${viewModel.user.memberNumber}" method="post">
        <label for="email">Email address</label>
        <input type="email" name="email" id="email" />
        <input
          type="hidden"
          name="memberNumber"
          value="${viewModel.user.memberNumber}"
        />
        <button type="submit">Add email</button>
      </form>
    `,
    toLoggedInContent(safe('Add email'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  _input =>
  ({user}) => E.right({
    user
  });

export const addEmailForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
