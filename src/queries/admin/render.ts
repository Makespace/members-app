import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {html, Html, joinHtml, safe, sanitizeString} from '../../types/html';
import {OwnedArea, ViewModel} from './construct-view-model';

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

const linkList = (links: ReadonlyArray<Html>) => html`
  <ul class="owner-links">
    ${joinHtml(links.map(link => html`<li>${link}</li>`))}
  </ul>
`;

const trainerOnEquipment = (equipment: OwnedArea['trainerOn'][number]) => html`
  <div class="owner-equipment stack">
    <h3>${sanitizeString(equipment.name)}</h3>
    <p>You're a trainer on this equipment.</p>
    ${linkList([
      html`<a
        href="/trouble-tickets/board?equipmentId=${safe(equipment.id)}"
        >View trouble tickets</a
      >`,
      html`<a href="/equipment/${safe(equipment.id)}/trainings"
        >Arrange training</a
      >`,
      html`<a href="/equipment/${safe(equipment.id)}">Manage equipment</a>`,
    ])}
  </div>
`;

const ownedArea = (area: OwnedArea) => html`
  <section class="owner-area stack">
    <h2>${sanitizeString(area.name)}</h2>
    <p>You're an owner in this area.</p>
    ${linkList([
      html`<a href="/trouble-tickets/board?areaId=${safe(area.id)}"
        >View trouble tickets</a
      >`,
      ...pipe(
        area.purchasingAreaId,
        O.match(
          () => [],
          id => [
            html`<a href="/purchasing-areas/${safe(id)}">View purchasing</a>`,
          ]
        )
      ),
      html`<a href="/areas/manage?area=${safe(area.id)}">Manage area</a>`,
    ])}
    ${joinHtml(area.trainerOn.map(trainerOnEquipment))}
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
  ${viewModel.ownedAreas.length > 0 ? ownerPart(viewModel) : html``}
  ${viewModel.isSuperUser ? adminPart() : html``}
`;
