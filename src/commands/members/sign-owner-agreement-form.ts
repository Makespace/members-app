import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {User} from '../../types';
import {ownerAgreement} from './owner-agreement';

type ViewModel = {user: User};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Sign the Owner Agreement</h1>
      ${ownerAgreement}
      <form action="#" method="post">
        <input
          type="hidden"
          name="memberNumber"
          value="${viewModel.user.memberNumber}"
        />
        <input
          type="hidden"
          name="signedAt"
          value="${safe(new Date().toISOString())}"
        />
        <button type="submit">Sign Agreement</button>
      </form>
    `,
    toLoggedInContent(safe('Sign Owner Agreement'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  () =>
  ({user}) =>
    E.right({user});

export const signOwnerAgreementForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
