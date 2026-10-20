import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {html, joinHtml, safe, sanitizeString} from '../../types/html';
import {DateTime} from 'luxon';
import {ViewModel, BoardTicketView} from './view-model';
import {Focus} from './focus';
import {
  renderAssignees,
  statusBadge,
} from '../../templates/trouble-ticket-card';
import {categoryDot} from '../../templates/equipment-category';
import {displayDate, displayDateShort} from '../../templates/display-date';
import {STATUS_SLUG, StatusFilter, statusFilterSlug} from './status-slug';
import {TroubleTicketStatus} from '../../types/trouble-ticket';

// Default sort order for the flat list - active work first, done last.
const STATUS_ORDER: ReadonlyArray<TroubleTicketStatus> = [
  'Todo',
  'In Progress',
  'Needs Help',
  'Parked',
  'Resolved',
];

// The "show only" scope filters - relationship of a ticket to the viewing
// member. The counting and filtering happen server-side.
const SCOPES: ReadonlyArray<{key: string; label: string}> = [
  {key: 'mine', label: 'Assigned to me'},
  {key: 'my-area', label: 'My area'},
  {key: 'my-machines', label: 'My machines'},
];

// A board URL with one filter changed and the rest kept. Changing a filter
// returns to page one: page 7 of a different set is meaningless.
const boardUrl = (
  viewModel: ViewModel,
  change: {
    status?: string | null;
    only?: string | null;
    page?: number;
    focus?: Focus | null;
  }
) => {
  const params = new URLSearchParams();
  const focus =
    change.focus !== undefined ? change.focus : O.toNullable(viewModel.focus);
  // A focus replaces the your-areas/everything distinction: it is already a
  // narrower question than either.
  if (focus !== null) {
    params.set(
      focus.kind === 'equipment' ? 'equipmentId' : 'areaId',
      focus.slug
    );
  } else if (!viewModel.scopedToMine) {
    params.set('show', 'all');
  }
  const status =
    change.status !== undefined
      ? change.status
      : pipe(viewModel.activeStatus, O.map(statusFilterSlug), O.toNullable);
  const only =
    change.only !== undefined
      ? change.only
      : O.toNullable(viewModel.activeScope);
  if (status !== null) {
    params.set('status', status);
  }
  if (only !== null) {
    params.set('only', only);
  }
  if (change.page !== undefined && change.page > 1) {
    params.set('page', String(change.page));
  }
  const query = params.toString();
  return `/trouble-tickets/board${query === '' ? '' : `?${query}`}`;
};

const activeClass = (active: boolean) =>
  active ? safe(' tt-filter__label--active') : safe('');

// Status chips, each showing what it would find across every page. Clicking
// one filters server-side, so the count and the result agree. "Open" comes
// first: everything still needing work is the question most people ask.
const renderStatusFilters = (viewModel: ViewModel) => {
  const chip = (filter: StatusFilter, badgeClass: string, count: number) => {
    const active = pipe(
      viewModel.activeStatus,
      O.match(
        () => false,
        current => current === filter
      )
    );
    return html`<a
      class="${safe(badgeClass)} tt-filter__label${activeClass(active)}"
      href="${safe(
        boardUrl(viewModel, {
          status: active ? null : statusFilterSlug(filter),
        })
      )}"
      >${safe(filter)}
      <span class="tt-badge__count">${safe(count.toString())}</span></a
    >`;
  };
  return html`
    <fieldset class="tt-filters">
      <legend class="tt-filters__legend">Filter by status</legend>
      ${chip('Open', 'tt-chip', viewModel.openCount)}
      ${joinHtml(
        STATUS_ORDER.map(status =>
          chip(
            status,
            `tt-badge tt-badge--${STATUS_SLUG[status]}`,
            viewModel.statusCounts[status]
          )
        )
      )}
    </fieldset>
  `;
};

// "Show only" chips, counted and filtered the same way.
const renderScopeFilters = (viewModel: ViewModel) => html`
  <fieldset class="tt-filters">
    <legend class="tt-filters__legend">Show only</legend>
    ${joinHtml(
      SCOPES.map(scope => {
        const active = pipe(
          viewModel.activeScope,
          O.match(
            () => false,
            current => current === scope.key
          )
        );
        return html`<a
          class="tt-chip tt-filter__label${activeClass(active)}"
          href="${safe(boardUrl(viewModel, {only: active ? null : scope.key}))}"
          >${safe(scope.label)}
          <span class="tt-badge__count"
            >${safe((viewModel.scopeCounts[scope.key] ?? 0).toString())}</span
          ></a
        >`;
      })
    )}
  </fieldset>
`;

