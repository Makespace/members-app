import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';

type ViewModel = unknown;

const renderForm = () =>
  pipe(
    html`
      <h1>Mark member rejoined</h1>
      <form action="/members/rejoined" method="post">
        <label for="memberNumber">What was the users membership number?</label>
        <input
          type="number"
          name="memberNumber"
          id="memberNumber"
          required="true"
        />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    toLoggedInContent(safe('Mark a member as rejoining makespace'))
  );

const constructForm: Form<ViewModel>['constructForm'] = () => () => E.right({});

export const markMemberRejoinedWithExistingNumberForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
