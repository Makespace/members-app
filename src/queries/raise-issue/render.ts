import {html} from '../../types/html';

type ViewModel = {
  memberNumber: number;
};

export const render = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>Raise an issue</h1>
    <h2>If your records are wrong</h2>
    <p>
      Send the app team an email:
      <a href="mailto:foo@example.com">foo@example.com</a>
    </p>
    <p>
      Please include your member number (${viewModel.memberNumber}) in the
      email.
    </p>
  </div>
`;