const renderUnresolvedNames = (vm: ViewModel) => {
  // The unmatched names are a fact about the whole backlog. Someone looking
  // at one machine did not ask about them.
  if (
    O.isSome(vm.focus) ||
    !vm.canMapEquipment ||
    vm.unresolvedEquipmentNames.length === 0
  ) {
    return html``;
  }
  return html`
    <details class="tt-changelog">
      <summary>
        Unresolved equipment names
        (${safe(vm.unresolvedEquipmentNames.length.toString())})
      </summary>
      <p>
        These form answers don't match any equipment name or alias, so their
        tickets sit in Unassigned. Map a name to link its tickets - now and for
        future submissions.
      </p>
      <ul>
        ${joinHtml(
          vm.unresolvedEquipmentNames.map(
            entry => html`
              <li>
                <a
                  href="/equipment/add-name-alias?alias=${safe(
                    encodeURIComponent(entry.raw)
                  )}"
                  >${sanitizeString(entry.raw)}</a
                >
                (${safe(entry.count.toString())}
                ticket${entry.count === 1 ? '' : safe('s')})
              </li>
            `
          )
        )}
      </ul>
    </details>
  `;
};

// The scope banner and page navigation. Plain links, no JS: scope and page
// round-trip as query params.
// What the board is showing, and the ways out of it. With a machine or an
// area in focus that is the first thing to say, along with how to widen.
const renderFocus = (vm: ViewModel) =>
  pipe(
    vm.focus,
    O.match(
      () => html``,
      focus => html`
        <p class="tt-focus">
          Showing <strong>${vm.totalInScope}</strong>
          ticket${vm.totalInScope === 1 ? '' : safe('s')} for
          <strong>${sanitizeString(focus.name)}</strong>${pipe(
            focus.areaName,
            O.match(
              () => html``,
              areaName => html` in ${sanitizeString(areaName)}`
            )
          )}
          ·
          ${pipe(
            focus.areaSlug,
            O.match(
              () => html``,
              areaSlug =>
                html`<a href="/trouble-tickets/board?areaId=${safe(areaSlug)}"
                    >all in
                    ${sanitizeString(O.getOrElse(() => '')(focus.areaName))}</a
                  >
                  · `
            )
          )}
          <a href="${safe(boardUrl(vm, {focus: null}))}">all tickets</a>
        </p>
      `
    )
  );

const renderScopeAndPages = (vm: ViewModel) => {
  if (O.isSome(vm.focus)) {
    return html`
      ${renderFocus(vm)}
      ${vm.pageCount > 1 ? html`<p>${renderPager(vm)}</p>` : html``}
    `;
  }
  return html`
    <p>
      ${
        vm.scopedToMine
          ? html`Showing <strong>${vm.totalInScope}</strong> ticket${
                vm.totalInScope === 1 ? '' : safe('s')
              }
              in <strong>your areas</strong> ·
              <a href="/trouble-tickets/board?show=all">show all areas</a>`
          : html`Showing <strong>all ${vm.totalInScope}</strong> ticket${
                vm.totalInScope === 1 ? '' : safe('s')
              }
              · <a href="/trouble-tickets/board">show just your areas</a>`
      }
      ${vm.pageCount > 1 ? html`· ${renderPager(vm)}` : html``}
    </p>
  `;
};

const renderPageLink = (vm: ViewModel, page: number, label: string) =>
  html`<a href="${safe(boardUrl(vm, {page}))}">${safe(label)}</a>`;

const renderPager = (vm: ViewModel) =>
  html`page ${vm.page} of ${vm.pageCount}
  ${
    vm.page > 1
      ? html`· ${renderPageLink(vm, vm.page - 1, '← previous')}`
      : html``
  }
  ${
    vm.page < vm.pageCount
      ? html`· ${renderPageLink(vm, vm.page + 1, 'next →')}`
      : html``
  }`;

