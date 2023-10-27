import {pipe} from 'fp-ts/lib/function';
import {pageTemplate} from '../../templates';
import {html} from '../../types/html';
import * as O from 'fp-ts/Option';
import {User} from '../../types';

type ViewModel = {
  user: User;
  toBeRevoked: number;
};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <h1>Revoke super user</h1>
      <p>
        Are you sure you would like to revoke this members super-user
        privileges?
      </p>
      <dl>
        <dt>Member number</dt>
        <dd>${viewModel.toBeRevoked}</dd>
      </dl>
      <form action="#" method="post">
        <input
          type="hidden"
          name="memberNumber"
          value="${viewModel.toBeRevoked}"
          Declare
        />
        <input
          type="hidden"
          name="revokedAt"
          value="${new Date().toISOString()}"
        />
        <button type="submit">Confirm and send</button>
      </form>
    `,
    pageTemplate('Revoke super user', O.some(viewModel.user))
  );

export const revokeForm = {
  renderForm: renderForm,
  constructForm: () => (user: User) => ({user, toBeRevoked: 1345}),
};
