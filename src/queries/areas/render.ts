import {pipe} from 'fp-ts/lib/function';
import {
  commaHtml,
  html,
  joinHtml,
  safe,
  sanitizeString,
} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {renderMemberNumber} from '../../templates/member-number';
import * as O from 'fp-ts/Option';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';

const renderSignedAt = (
  owner: ViewModel['areas'][number]['owners'][number]
) => {
  if (owner.agreementSignedAt !== null) {
    return pipe(owner.agreementSignedAt, DateTime.fromJSDate, displayDate);
  }
  return html`
    <form action="/send-email/owner-agreement-invite" method="post">
      <input type="hidden" name="recipient" value="${owner.memberNumber}" />
      <button type="submit">Ask to sign</button>
    </form>
  `;
};

const renderRemoveOwner = (
  areaId: ViewModel['areas'][number]['id'],
  owner: ViewModel['areas'][number]['owners'][number]
) => html`
  <a
    href="/areas/remove-owner?memberNumber=${owner.memberNumber}&areaId=${safe(
      areaId
    )}"
    >Remove</a
  >
`;

const renderOwnerTable = (
  areaId: ViewModel['areas'][number]['id'],
  owners: ViewModel['areas'][number]['owners']
) =>
  pipe(
    owners,
    RA.map(
      owner => html`
        <tr>
          <td>${renderMemberNumber(owner.memberNumber)}</td>
          <td>${sanitizeString(O.getOrElse(() => '-')(owner.name))}</td>
          <td>${safe(owner.email)}</td>
          <td>${renderSignedAt(owner)}</td>
          <td>${renderRemoveOwner(areaId, owner)}</td>
        </tr>
      `
    ),
    RA.match(
      () => html` <p>Owners needed!</p> `,
      rows => html`
        <table>
          <thead>
            <tr>
              <th>Member Number</th>
              <th>Name</th>
              <th>Email</th>
              <th>Agreement Signed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${joinHtml(rows)}
          </tbody>
        </table>
      `
    )
  );

const renderEquipment = (equipment: ViewModel['areas'][number]['equipment']) =>
  pipe(
    equipment,
    RA.map(
      item => html`
        <a href="/equipment/${safe(item.id)}">${sanitizeString(item.name)}</a>
      `
    ),
    items => html`RED equipment: ${commaHtml(items)}`
  );

const renderArea = (area: ViewModel['areas'][number]) => html`
  <article>
    <h2>${sanitizeString(area.name)}</h2>
    <div>${renderEquipment(area.equipment)}</div>
    ${renderOwnerTable(area.id, area.owners)}
    <div class="wrap">
      <a class="button" href="/areas/add-owner?area=${safe(area.id)}"
        >Add owner</a
      >
      <a class="button" href="/equipment/add?area=${safe(area.id)}"
        >Add RED equipment</a
      >
      <a class="button" href="/areas/remove?area=${safe(area.id)}"
        >Remove area</a
      >
    </div>
  </article>
`;

const renderAreas = (areas: ViewModel['areas']) => {
  if (areas.length === 0) {
    return html`<p>Currently no Areas</p> `;
  }
  return pipe(areas, RA.map(renderArea), joinHtml);
};

const addAreaCallToAction = html`
  <a class="button" href="/areas/create">Add area of responsibility</a>
`;

export const render = (viewModel: ViewModel) => html`
  <div class="stack-large">
    <h1>Manage Areas and Owners</h1>
    <div>${addAreaCallToAction}</div>
    <section class="stack-large">${renderAreas(viewModel.areas)}</section>
  </div>
`;
