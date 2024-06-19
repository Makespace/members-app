/* eslint-disable unused-imports/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {Form} from '../../types/form';
import {User} from '../../types';

type ViewModel = {user: User};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Sign the Owner Agreement</h1>
      <form action="#" method="post">
        <button type="submit">Confirm</button>
      </form>
    `,
    pageTemplate('Sign Owner Agreement', O.some(viewModel.user))
  );

const constructForm: Form<ViewModel>['constructForm'] =
  input =>
  ({user}) =>
    E.right({user});

export const signOwnerAgreementForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
