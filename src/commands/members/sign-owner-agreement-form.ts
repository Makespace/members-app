import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {Form} from '../../types/form';
import {User} from '../../types';
import Handlebars, {SafeString} from 'handlebars';

type ViewModel = {
  user: User;
  agreementGenerationTimestampIso: string;
};

const SIGN_OWNER_AGREEMENT_FORM_TEMPLATE = Handlebars.compile(`
      <h1>Sign the Owner Agreement</h1>
      {{> owner_agreement}}
      <form action="#" method="post">
        <input
          type="hidden"
          name="memberNumber"
          value="{{user.memberNumber}}"
        />
        <input
          type="hidden"
          name="signedAt"
          value="{{agreementGenerationTimestampIso}}"
        />
        <button type="submit">Sign Agreement</button>
      </form>
    `);

const renderForm = (viewModel: ViewModel) =>
  pageTemplate(
    'Sign Owner Agreement',
    viewModel.user
  )(new SafeString(SIGN_OWNER_AGREEMENT_FORM_TEMPLATE(viewModel)));

const constructForm: Form<ViewModel>['constructForm'] =
  () =>
  ({user}) =>
    E.right({user, agreementGenerationTimestampIso: new Date().toISOString()});

export const signOwnerAgreementForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
