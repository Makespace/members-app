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
        <label for="oldMembershipNumber"
          >What was the users old membership number?</label
        >
        <input
          type="number"
          name="oldMembershipNumber"
          id="oldMembershipNumber"
          required="true"
        />
        <label for="newMembershipNumber"
          >What is the users new membership number?
        </label>
        <input
          type="number"
          name="newMembershipNumber"
          id="newMembershipNumber"
          required="true"
        />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    toLoggedInContent(safe('Link a member number to an e-mail address'))
  );

const constructForm: Form<ViewModel>['constructForm'] = () => () => E.right({});

export const markMemberRejoinedForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
