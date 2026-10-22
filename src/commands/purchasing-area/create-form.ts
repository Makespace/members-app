import * as TE from 'fp-ts/TaskEither';
import {pipe} from 'fp-ts/lib/function';
import {UUID} from 'io-ts-types';
import {v4} from 'uuid';
import {Form} from '../../types/form';
import {html, safe, toLoggedInContentWithBackLink} from '../../types/html';
import {isAdminOrSuperUser} from '../authentication-helpers/is-admin-or-super-user';

type ViewModel = {id: UUID};

const renderForm = (viewModel: ViewModel) =>
  pipe(
    html`
      <div class="stack-large">
        <h1>Create a purchasing area</h1>
        <p>
          A purchasing area holds a yearly budget for one or more areas - for
          example "Craft &amp; Art" for the Craft Room and the Art Space. Add
          its areas and purchasers once it exists.
        </p>
        <form action="/purchasing-areas/create" method="post">
          <label for="name">What is it called?</label>
          <input type="text" name="name" id="name" required />
          <label for="yearlyBudget">Yearly budget (£)</label>
          <input
            type="text"
            inputmode="decimal"
            name="yearlyBudget"
            id="yearlyBudget"
            placeholder="e.g. 1500.00"
            required
          />
          <input type="hidden" name="id" value="${viewModel.id}" />
          <button type="submit">Create purchasing area</button>
        </form>
      </div>
    `,
    toLoggedInContentWithBackLink(safe('Create purchasing area'), {
      href: '/purchasing-areas',
      label: 'Purchasing areas',
    })
  );

export const createForm: Form<ViewModel> = {
  renderForm,
  constructForm: () => () => TE.right({id: v4() as UUID}),
  formIsAuthorized: isAdminOrSuperUser,
};
