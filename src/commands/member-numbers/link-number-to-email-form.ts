import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import {User} from '../../types';
import {Form} from '../../types/form';

type ViewModel = {
  user: User;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Link a member number to an e-mail address</h1>
      <form action="/members/create" method="post">
        <label for="email"
          >Which e-mail does the member want to use to identify
          themselves?</label
        >
        <input type="text" name="email" id="email" />
        <label for="memberNumber">Which member number should they get? </label>
        <input type="text" name="memberNumber" id="memberNumber" />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Link a member number to an e-mail address', viewModel.user)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  () =>
  ({user}) =>
    E.right({user});

export const linkNumberToEmailForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
