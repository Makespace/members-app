import {html, safe} from '../../types/html';

type ViewModel = {
  memberNumber: number;
};

const infoSystemsGroupEmailAddress = safe('infosystems@makespace.org');

const mailtoLink = (emailAddress: string, subject: string, body: string) =>
  safe(
    `mailto:${emailAddress}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  );

const badRecordsMailtoLink = (memberNumber: ViewModel['memberNumber']) =>
  mailtoLink(
    infoSystemsGroupEmailAddress,
    'ISSUE with member records',
    `Hi,

My member number is ${memberNumber}.

I have the following issue with my records:

...
`
  );

const newContributorMailToLink = (memberNumber: ViewModel['memberNumber']) =>
  mailtoLink(
    infoSystemsGroupEmailAddress,
    'ISSUE New contributor',
    `Hi,

My member number is ${memberNumber}.

I'm interested in contributing to, or have a suggestion about, app.makespace.org:

...
`
  );

export const render = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>Raise an issue</h1>
    <p>If you encounter an issue choose from the options below.</p>

    <h2 id="bad-records">If your records are wrong</h2>
    <p>
      Send the app and records team an email:
      <a href="${badRecordsMailtoLink(viewModel.memberNumber)}"
        >${infoSystemsGroupEmailAddress}</a
      >
    </p>
    <p>
      Please include your member number (${viewModel.memberNumber}) in the
      email.
    </p>
    <p>
      This will reach the members building this app as well as part of the
      management team that maintains our records.
    </p>

    <h2 id="new-contributor">To change this website</h2>
    <p>
      This application is built by members like you. We welcome contributions.
    </p>
    <ul>
      <li>
        The code lives at
        <a href="https://github.com/makespace/members-app"
          >github.com/makespace/members-app</a
        >
      </li>
      <li>
        The application is hosted on
        <a href="https://fly.io/dashboard/makespace-cambridge-ltd">fly.io</a>
        (your fly.io account must be added to the organization to view)
      </li>
      <li>
        Coordination happens on the
        <code>${infoSystemsGroupEmailAddress}</code> mailing list and the
        WhatsApp group chat.
      </li>
    </ul>
    <p>
      To contribute, please email
      <a href="${newContributorMailToLink(viewModel.memberNumber)}"
        >${infoSystemsGroupEmailAddress}</a
      >.
    </p>

    <h2 id="contact">Contact</h2>
    <ul>
      <li>
        How to use equipment, ideas for the space, project help etc.:
        <a href="https://groups.google.com/g/cammakespace"
          >Makespace google group</a
        >.
        <br />
        You can also start a thread by emailing:
        <a href="mailto:cammakespace@googlegroups.com"
          >cammakespace@googlegroups.com</a
        >
      </li>
      <li>
        Membership issues, health and safety concerns, lost fobs etc.:
        <a href="management@makespace.org">management@makespace.org</a>
      </li>
    </ul>
  </div>
`;
