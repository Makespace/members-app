import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import {categoryDot} from '../../templates/equipment-category';
import {
  commaHtml,
  html,
  Html,
  joinHtml,
  safe,
  sanitizeString,
} from '../../types/html';
import {
  ViewModel,
  TroubleTicketView,
  AssigneeView,
  ChangeLogEntry,
} from './view-model';
import {Focus} from './focus';
import {DateTime} from 'luxon';
import {displayDate} from '../../templates/display-date';
import {TroubleTicketStatus} from '../../types/trouble-ticket';

// Default sort order for the flat list - active work first, done last.
const STATUS_ORDER: ReadonlyArray<TroubleTicketStatus> = [
  'Todo',
  'In Progress',
  'Needs Help',
  'Parked',
  'Resolved',
];

// Slug used for the per-status modifier class (accent colour, badge colour) and the status
// filter data attribute.
const STATUS_SLUG: Record<TroubleTicketStatus, string> = {
  Todo: 'todo',
  'In Progress': 'in-progress',
  'Needs Help': 'needs-help',
  Parked: 'parked',
  Resolved: 'resolved',
};

// The "show only" scope filters - relationship of a ticket to the viewing member.
const SCOPES: ReadonlyArray<{
  key: string;
  label: string;
  test: (ticket: TroubleTicketView) => boolean;
}> = [
  {key: 'mine', label: 'Assigned to me', test: t => t.assignedToMe},
  {key: 'my-area', label: 'My area', test: t => t.inMyOwnerArea},
  {key: 'my-machines', label: 'My machines', test: t => t.onMyTrainerMachine},
];

// Space-separated scope tokens a card belongs to (read by the filter script).
const cardScopes = (ticket: TroubleTicketView): string =>
  SCOPES.filter(scope => scope.test(ticket))
    .map(scope => scope.key)
    .join(' ');

const renderSubmitter = (ticket: TroubleTicketView) => {
  if (ticket.submittedName) {
    return sanitizeString(ticket.submittedName);
  }
  if (ticket.submittedEmail) {
    return sanitizeString(ticket.submittedEmail);
  }
  if (ticket.submittedMemberNumber !== null) {
    return safe(`Member ${ticket.submittedMemberNumber}`);
  }
  return safe('Not provided');
};

const renderEquipment = (ticket: TroubleTicketView) =>
  pipe(
    ticket.equipmentName,
    O.match(
      () =>
        pipe(
          ticket.areaName,
          O.match(
            () =>
              ticket.rawEquipment
                ? html`Unassigned
                    <small
                      >(form said:
                      ${sanitizeString(ticket.rawEquipment)})</small
                    >`
                : html`Unassigned`,
            areaName => html`${sanitizeString(areaName)} <small>(area)</small>`
          )
        ),
      name =>
        html`${pipe(
            ticket.equipmentCategory,
            O.match(
              () => html``,
              category => categoryDot(category)
            )
          )}${sanitizeString(name)}`
    )
  );

const renderAssignee = (assignee: AssigneeView) =>
  pipe(
    assignee.name,
    O.match(
      () => html`${safe(`Member ${assignee.memberNumber}`)}`,
      name => html`${sanitizeString(name)}`
    )
  );

const renderAssignees = (assignees: ReadonlyArray<AssigneeView>) =>
  assignees.length === 0
    ? html`<em>Nobody assigned</em>`
    : commaHtml(assignees.map(renderAssignee));

const statusBadge = (status: TroubleTicketStatus) =>
  html`<span class="tt-badge tt-badge--${safe(STATUS_SLUG[status])}"
    >${safe(status)}</span
  >`;

