import {html, Html, joinHtml} from '../../types/html';

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

export const render = () => html`
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
      html`<a href="/equipment-links">Equipment guides and risk assessments</a>
      - which machines are missing one, and set it from there`,
      html`<a href="/equipment-signs">Print equipment signs</a> - name, colour
      and a QR code for reporting problems`,
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
