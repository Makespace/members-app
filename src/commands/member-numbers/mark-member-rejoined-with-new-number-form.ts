import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {html, safe, toLoggedInContent} from '../../types/html';
import {Form} from '../../types/form';

type ViewModel = unknown;

const renderForm = () =>
  pipe(
    html`
      <h1>Mark member rejoined with new number</h1>
      <form action="/members/rejoined" method="post">
        <label for="oldMemberNumber"
          >What was the users old membership number?</label
        >
        <input
          type="number"
          name="oldMemberNumber"
          id="oldMemberNumber"
          required="true"
        />
        <label for="newMemberNumber"
          >What is the users new membership number?
        </label>
        <input
          type="number"
          name="newMemberNumber"
          id="newMemberNumber"
          required="true"
        />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    toLoggedInContent(safe('Mark a member as rejoining makespace'))
  );

const constructForm: Form<ViewModel>['constructForm'] = () => () => E.right({});

export const markMemberRejoinedWithNewNumberForm: Form<ViewModel> = {
  renderForm,
  constructForm,
};
