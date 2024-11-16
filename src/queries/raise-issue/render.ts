import {html, safe} from '../../types/html';

type ViewModel = {
  memberNumber: number;
};

const infoSystemsGroupEmailAddress = safe('infosystems@makespace.org');
const mailSubject = encodeURIComponent('ISSUE with member records');
const body = (memberNumber: ViewModel['memberNumber']) =>
  encodeURIComponent(`Hi,

My member number is ${memberNumber}.

I have the following issue with my records:

...
`);
const mailtoLink = (memberNumber: ViewModel['memberNumber']) =>
  safe(
    `mailto:${infoSystemsGroupEmailAddress}?subject=${mailSubject}&body=${body(memberNumber)}`
  );

export const render = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>Raise an issue</h1>
    <h2>If your records are wrong</h2>
    <p>
      Send the app and records team an email:
      <a href="${mailtoLink(viewModel.memberNumber)}"
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
