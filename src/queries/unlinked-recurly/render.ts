import {pipe} from 'fp-ts/lib/function';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel, UnlinkedRecurlyEntry} from './view-model';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';

const tag = (fragment: Html, color: string) =>
  html`<strong class="tag tag--${safe(color)}">${fragment}</strong>`;

const booleanTag = (value: boolean) =>
  value ? tag(html`Yes`, 'green') : tag(html`No`, 'grey');

const renderEntry = (entry: UnlinkedRecurlyEntry) => html`
  <tr>
    <td>${sanitizeString(entry.email)}</td>
    <td>${booleanTag(entry.hasActiveSubscription)}</td>
    <td>${booleanTag(entry.hasFutureSubscription)}</td>
    <td>${booleanTag(entry.hasCanceledSubscription)}</td>
    <td>${booleanTag(entry.hasPausedSubscription)}</td>
    <td>${booleanTag(entry.hasPastDueInvoice)}</td>
    <td>${displayDate(DateTime.fromJSDate(entry.cacheLastUpdated))}</td>
  </tr>
`;

const renderTable = (entries: ReadonlyArray<UnlinkedRecurlyEntry>) =>
  pipe(
    entries,
    RA.map(renderEntry),
    RA.match(
      () => html`<p>No unlinked Recurly emails found.</p>`,
      rows => html`
        <table>
          <thead>
            <tr>
              <th>Email</th>
              <th>Active</th>
              <th>Future</th>
              <th>Canceled</th>
              <th>Paused</th>
              <th>Past Due</th>
              <th>Last Updated</th>
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
  <h1>Unlinked Recurly Emails</h1>
  <p>
    Showing ${safe(String(viewModel.count))} Recurly email(s) not linked to any
    member.
  </p>
  ${renderTable(viewModel.unlinkedEmails)}
`;
