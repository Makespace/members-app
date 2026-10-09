import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {html, Html, joinHtml, safe, sanitizeOption, sanitizeString} from '../../types/html';
import {renderMemberNumber} from '../../templates/member-number';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel, UnlinkedRecurlyEntry} from './view-model';
import {displayDateShort} from '../../templates/display-date';
import {tag} from '../../templates/member-status';
import {DateTime} from 'luxon';

// One tag per thing true of the account, so a row reads as a sentence
// rather than a grid of yes/no.
const statusTags = (entry: UnlinkedRecurlyEntry): Html => {
  const tags = [
    entry.hasActiveSubscription ? tag(html`active`, 'green') : null,
    entry.hasFutureSubscription ? tag(html`starts later`, 'green') : null,
    entry.hasPastDueInvoice ? tag(html`past due`, 'red') : null,
    entry.hasPausedSubscription ? tag(html`paused`, 'grey') : null,
    entry.hasCanceledSubscription ? tag(html`cancelled`, 'grey') : null,
    entry.isFresh ? null : tag(html`no longer synced`, 'grey'),
  ].filter((t): t is Html => t !== null);
  return joinHtml(
    (tags.length === 0 ? [tag(html`never subscribed`, 'grey')] : tags).map(
      t => html`${t} `
    )
  );
};

// The account codes are only worth showing when they differ from the billing
// email - that difference is usually why the row is here.
const accountCodesCell = (entry: UnlinkedRecurlyEntry): Html =>
  joinHtml(entry.otherCodes.map(code => html`<div>${sanitizeString(code)}</div>`));

// A member-number box per row, pre-filled when exactly one member's name
// matches Recurly's, leading to the confirm page rather than linking here.
const linkCell = (entry: UnlinkedRecurlyEntry): Html => html`
  <form action="/members/link-recurly-email" method="get" class="row-form">
    <input type="hidden" name="email" value="${sanitizeString(entry.email)}" />
    <input
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      size="6"
      name="member"
      aria-label="Member number"
      required
      min="1"
      value="${pipe(
        entry.suggestedMember,
        O.map(member => safe(String(member.memberNumber))),
        O.getOrElse(() => safe(''))
      )}"
    />
    <button type="submit">Link…</button>
    ${pipe(
      entry.suggestedMember,
      O.match(
        () => html``,
        member => html`<small>suggested: ${renderMemberNumber(member.memberNumber)} ${sanitizeOption(member.name)}</small>`
      )
    )}
  </form>
`;

const renderEntry = (withLink: boolean) => (entry: UnlinkedRecurlyEntry) => html`
  <tr>
    <td>${sanitizeString(entry.email)}</td>
    <td>${accountCodesCell(entry)}</td>
    <td>${sanitizeOption(entry.recurlyName)}</td>
    <td>${statusTags(entry)}</td>
    <td>${displayDateShort(DateTime.fromJSDate(entry.cacheLastUpdated))}</td>
    ${withLink ? html`<td>${linkCell(entry)}</td>` : html``}
  </tr>
`;

const renderTable = (
  entries: ReadonlyArray<UnlinkedRecurlyEntry>,
  withLink: boolean
) =>
  pipe(
    entries,
    RA.map(renderEntry(withLink)),
    RA.match(
      () => html`<p><i>None.</i></p>`,
      rows => html`
        <table>
          <thead>
            <tr>
              <th>Billing email</th>
              <th>Account code (signup email)</th>
              <th>Name in Recurly</th>
              <th>Status</th>
              <th>Last synced</th>
              ${withLink ? html`<th>Link to member</th>` : html``}
            </tr>
          </thead>
          <tbody>
            ${joinHtml(rows)}
          </tbody>
        </table>
      `
    )
  );

export const render = (viewModel: ViewModel) => html`
  <h1>Recurly accounts not linked to a member</h1>
  <p>
    An account is linked when its billing email or its account code is one of
    a member's email addresses. Until it is, that member shows as inactive
    everywhere in the app, whatever they pay.
  </p>
  <h2>Paying, but linked to nobody (${viewModel.needingAction.length})</h2>
  <p>
    Active, starting soon, or with an invoice past due. Type the member
    number and press Link: the next page shows both names before anything
    is recorded. Where one member's name matches the account's, the number
    is filled in for you to check.
  </p>
  ${renderTable(viewModel.needingAction, true)}
  <details>
    <summary>Not paying (${viewModel.theRest.length})</summary>
    <p>
      Lapsed, cancelled, paused, never subscribed, or no longer synced from
      Recurly. Nothing to do for these unless the person comes back.
    </p>
    ${renderTable(viewModel.theRest, false)}
  </details>
`;
