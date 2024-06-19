import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
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
          value="${new Date().toISOString()}"
        />
        <button type="submit">Sign Agreement</button>
      </form>
    `,
    pageTemplate('Sign Owner Agreement', O.some(viewModel.user))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  () =>
  ({user}) =>
    E.right({user});

export const signOwnerAgreementForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