// Actions available from the card, depending on the ticket's current status. Each links to
// a confirmation page (GET) that POSTs the corresponding command.
const renderActions = (ticket: TroubleTicketView): Html => {
  // Each action is a badge coloured by the status it moves the ticket to.
  const action = (verb: string, label: string, targetSlug: string) =>
    html`<a
      class="tt-badge tt-badge--${safe(targetSlug)} tt-action"
      href="/trouble-tickets/${safe(verb)}?ticketId=${safe(ticket.id)}&next=/trouble-tickets/board"
      >${safe(label)}</a
    >`;
  // Clearing the backlog of tickets that were dealt with long ago outside the
  // app is a bulk job, so it skips the confirmation page: one click resolves
  // the ticket without writing a summary or emailing anybody.
  const resolveSilently = html`
    <form
      class="tt-quiet-resolve"
      action="/trouble-tickets/resolve?next=/trouble-tickets/board"
      method="post"
    >
      <input type="hidden" name="ticketId" value="${safe(ticket.id)}" />
      <input type="hidden" name="summary" value="" />
      <input type="hidden" name="quiet" value="on" />
      <button
        class="tt-badge tt-badge--${safe(STATUS_SLUG.Resolved)} tt-action"
        type="submit"
      >
        Resolve silently
      </button>
      <small
        >without emailing the submitter — for tickets already resolved outside
        the app</small
      >
    </form>
  `;
  const inProgress = STATUS_SLUG['In Progress'];
  switch (ticket.status) {
    // Resolve is offered from every open status, not just In Progress, so a
    // ticket that was actually dealt with long ago can be closed (quietly,
    // via the form's checkbox) without first sending an 'in progress' email.
    case 'Todo':
      return html`<div class="tt-actions">
        ${action('assign', 'Mark In Progress', inProgress)}
        ${action('resolve', 'Resolve', STATUS_SLUG.Resolved)} ${resolveSilently}
      </div>`;
    case 'In Progress':
      return html`<div class="tt-actions">
        ${action('resolve', 'Resolve', STATUS_SLUG.Resolved)}
        ${action('needs-help', 'Needs Help', STATUS_SLUG['Needs Help'])}
        ${action('park', 'Park', STATUS_SLUG.Parked)}
        ${ticket.assignedToMe
          ? html``
          : action('assign', 'Assign to me', inProgress)}
        ${resolveSilently}
      </div>`;
    case 'Needs Help':
    case 'Parked':
      return html`<div class="tt-actions">
        ${action('assign', 'Mark In Progress', inProgress)}
        ${action('resolve', 'Resolve', STATUS_SLUG.Resolved)} ${resolveSilently}
      </div>`;
    case 'Resolved':
      return html``;
  }
};

const renderChangeLog = (entries: ReadonlyArray<ChangeLogEntry>) => {
  if (entries.length === 0) {
    return html``;
  }
  return html`
    <details class="tt-changelog">
      <summary>Change log (${safe(entries.length.toString())})</summary>
      <ol class="tt-changelog__list">
        ${joinHtml(
          entries.map(
            entry => html`
              <li
                class="tt-log-entry tt-log-entry--${safe(
                  STATUS_SLUG[entry.status]
                )}"
              >
                <div>
                  <strong>${sanitizeString(entry.actor)}</strong>
                  ${sanitizeString(entry.summary)}
                  <small>${displayDate(DateTime.fromJSDate(entry.at))}</small>
                </div>
                ${entry.details.length === 0
                  ? html``
                  : html`<ul class="tt-changelog__details">
                      ${joinHtml(
                        entry.details.map(
                          detail => html`<li>
                            <strong>${sanitizeString(detail.label)}:</strong>
                            ${sanitizeString(detail.value)}
                          </li>`
                        )
                      )}
                    </ul>`}
              </li>
            `
          )
        )}
      </ol>
    </details>
  `;
};

