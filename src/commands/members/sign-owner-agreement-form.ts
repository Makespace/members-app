import * as E from 'fp-ts/Either';
import {Form} from '../../types/form';
import {User} from '../../types';
import {pageTemplateHandlebarlessBody} from '../../templates/page-template';
import {pipe} from 'fp-ts/lib/function';
import {html, safe} from '../../types/html';
import {ownerAgreement} from './owner-agreement';

type ViewModel = {
  user: User;
  agreementGenerationTimestampIso: string;
};

const renderBody = (viewModel: ViewModel) => html`
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
      value="${safe(viewModel.agreementGenerationTimestampIso)}"
    />
    <button type="submit">Sign Agreement</button>
  </form>
`;

const renderForm = (viewModel: ViewModel) =>
  pipe(
    viewModel,
    renderBody,
    pageTemplateHandlebarlessBody('Sign Owner Agreement', viewModel.user)
  );

const constructForm: Form<ViewModel>['constructForm'] =
  () =>
  ({user}) =>
    E.right({user, agreementGenerationTimestampIso: new Date().toISOString()});

export const signOwnerAgreementForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