// Where the ticket is: the machine, with its area beneath; or just the area;
// or, when the form's answer matched nothing, what the form said.
const renderWhere = (ticket: BoardTicketView) =>
  pipe(
    ticket.equipmentName,
    O.match(
      () =>
        pipe(
          ticket.areaName,
          O.match(
            () =>
              html`<em>Unassigned</em>${
                  ticket.rawEquipment
                    ? html`<small class="tt-table__sub"
                        >form said:
                        ${sanitizeString(ticket.rawEquipment)}</small
                      >`
                    : html``
                }`,
            areaName => html`${sanitizeString(areaName)}`
          )
        ),
      name =>
        html`${pipe(
          ticket.equipmentCategory,
          O.match(
            () => html``,
            category => categoryDot(category)
          )
        )}${sanitizeString(name)}${pipe(
          ticket.areaName,
          O.match(
            () => html``,
            areaName =>
              html`<small class="tt-table__sub"
                >${sanitizeString(areaName)}</small
              >`
          )
        )}`
    )
  );

const submitterName = (ticket: BoardTicketView) =>
  ticket.submittedName ?? ticket.submittedEmail;

// One line per ticket, so a whole page of them can be taken in at a glance.
// The ticket's own page has the rest: the form's answers, the change log
// and the actions.
const renderRow = (ticket: BoardTicketView) => {
  const submitter = submitterName(ticket);
  return html`
    <tr class="tt-row tt-row--${safe(STATUS_SLUG[ticket.status])}">
      <td data-label="Status">${statusBadge(ticket.status)}</td>
      <td data-label="Ticket" class="tt-table__ticket">
        <a href="/trouble-tickets/view/${safe(encodeURIComponent(ticket.id))}"
          >${
            ticket.title.trim() === ''
              ? html`<em>Untitled ticket</em>`
              : sanitizeString(ticket.title)
          }</a
        >${
          ticket.response.issue.trim() === ''
            ? html``
            : html`<small class="tt-table__sub tt-table__issue"
                >${sanitizeString(ticket.response.issue)}</small
              >`
        }
      </td>
      <td data-label="Where">${renderWhere(ticket)}</td>
      <td data-label="Submitted">
        <span title="${displayDate(DateTime.fromJSDate(ticket.submittedAt))}"
          >${displayDateShort(DateTime.fromJSDate(ticket.submittedAt))}</span
        >${
          submitter === null
            ? html``
            : html`<small class="tt-table__sub"
                >${sanitizeString(submitter)}</small
              >`
        }
      </td>
      <td data-label="Assigned">${renderAssignees(ticket.assignees)}</td>
    </tr>
  `;
};

const renderTable = (tickets: ReadonlyArray<BoardTicketView>) => html`
  <div class="tt-table-wrap">
    <table class="tt-table">
      <thead>
        <tr>
          <th scope="col">Status</th>
          <th scope="col">Ticket</th>
          <th scope="col">Where</th>
          <th scope="col">Submitted</th>
          <th scope="col">Assigned</th>
        </tr>
      </thead>
      <tbody>
        ${joinHtml(tickets.map(renderRow))}
      </tbody>
    </table>
  </div>
`;

const renderTitle = (vm: ViewModel) =>
  pipe(
    vm.focus,
    O.match(
      () => html`Trouble tickets`,
      focus => html`Trouble tickets: ${sanitizeString(focus.name)}`
    )
  );

export const render = (viewModel: ViewModel) => {
  if (viewModel.tickets.length === 0) {
    return html`
      <div class="stack">
        <h1>${renderTitle(viewModel)}</h1>
        ${renderScopeAndPages(viewModel)} ${renderStatusFilters(viewModel)}
        ${renderUnresolvedNames(viewModel)}
        <p>No trouble tickets in this view.</p>
      </div>
    `;
  }
  return html`
    <div class="stack tt-wrapper">
      <h1>${renderTitle(viewModel)}</h1>
      ${renderScopeAndPages(viewModel)} ${renderStatusFilters(viewModel)}
      ${renderScopeFilters(viewModel)} ${renderUnresolvedNames(viewModel)}
      ${renderTable(viewModel.tickets)}
      ${
        viewModel.pageCount > 1
          ? html`<p>${renderPager(viewModel)}</p>`
          : html``
      }
    </div>
  `;
};
