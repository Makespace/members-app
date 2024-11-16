import {html, safe} from '../../types/html';

type ViewModel = {
  memberNumber: number;
};

const infoSystemsGroupEmailAddress = safe('infosystems@makespace.org');

export const render = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>Raise an issue</h1>
    <h2>If your records are wrong</h2>
    <p>
      Send the app and records team an email:
      <a href="mailto:${infoSystemsGroupEmailAddress}"
        >${infoSystemsGroupEmailAddress}</a
      >
    </p>
    <p>
      Please include your member number (${viewModel.memberNumber}) in the
      email.
    </p>
    <p>
      This will reach the members buildings this app as well as part of the
      management team that maintains our records.
    </p>
  </div>
`;
