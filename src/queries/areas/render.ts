import {pipe} from 'fp-ts/lib/function';
import {
  commaHtml,
  html,
  Html,
  joinHtml,
  safe,
  sanitizeString,
} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {AreaViewModel, OwnerViewModel, ViewModel} from './view-model';
import {renderMemberNumber} from '../../templates/member-number';
import {renderReasonChips} from '../../templates/recurly-reasons';
import * as O from 'fp-ts/Option';
import {displayDate} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {
  Area,
  Equipment,
  Owner,
} from '../../read-models/shared-state/return-types';

const renderSignedAt = (owner: Owner) => {
  if (O.isSome(owner.agreementSigned)) {
    return pipe(owner.agreementSigned.value, DateTime.fromJSDate, displayDate);
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

const ownerRow = (
  areaId: Area['id'],
  owner: OwnerViewModel,
  reasonCell: Html = html``
) => html`
  <tr>
    <td>${renderMemberNumber(owner.memberNumber)}</td>
    <td>${sanitizeString(O.getOrElse(() => '-')(owner.name))}</td>
    <td>${safe(owner.primaryEmailAddress)}</td>
    ${reasonCell}
    <td>${renderSignedAt(owner)}</td>
    <td>${renderRemoveOwner(areaId, owner)}</td>
  </tr>
`;

const renderActiveOwners = (
  areaId: Area['id'],
  owners: ReadonlyArray<OwnerViewModel>,
  hasInactiveOwners: boolean
) => {
  if (owners.length === 0) {
    return hasInactiveOwners
      ? html` <p>No active owners — see inactive owners below.</p> `
      : html` <p>Owners needed!</p> `;
  }
  return html`
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
        ${joinHtml(owners.map(owner => ownerRow(areaId, owner)))}
      </tbody>
    </table>
  `;
};

const renderInactiveOwners = (
  areaId: Area['id'],
  owners: ReadonlyArray<OwnerViewModel>
) => {
  if (owners.length === 0) {
    return html``;
  }
  return html`
    <details>
      <summary>Inactive owners (${safe(owners.length.toString())})</summary>
      <table>
        <thead>
          <tr>
            <th>Member Number</th>
            <th>Name</th>
            <th>Email</th>
            <th>Reason</th>
            <th>Agreement Signed</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${joinHtml(
            owners.map(owner =>
              ownerRow(
                areaId,
                owner,
                html`<td>${renderReasonChips(owner.reasons)}</td>`
              )
            )
          )}
        </tbody>
      </table>
    </details>
  `;
};

const renderEquipment = (equipment: ReadonlyArray<Equipment>) =>
  pipe(
    equipment,
    RA.map(
      item => html`
        <a href="/equipment/${safe(item.id)}">${sanitizeString(item.name)}</a>
      `
    ),
    items => html`RED equipment: ${commaHtml(items)}`
  );

const renderArea = (area: AreaViewModel) => {
  const activeOwners = area.owners.filter(owner => owner.isActiveOwner);
  const inactiveOwners = area.owners.filter(owner => !owner.isActiveOwner);
  return html`
  <article>
    <h2>${sanitizeString(area.name)}</h2>
    ${O.isSome(area.email)
      ? html`<p><strong>Mailing list:</strong> ${safe(area.email.value)}</p>`
      : html``}
    <div>${renderEquipment(area.equipment)}</div>
    ${renderActiveOwners(area.id, activeOwners, inactiveOwners.length > 0)}
    ${renderInactiveOwners(area.id, inactiveOwners)}
    <div class="wrap">
      <a class="button" href="/areas/add-owner?area=${safe(area.id)}"
        >Add owner</a
      >
      <a class="button" href="/equipment/add?area=${safe(area.id)}"
        >Add RED equipment</a
      >
      <a class="button" href="/areas/set-mailing-list?area=${safe(area.id)}"
        >Set mailing list</a
      >
      <a class="button" href="/areas/remove?area=${safe(area.id)}"
        >Remove area</a
      >
    </div>
  </article>
`;
};

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
