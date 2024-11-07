import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';

type ViewModel = unknown;

const renderForm = () =>
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
    toLoggedInContent(safe('Link a member number to an e-mail address'))
  );

const constructForm: Form<ViewModel>['constructForm'] = () => () => E.right({});

export const linkNumberToEmailForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
