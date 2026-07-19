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
  return html`Not signed`;
};

const renderSignedAtForManager = (owner: Owner) => {
  if (O.isSome(owner.agreementSigned)) {
    return renderSignedAt(owner);
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
  canManageAreas: boolean,
  canSeeOwnerPrivateDetails: boolean,
  reasonCell: Html = html``
) => html`
  <tr>
    <td>${renderMemberNumber(owner.memberNumber)}</td>
    <td>${sanitizeString(O.getOrElse(() => '-')(owner.name))}</td>
    ${canSeeOwnerPrivateDetails
      ? html`<td>${safe(owner.primaryEmailAddress)}</td>`
      : html``}
    ${canManageAreas ? reasonCell : html``}
    ${canSeeOwnerPrivateDetails
      ? html`<td>${
          canManageAreas ? renderSignedAtForManager(owner) : renderSignedAt(owner)
        }</td>`
      : html``}
    ${canManageAreas ? html`<td>${renderRemoveOwner(areaId, owner)}</td>` : html``}
  </tr>
`;

const renderActiveOwners = (
  areaId: Area['id'],
  owners: ReadonlyArray<OwnerViewModel>,
  hasInactiveOwners: boolean,
  canManageAreas: boolean,
  canSeeOwnerPrivateDetails: boolean
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
          ${canSeeOwnerPrivateDetails ? html`<th>Email</th>` : html``}
          ${canSeeOwnerPrivateDetails
            ? html`<th>Agreement Signed</th>`
            : html``}
          ${canManageAreas ? html`<th></th>` : html``}
        </tr>
      </thead>
      <tbody>
        ${joinHtml(
          owners.map(owner =>
            ownerRow(
              areaId,
              owner,
              canManageAreas,
              canSeeOwnerPrivateDetails
            )
          )
        )}
      </tbody>
    </table>
  `;
};

const renderInactiveOwners = (
  areaId: Area['id'],
  owners: ReadonlyArray<OwnerViewModel>,
  canManageAreas: boolean
) => {
  if (!canManageAreas || owners.length === 0) {
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
                canManageAreas,
                true,
                html`<td>${renderReasonChips(owner.reasons)}</td>`
              )
            )
          )}
        </tbody>
      </table>
    </details>
  `;
};

const renderEquipment = (equipment: ReadonlyArray<Equipment>) => {
  if (equipment.length === 0) {
    return html`<p>No equipment currently assigned to this area.</p>`;
  }

  return pipe(
    equipment,
    RA.map(
      item => html`
        <a href="/equipment/${safe(item.id)}">${sanitizeString(item.name)}</a>
      `
    ),
    items => html`<p><strong>RED equipment:</strong> ${commaHtml(items)}</p>`
  );
};

const renderArea =
  (viewModel: ViewModel) =>
  (area: AreaViewModel) => {
  const activeOwners = area.owners.filter(owner => owner.isActiveOwner);
  const inactiveOwners = area.owners.filter(owner => !owner.isActiveOwner);
  return html`
  <article id="area-${safe(area.id)}">
    <h2>${sanitizeString(area.name)}</h2>
    ${O.isSome(area.email)
      ? html`<p><strong>Mailing list:</strong> ${safe(area.email.value)}</p>`
      : html``}
    <div>${renderEquipment(area.equipment)}</div>
    ${renderActiveOwners(
      area.id,
      activeOwners,
      inactiveOwners.length > 0,
      viewModel.canManageAreas,
      viewModel.canSeeOwnerPrivateDetails
    )}
    ${renderInactiveOwners(area.id, inactiveOwners, viewModel.canManageAreas)}
    ${
      viewModel.canManageAreas ? html`<div class="wrap">
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
    </div>` : html``
    }
  </article>
`;
};

const renderAreas = (viewModel: ViewModel) => {
  if (viewModel.areas.length === 0) {
    return html`<p>Currently no Areas</p> `;
  }
  return pipe(viewModel.areas, RA.map(renderArea(viewModel)), joinHtml);
};

const addAreaCallToAction = html`
  <a class="button" href="/areas/create">Add area of responsibility</a>
`;

export const render = (viewModel: ViewModel) => html`
  <div class="stack-large">
    <h1>Areas</h1>
    ${viewModel.canManageAreas ? html`<div>${addAreaCallToAction}</div>` : html``}
    <section class="stack-large">${renderAreas(viewModel)}</section>
  </div>
`;
