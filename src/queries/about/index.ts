import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as TE from 'fp-ts/TaskEither';
import {Query} from '../query';
import {mailTo} from '../../templates/mailto';
import {EmailAddress} from '../../types';
import {
  html,
  joinHtml,
  safe,
  sanitizeString,
  toLoggedInContent,
} from '../../types/html';
import {changeLogBySubject} from './change-log';
import {DateTime} from 'luxon';

type ViewModel = {
  memberNumber: number;
};

const appOwnersGroupEmailAddress = 'database-owners@makespace.org' as EmailAddress;

const badRecordsMailto = (memberNumber: ViewModel['memberNumber']) =>
  mailTo(
    appOwnersGroupEmailAddress,
    O.some('ISSUE with member records'),
    O.some(`Hi,

My member number is ${memberNumber}.

I have the following issue with my records:

...
`)
  );

const newContributorMailTo = (memberNumber: ViewModel['memberNumber']) =>
  mailTo(
    appOwnersGroupEmailAddress,
    O.some('ISSUE New contributor'),
    O.some(`Hi,

My member number is ${memberNumber}.

I'm interested in contributing to, or have a suggestion about, app.makespace.org:

...
`)
  );

// Grouped by subject so a member can find the part of the app they use,
// rather than reading one long list in date order. The date is kept short
// ("9 Oct") because the year is almost always this one; the full date is on
// hover.
const shortDate = (iso: string) =>
  DateTime.fromISO(iso).setLocale('en-GB').toFormat('d LLL');

const renderChangeLog = () => html`
  <p>
    The newest change is also under the "About this app" button at the top
    of every page.
  </p>
  ${joinHtml(
    changeLogBySubject().map(
      group => html`
        <h3>${sanitizeString(group.heading)}</h3>
        <dl class="change-log">
          ${joinHtml(
            group.entries.map(
              entry => html`
                <dt title="${safe(entry.date)}">${sanitizeString(shortDate(entry.date))}</dt>
                <dd>${sanitizeString(entry.headline)}</dd>
              `
            )
          )}
        </dl>
      `
    )
  )}
`;

const render = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>About this app</h1>
    <p><strong>This app is built by members like you!</strong></p>
    <p>
      Coordination happens on the
      <code>${sanitizeString(appOwnersGroupEmailAddress)}</code> mailing list
      and on Discord. For a Discord invite, email
      ${mailTo(appOwnersGroupEmailAddress, O.some('Discord invite please'), O.none)},
      ask another member, or scan one of the QR-code posters in Makespace.
    </p>

    <h2 id="roadmap">What's coming</h2>
    <p>
      See what we're working on and what's planned on the
      <a href="/roadmap">roadmap</a>.
    </p>

    <h2 id="changelog">What's changed recently</h2>
    ${renderChangeLog()}

    <h2 id="bad-records">If your records are wrong</h2>
    <p>
      Send the app and records team an email:
      ${badRecordsMailto(viewModel.memberNumber)}
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
    </ul>
    <p>
      To contribute, please email
      ${newContributorMailTo(viewModel.memberNumber)}.
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
        ${mailTo('cammakespace@googlegroups.com' as EmailAddress, O.none, O.none)}
      </li>
      <li>
        Membership issues, health and safety concerns, lost fobs etc.:
        ${mailTo('management@makespace.org' as EmailAddress, O.none, O.none)}
      </li>
    </ul>
  </div>
`;

export const about: Query = () => user =>
  pipe(
    {memberNumber: user.memberNumber},
    render,
    toLoggedInContent(safe('About this app')),
    TE.right
  );
