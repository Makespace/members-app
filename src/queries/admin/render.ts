import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {OwnedArea, TrainedMachine, ViewModel} from './construct-view-model';

// Grouped by what somebody came here to do, rather than by when the link
// happened to be added. The list had grown past the point where a flat column
// of eighteen could be read.
const section = (heading: Html, links: ReadonlyArray<Html>) => html`
  <section>
    <h2>${heading}</h2>
    <nav>
      <ul class="stack">
        ${joinHtml(links.map(link => html`<li>${link}</li>`))}
      </ul>
    </nav>
  </section>
`;

// A number worth knowing before deciding what to do first, as the machine
// page's cards show them.
const stat = (count: number, one: string, many: string) => html`
  <li class="owner-stat${count === 0 ? safe(' owner-stat--none') : safe('')}">
    <span class="owner-stat__count">${safe(String(count))}</span>
    <span>${safe(count === 1 ? one : many)}</span>
  </li>
`;

const actions = (
  links: ReadonlyArray<{href: string; label: string}>,
  kind: 'area' | 'machine'
) => html`
  <ul class="owner-actions owner-actions--${safe(kind)}">
    ${joinHtml(
      links.map(
        link =>
          html`<li>
            <a href="${safe(link.href)}">${sanitizeString(link.label)}</a>
          </li>`
      )
    )}
  </ul>
`;

const trainedMachine = (machine: TrainedMachine) => html`
  <article class="owner-machine">
    <span class="owner-role owner-role--trainer">Trainer</span>
    <h3 class="owner-machine__name">${sanitizeString(machine.name)}</h3>
    <p class="owner-caption">You're a trainer on this equipment.</p>
    <ul class="owner-stats">
      ${stat(machine.openTickets, 'open ticket', 'open tickets')}
      ${stat(machine.upcomingTrainings, 'upcoming training', 'upcoming trainings')}
    </ul>
    ${actions(
      [
        {
          href: `/trouble-tickets/board?equipmentId=${machine.id}`,
          label: 'View trouble tickets',
        },
        {href: `/equipment/${machine.id}/trainings`, label: 'Arrange training'},
        {href: `/equipment/${machine.id}`, label: 'Manage equipment'},
      ],
      'machine'
    )}
  </article>
`;

const ownedArea = (area: OwnedArea) => html`
  <section class="owner-area">
    <header class="owner-area__header">
      <div>
        <span class="owner-role owner-role--owner">Owner</span>
        <h2 class="owner-area__name">${sanitizeString(area.name)}</h2>
        <p class="owner-caption">You're an owner in this area.</p>
      </div>
      <ul class="owner-stats">
        ${stat(area.openTickets, 'open ticket', 'open tickets')}
      </ul>
    </header>
    ${actions(
      [
        {
          href: `/trouble-tickets/board?areaId=${area.id}`,
          label: 'View trouble tickets',
        },
        ...pipe(
          area.purchasingAreaId,
          O.match(
            () => [],
            id => [{href: `/purchasing-areas/${id}`, label: 'View purchasing'}]
          )
        ),
        {href: `/areas/manage?area=${area.id}`, label: 'Manage area'},
      ],
      'area'
    )}
    ${area.trainerOn.length === 0
      ? html``
      : html`
          <p class="owner-area__subheading">Machines you train on</p>
          <div class="owner-machines">
            ${joinHtml(area.trainerOn.map(trainedMachine))}
          </div>
        `}
  </section>
`;

// What an owner looks after, area by area, with the machines in each that
// they also train on: the things they come here to do, one click away.
const ownerPart = (viewModel: ViewModel) => html`
  <div class="stack-large">
    <h1>Owner</h1>
    ${joinHtml(viewModel.ownedAreas.map(ownedArea))}
  </div>
`;

const adminPart = () => html`
  <div class="stack-large">
    <h1>Admin</h1>
    <p>You have super-user privileges.</p>

    ${section(html`Members`, [
      html`<a href="/members">View all members</a>`,
      html`<a href="/members/create">Link an email and number</a>`,
      html`<a href="/members/rejoined-with-existing">Mark a user as rejoined</a>`,
      html`<a href="/members/rejoined-with-new"
        >Mark member rejoined with new number</a
      >`,
      html`<a href="/super-users">Manage super-users</a>`,
      html`<a href="/members/import-fobs">Import fobs from Paxton</a>`,
      html`<a href="/access-audit">Door access audit</a>`,
    ])}

    ${section(html`Membership payments`, [
      html`<a href="/outstanding-invoices">Invoices that may need chasing</a> -
      who is behind, by how long, and why`,
      html`<a href="/unlinked-recurly"
        >View Recurly emails not linked to members</a
      >`,
    ])}

    ${section(html`Equipment and areas`, [
      html`<a href="/areas">Manage areas and owners</a>`,
      html`<a href="/purchasing-areas">Purchasing areas and budgets</a> - which
      areas share a budget, who can request purchases, and what has been
      requested`,
      html`<a href="/equipment-links">Equipment guides and risk assessments</a>
      - which machines are missing one, and set it from there`,
      html`<a href="/equipment-signs">Print equipment signs</a> - name, colour
      and a QR code for reporting problems`,
      html`<a href="/e-ink">E-ink displays</a> - which machine's trouble
      tickets each one shows`,
      html`<a href="/training-status.csv"
        >Download current owners and trainers</a
      >`,
    ])}

    ${section(html`Trouble tickets and member email`, [
      html`<a href="/trouble-tickets">View all trouble tickets (prototype)</a>`,
      html`<a href="/mailbox">Management mailbox (imported)</a>`,
      html`<a href="/notifications">Manage notification banners</a>`,
    ])}

    ${section(html`The event log`, [
      html`<a href="/event-log">View a log of all actions taken</a>`,
      html`<a href="/event-log/failed">View events that failed to apply</a>`,
      html`<a href="/event-log/deleted">View deleted events</a>`,
      html`<a href="/event-log-order"
        >Visualise event log ordering (blocks &amp; seams)</a
      >`,
      html`<a href="/event-log.csv">Download a log of all actions taken</a>`,
    ])}
  </div>
`;

// Owners see what they look after; super-users see the admin links, below
// their own areas when they are owners too.
export const render = (viewModel: ViewModel) => html`
  <div class="stack-large">
    ${viewModel.ownedAreas.length > 0 ? ownerPart(viewModel) : html``}
    ${viewModel.isSuperUser ? adminPart() : html``}
  </div>
`;
