import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {DateTime} from 'luxon';
import {Html, html, joinHtml, safe, sanitizeString} from '../../types/html';
import {displayDateShort} from '../../templates/display-date';
import {renderInvoiceIssues, renderMoney} from '../../templates/billing';
import {renderMemberNumber} from '../../templates/member-number';
import {BillingConcern} from '../../read-models/external-state/billing-overview';
import {OverdueBand, ViewModel} from './view-model';

const bandHeading = (band: OverdueBand, t: ViewModel['thresholds']): Html => {
  switch (band) {
    case 'cancel':
      return html`Owing for ${sanitizeString(String(t.cancelAfterDays))} days or
      more`;
    case 'remove-access':
      return html`Owing for
      ${sanitizeString(String(t.removeAccessAfterDays))} to
      ${sanitizeString(String(t.cancelAfterDays - 1))} days`;
    case 'watch':
      return html`Owing for less than
      ${sanitizeString(String(t.removeAccessAfterDays))} days`;
  }
};

const member = (concern: BillingConcern): Html => html`
  <a href="/member/${safe(String(concern.memberNumber))}"
    >${pipe(
      concern.name,
      O.match(
        () => renderMemberNumber(concern.memberNumber),
        name => html`${sanitizeString(name)}`
      )
    )}</a
  >
  ${O.isSome(concern.name)
    ? html`(${renderMemberNumber(concern.memberNumber)})`
    : html``}
`;

const owingRow = (concern: BillingConcern): Html => html`
  <tr>
    <td>${member(concern)}</td>
    <td>
      ${pipe(
        concern.daysOverdue,
        O.match(
          () => html`-`,
          days => html`${sanitizeString(String(days))}`
        )
      )}
    </td>
    <td>${renderMoney(O.some(concern.totalOutstanding), concern.currency)}</td>
    <td>${renderInvoiceIssues(concern.issues)}</td>
  </tr>
`;

const owingTable = (concerns: ReadonlyArray<BillingConcern>): Html => html`
  <table>
    <tr>
      <th>Member</th>
      <th>Days</th>
      <th>Owed</th>
      <th>Why</th>
    </tr>
    ${joinHtml(concerns.map(owingRow))}
  </table>
`;

const section = (
  heading: Html,
  blurb: Html,
  concerns: ReadonlyArray<BillingConcern>
): Html =>
  concerns.length === 0
    ? html``
    : html`
        <section>
          <h2>${heading} (${sanitizeString(String(concerns.length))})</h2>
          <p>${blurb}</p>
          ${owingTable(concerns)}
        </section>
      `;

// A lapsed member owes nothing - that is the whole point - so the columns
// about what is owed would say "£0.00" and imply they are square with us.
const lapsedSection = (concerns: ReadonlyArray<BillingConcern>): Html =>
  concerns.length === 0
    ? html``
    : html`
        <section>
          <h2>
            No live subscription
            (${sanitizeString(String(concerns.length))})
          </h2>
          <p>
            No active, future or paused subscription, and invoiced within the
            last six months. They owe nothing because nothing is being raised -
            which is why they appear nowhere else.
          </p>
          <table>
            <tr>
              <th>Member</th>
              <th>Last invoiced</th>
            </tr>
            ${joinHtml(
              concerns.map(
                concern => html`
                  <tr>
                    <td>${member(concern)}</td>
                    <td>
                      ${pipe(
                        concern.lastInvoiceAt,
                        O.match(
                          () => html`-`,
                          at =>
                            html`${displayDateShort(DateTime.fromJSDate(at))}`
                        )
                      )}
                    </td>
                  </tr>
                `
              )
            )}
          </table>
        </section>
      `;

const nothingToDo = html`
  <p>Nobody is behind on their membership payments.</p>
`;

export const render = (viewModel: ViewModel): Html => {
  if (viewModel.isStale) {
    return html`
      <div class="stack">
        <h1>Outstanding invoices</h1>
        <p class="tag tag--yellow">
          The copy of Recurly this page reads is more than three days old${pipe(
            viewModel.cachedAt,
            O.match(
              () => html``,
              at => html` (last refreshed
              ${displayDateShort(DateTime.fromJSDate(at))})`
            )
          )}, so it is not shown. Nobody should be chased on the strength of it.
        </p>
      </div>
    `;
  }

  const anything =
    viewModel.bands.some(band => band.concerns.length > 0) ||
    viewModel.pausedOwing.length > 0 ||
    viewModel.lapsed.length > 0 ||
    viewModel.unlinked.length > 0;

  return html`
    <div class="stack">
      <h1>Outstanding invoices</h1>
      <p>
        Members whose payments may need somebody to do something. The day counts
        are how long the oldest unpaid invoice has been due, not how long since
        the last failed attempt - a card that retries and fails again would
        otherwise keep resetting the clock.
      </p>
      ${anything ? html`` : nothingToDo}
      ${joinHtml(
        viewModel.bands.map(({band, concerns}) =>
          section(
            bandHeading(band, viewModel.thresholds),
            band === 'cancel'
              ? html`Long enough that cancelling the membership is on the
                table.`
              : band === 'remove-access'
                ? html`Long enough to consider removing fob access.`
                : html`Recently overdue - usually a card that needs
                  replacing.`,
            concerns
          )
        )
      )}
      ${section(
        html`Paused, but still owing`,
        html`A pause stops future billing; it does not clear what was already
        owed. These would otherwise read as "leave alone".`,
        viewModel.pausedOwing
      )}
      ${lapsedSection(viewModel.lapsed)}
      ${viewModel.unlinked.length === 0
        ? html``
        : html`
            <section>
              <h2>
                Owing, but not matched to a member
                (${sanitizeString(String(viewModel.unlinked.length))})
              </h2>
              <p>
                Recurly accounts with money outstanding whose address matches no
                member here. Nobody is looking at these.
                <a href="/unlinked-recurly">Unlinked Recurly emails</a>
              </p>
              <table>
                <tr>
                  <th>Email</th>
                  <th>Days</th>
                  <th>Owed</th>
                </tr>
                ${joinHtml(
                  viewModel.unlinked.map(
                    row => html`
                      <tr>
                        <td>${sanitizeString(row.email)}</td>
                        <td>
                          ${pipe(
                            row.daysOverdue,
                            O.match(
                              () => html`-`,
                              days => html`${sanitizeString(String(days))}`
                            )
                          )}
                        </td>
                        <td>
                          ${renderMoney(O.some(row.totalOutstanding), O.none)}
                        </td>
                      </tr>
                    `
                  )
                )}
              </table>
            </section>
          `}
    </div>
  `;
};
