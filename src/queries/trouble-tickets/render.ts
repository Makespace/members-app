import {pipe} from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
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

const statusRank = (status: TroubleTicketStatus) => STATUS_ORDER.indexOf(status);

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
        ticket.rawEquipment
          ? html`Unassigned
              <small>(form said: ${sanitizeString(ticket.rawEquipment)})</small>`
          : html`Unassigned`,
      name => html`${sanitizeString(name)}`
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
      href="/trouble-tickets/${safe(verb)}?ticketId=${safe(ticket.id)}"
      >${safe(label)}</a
    >`;
  const inProgress = STATUS_SLUG['In Progress'];
  switch (ticket.status) {
    case 'Todo':
      return html`<div class="tt-actions">
        ${action('assign', 'Mark In Progress', inProgress)}
      </div>`;
    case 'In Progress':
      return html`<div class="tt-actions">
        ${action('resolve', 'Resolve', STATUS_SLUG.Resolved)}
        ${action('needs-help', 'Needs Help', STATUS_SLUG['Needs Help'])}
        ${action('park', 'Park', STATUS_SLUG.Parked)}
        ${ticket.assignedToMe
          ? html``
          : action('assign', 'Assign to me', inProgress)}
      </div>`;
    case 'Needs Help':
    case 'Parked':
      return html`<div class="tt-actions">
        ${action('assign', 'Mark In Progress', inProgress)}
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

// Status filter chips, each with its ticket count. Read by the filter script via
// data-status.
const renderStatusFilters = (counts: Record<TroubleTicketStatus, number>) => html`
  <fieldset class="tt-filters">
    <legend class="tt-filters__legend">Filter by status</legend>
    ${joinHtml(
      STATUS_ORDER.map(status => {
        const slug = safe(STATUS_SLUG[status]);
        return html`<input
            type="checkbox"
            class="tt-filter"
            id="tt-filter-${slug}"
            data-status="${slug}"
          /><label class="tt-badge tt-badge--${slug} tt-filter__label" for="tt-filter-${slug}"
            >${safe(status)}
            <span class="tt-badge__count">${safe(counts[status].toString())}</span></label
          >`;
      })
    )}
  </fieldset>
`;

// "Show only" scope chips (assigned to me / my area / my machines), read via data-scope.
const renderScopeFilters = (counts: Record<string, number>) => html`
  <fieldset class="tt-filters">
    <legend class="tt-filters__legend">Show only</legend>
    ${joinHtml(
      SCOPES.map(scope => {
        const key = safe(scope.key);
        return html`<input
            type="checkbox"
            class="tt-filter"
            id="tt-scope-${key}"
            data-scope="${key}"
          /><label class="tt-chip tt-filter__label" for="tt-scope-${key}"
            >${safe(scope.label)}
            <span class="tt-badge__count">${safe(
              (counts[scope.key] ?? 0).toString()
            )}</span></label
          >`;
      })
    )}
  </fieldset>
`;

// Client-side filtering. A card is shown when it matches at least one checked status (or no
// status is checked) AND at least one checked scope (or no scope is checked) - so the two
// filter rows narrow together, while chips within a row combine as a union.
const filterScript = html`
  <script>
    (function () {
      var wrapper = document.querySelector('.tt-wrapper');
      if (!wrapper) return;
      var filters = [].slice.call(wrapper.querySelectorAll('.tt-filter'));
      var cards = [].slice.call(wrapper.querySelectorAll('.trouble-ticket-card'));
      function checkedVals(key) {
        return filters
          .filter(function (f) {
            return f.checked && f.dataset[key] != null;
          })
          .map(function (f) {
            return f.dataset[key];
          });
      }
      function apply() {
        var statuses = checkedVals('status');
        var scopes = checkedVals('scope');
        cards.forEach(function (card) {
          var statusOk =
            statuses.length === 0 ||
            statuses.indexOf(card.dataset.status) !== -1;
          var cardScopes = (card.dataset.scopes || '')
            .split(' ')
            .filter(Boolean);
          var scopeOk =
            scopes.length === 0 ||
            scopes.some(function (s) {
              return cardScopes.indexOf(s) !== -1;
            });
          card.style.display = statusOk && scopeOk ? '' : 'none';
        });
      }
      filters.forEach(function (f) {
        f.addEventListener('change', apply);
      });
      apply();
    })();
  </script>
`;

export const render = (viewModel: ViewModel) => {
  if (viewModel.tickets.length === 0) {
    return html`
      <div class="stack">
        <h1>Trouble tickets</h1>
        <p>No trouble tickets yet.</p>
      </div>
    `;
  }
  const sorted = [...viewModel.tickets].sort(
    (a, b) =>
      statusRank(a.status) - statusRank(b.status) ||
      b.submittedAt.getTime() - a.submittedAt.getTime()
  );
  const statusCounts = STATUS_ORDER.reduce(
    (acc, status) => {
      acc[status] = viewModel.tickets.filter(
        ticket => ticket.status === status
      ).length;
      return acc;
    },
    {} as Record<TroubleTicketStatus, number>
  );
  const scopeCounts = SCOPES.reduce(
    (acc, scope) => {
      acc[scope.key] = viewModel.tickets.filter(scope.test).length;
      return acc;
    },
    {} as Record<string, number>
  );
  return html`
    <div class="stack tt-wrapper">
      <h1>Trouble tickets</h1>
      ${renderStatusFilters(statusCounts)} ${renderScopeFilters(scopeCounts)}
      <div class="tt-board stack">${joinHtml(sorted.map(renderCard))}</div>
    </div>
    ${filterScript}
  `;
};
