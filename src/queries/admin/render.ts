import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {OwnedArea, TrainedMachine, ViewModel} from './construct-view-model';
import {renderTrainingSparkline} from '../../templates/training-sparkline';
import {howLong} from '../shared-render/how-long';

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

// The owner section is a ledger, after Tufte's Envisioning Information: one
// row per area and per machine, each the same shape, so a machine can be
// compared with the next at a glance; the numbers are the loudest thing on
// it, links are quiet text, and hairlines separate areas rather than boxes
// imprisoning them. Column headings are said once, at the top.

// A count, greyed when there is nothing to it so the ones that need looking
// at stand out. The label is shown only where the row stacks, on a phone.
const count = (
  value: number,
  [one, many]: readonly [string, string],
  extra: Html = html``
) => html`
  <div
    class="owner-ledger__number${value === 0
      ? safe(' owner-ledger__number--none')
      : safe('')}"
  >
    <span class="owner-ledger__count">${safe(String(value))}</span>
    <span class="owner-ledger__label">${safe(value === 1 ? one : many)}</span>
    ${extra}
  </div>
`;

const OPEN_TICKETS = ['open ticket', 'open tickets'] as const;

const blank = html`<div class="owner-ledger__number"></div>`;

const links = (items: ReadonlyArray<{href: string; label: string}>) => html`
  <div class="owner-ledger__links">
    ${joinHtml(
      items.map(
        (item, index) =>
          html`${index === 0 ? safe('') : safe(' · ')}<a
              href="${safe(item.href)}"
              >${sanitizeString(item.label)}</a
            >`
      )
    )}
  </div>
`;

const machineRow =
  (now: Date) =>
  (machine: TrainedMachine): Html => html`
    <div class="owner-ledger__row owner-ledger__row--machine">
      <div class="owner-ledger__name">
        <strong>${sanitizeString(machine.name)}</strong>
        <div class="owner-ledger__caption">
          You're a trainer on this equipment.
        </div>
        ${links([
          {
            href: `/trouble-tickets/board?equipmentId=${machine.id}`,
            label: 'View trouble tickets',
          },
          {
            href: `/equipment/${machine.id}/trainings`,
            label: 'Arrange training',
          },
          {href: `/equipment/${machine.id}`, label: 'Manage equipment'},
        ])}
      </div>
      ${count(machine.openTickets, OPEN_TICKETS)}
      ${count(
        machine.doneOnlineTraining,
        ['done the online training', 'done the online training'],
        html`${machine.askedToBeTrained === 0
          ? html``
          : html`<span class="owner-ledger__aside"
              >+${safe(String(machine.askedToBeTrained))} asked to be
              trained</span
            >`}
        ${pipe(
          machine.earliestSince,
          O.match(
            () => html``,
            since =>
              html`<span class="owner-ledger__aside"
                >first ${safe(howLong(since, now))} ago</span
              >`
          )
        )}`
      )}
      ${count(machine.upcomingTrainings, [
        'upcoming training',
        'upcoming trainings',
      ])}
      <div class="owner-ledger__spark">
        ${renderTrainingSparkline(machine.trainingsByQuarter)}
      </div>
    </div>
  `;

const areaRows = (now: Date) => (area: OwnedArea) => html`
  <section class="owner-ledger__area">
    <div class="owner-ledger__row owner-ledger__row--area">
      <div class="owner-ledger__name">
        <h2 class="owner-ledger__area-name">${sanitizeString(area.name)}</h2>
        <div class="owner-ledger__caption">You're an owner in this area.</div>
        ${links([
          {
            href: `/trouble-tickets/board?areaId=${area.id}`,
            label: 'View trouble tickets',
          },
          ...pipe(
            area.purchasingAreaId,
            O.match(
              () => [],
              id => [
                {href: `/purchasing-areas/${id}`, label: 'View purchasing'},
              ]
            )
          ),
          {href: `/areas/manage?area=${area.id}`, label: 'Manage area'},
        ])}
      </div>
      ${count(area.openTickets, OPEN_TICKETS)} ${blank} ${blank} ${blank}
    </div>
    ${joinHtml(area.trainerOn.map(machineRow(now)))}
  </section>
`;

// What an owner looks after, area by area, with the machines in each that
// they also train on: the things they come here to do, one click away.
const ownerPart = (viewModel: ViewModel) => html`
  <div class="stack">
    <h1>Owner</h1>
    <p class="owner-ledger__intro">
      Your areas, and the machines in them you train on.
    </p>
    <div class="owner-ledger">
      <div class="owner-ledger__row owner-ledger__head" aria-hidden="true">
        <div></div>
        <div>Open tickets</div>
        <div>Online training done</div>
        <div>Upcoming</div>
        <div>Trained per quarter</div>
      </div>
      ${joinHtml(viewModel.ownedAreas.map(areaRows(viewModel.now)))}
    </div>
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