const renderCard = (ticket: TroubleTicketView) => html`
  <article
    class="trouble-ticket-card trouble-ticket-card--${safe(
      STATUS_SLUG[ticket.status]
    )} stack"
    data-status="${safe(STATUS_SLUG[ticket.status])}"
    data-scopes="${safe(cardScopes(ticket))}"
  >
    <div class="tt-card__header">
      ${statusBadge(ticket.status)}
      <h3>${sanitizeString(ticket.title)}</h3>
    </div>
    <p>
      <strong>Equipment:</strong> ${renderEquipment(ticket)}<br />
      <strong>Submitted by:</strong> ${renderSubmitter(ticket)} on
      ${displayDate(DateTime.fromJSDate(ticket.submittedAt))}<br />
      <strong>Assigned:</strong> ${renderAssignees(ticket.assignees)}
    </p>
    <dl>
      <dt><strong>Machine status</strong></dt>
      <dd>${sanitizeString(ticket.response.status)}</dd>
      <dt><strong>Attempting</strong></dt>
      <dd>${sanitizeString(ticket.response.attempting)}</dd>
      <dt><strong>Issue</strong></dt>
      <dd>${sanitizeString(ticket.response.issue)}</dd>
      <dt><strong>Steps taken</strong></dt>
      <dd>${sanitizeString(ticket.response.steps)}</dd>
    </dl>
    ${renderChangeLog(ticket.changeLog)}
    ${ticket.canChangeStatus ? renderActions(ticket) : html``}
  </article>
`;

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
      : O.toNullable(viewModel.activeStatus);
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
// one filters server-side, so the count and the result agree.
const renderStatusFilters = (viewModel: ViewModel) => html`
  <fieldset class="tt-filters">
    <legend class="tt-filters__legend">Filter by status</legend>
    ${joinHtml(
      STATUS_ORDER.map(status => {
        const slug = safe(STATUS_SLUG[status]);
        const active = pipe(
          viewModel.activeStatus,
          O.match(
            () => false,
            current => current === status
          )
        );
        return html`<a
          class="tt-badge tt-badge--${slug} tt-filter__label${activeClass(
            active
          )}"
          href="${safe(
            boardUrl(viewModel, {status: active ? null : STATUS_SLUG[status]})
          )}"
          >${safe(status)}
          <span class="tt-badge__count"
            >${safe(viewModel.statusCounts[status].toString())}</span
          ></a
        >`;
      })
    )}
  </fieldset>
`;

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
        Unresolved equipment names (${safe(
          vm.unresolvedEquipmentNames.length.toString()
        )})
      </summary>
      <p>
        These form answers don't match any equipment name or alias, so their
        tickets sit in Unassigned. Map a name to link its tickets - now and
        for future submissions.
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
              areaSlug => html`<a
                  href="/trouble-tickets/board?areaId=${safe(areaSlug)}"
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
      ${vm.pageCount > 1
        ? html`<p>
            page ${vm.page} of ${vm.pageCount}
            ${vm.page > 1
              ? html`· ${renderPageLink(vm, vm.page - 1, '← previous')}`
              : html``}
            ${vm.page < vm.pageCount
              ? html`· ${renderPageLink(vm, vm.page + 1, 'next →')}`
              : html``}
          </p>`
        : html``}
    `;
  }
  return html`
    <p>
      ${vm.scopedToMine
        ? html`Showing <strong>${vm.totalInScope}</strong> ticket${vm.totalInScope ===
            1
              ? ''
              : safe('s')}
            in <strong>your areas</strong> ·
            <a href="/trouble-tickets/board?show=all">show all areas</a>`
        : html`Showing <strong>all ${vm.totalInScope}</strong> ticket${vm.totalInScope ===
            1
              ? ''
              : safe('s')}
            · <a href="/trouble-tickets/board">show just your areas</a>`}
      ${vm.pageCount > 1
        ? html`· page ${vm.page} of ${vm.pageCount}
            ${vm.page > 1
              ? html`· ${renderPageLink(vm, vm.page - 1, '← previous')}`
              : html``}
            ${vm.page < vm.pageCount
              ? html`· ${renderPageLink(vm, vm.page + 1, 'next →')}`
              : html``}`
        : html``}
    </p>
  `;
};

const renderPageLink = (vm: ViewModel, page: number, label: string) =>
  html`<a href="${safe(boardUrl(vm, {page}))}">${safe(label)}</a>`;

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
        ${renderScopeAndPages(viewModel)}
        ${renderStatusFilters(viewModel)}
        ${renderUnresolvedNames(viewModel)}
        <p>No trouble tickets in this view.</p>
      </div>
    `;
  }
  const sorted = viewModel.tickets;
  return html`
    <div class="stack tt-wrapper">
      <h1>${renderTitle(viewModel)}</h1>
      ${renderScopeAndPages(viewModel)}
      ${renderStatusFilters(viewModel)} ${renderScopeFilters(viewModel)}
      ${renderUnresolvedNames(viewModel)}
      <div class="tt-board stack">${joinHtml(sorted.map(renderCard))}</div>
    </div>
    
  `;
};
