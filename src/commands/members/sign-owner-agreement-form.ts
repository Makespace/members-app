import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {html, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';
import {User} from '../../types';
import {ownerAgreement} from './owner-agreement';

type ViewModel = {user: User};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack prose">
        <h1>The Owners’ Agreement</h1>
        ${ownerAgreement}
        <div class="callout callout--green">
          <p>
            By signing this agreement you're confirming that you understand
            the responsibilities of ownership and want to take an active role
            in your area.
          </p>
          <form action="?next=/me" method="post">
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
            <button type="submit">Sign the Owners’ Agreement</button>
          </form>
        </div>
      </div>
    `,
    toLoggedInContent(safe('Sign Owner Agreement'))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  () =>
  ({user}) =>
    TE.right({user});

export const signOwnerAgreementForm: Form<ViewModel> = {
  renderForm,
  constructForm,
  formIsAuthorized: null,
};
