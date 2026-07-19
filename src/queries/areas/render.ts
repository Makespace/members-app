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
import {renderReasonChips} from '../../templates/recurly-reasons';
import {renderMember} from '../../templates/member';
import {renderTrainingSparkline} from '../../templates/training-sparkline';
import {tooltip} from '../shared-render/tool-tip';
import * as O from 'fp-ts/Option';
import {displayDate, displayDateShort} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {
  Area,
  Equipment,
  Owner,
} from '../../read-models/shared-state/return-types';


const renderSignedAt = (owner: Owner) => {
  if (O.isSome(owner.agreementSigned)) {
    const signedAt = DateTime.fromJSDate(owner.agreementSigned.value);
    // Compact date in the cell; full timestamp on hover.
    return html`<span title="${displayDate(signedAt)}"
      >${displayDateShort(signedAt)}</span
    >`;
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

// Sum of trainings delivered across the shown quarters - used to sort owners.
const trainingsTotal = (owner: OwnerViewModel): number =>
  owner.trainingsByQuarter.reduce((sum, quarter) => sum + quarter.count, 0);

const trainingsHeader = html`<th>
  Trainings
  ${tooltip(
    safe(
      'Shows trainings completed within this area, in the last four quarters (most recent quarter is to the right)'
    )
  )}
</th>`;

const ownerRow = (
  areaId: Area['id'],
  owner: OwnerViewModel,
  canManageAreas: boolean,
  canSeeOwnerPrivateDetails: boolean,
  showTrainings: boolean,
  reasonCell: Html = html``
) => html`
  <tr>
    <td>${renderMember(owner, canSeeOwnerPrivateDetails)}</td>
    ${canManageAreas ? reasonCell : html``}
    ${showTrainings
      ? html`<td>${renderTrainingSparkline(owner.trainingsByQuarter)}</td>`
      : html``}
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
  canSeeOwnerPrivateDetails: boolean,
  showTrainings: boolean
) => {
  if (owners.length === 0) {
    if (!canManageAreas) {
      return html`<p>
        This area doesn't have any owners currently - email
        owners@makespace.org to get involved!
      </p>`;
    }

    return hasInactiveOwners
      ? html` <p>No active owners — see inactive owners below.</p> `
      : html` <p>Owners needed!</p> `;
  }
  const sorted = showTrainings
    ? [...owners].sort((a, b) => trainingsTotal(b) - trainingsTotal(a))
    : owners;
  return html`
    <table>
      <thead>
        <tr>
          <th>Member</th>
          ${canSeeOwnerPrivateDetails
            ? html`<th>Agreement Signed</th>`
            : html``}
          ${showTrainings ? trainingsHeader : html``}
          ${canManageAreas ? html`<th></th>` : html``}
        </tr>
      </thead>
      <tbody>
        ${joinHtml(
          sorted.map(owner => ownerRow(areaId, owner, canManageAreas, canSeeOwnerPrivateDetails, showTrainings))
        )}
      </tbody>
    </table>
  `;
};

const renderInactiveOwners = (
  areaId: Area['id'],
  owners: ReadonlyArray<OwnerViewModel>,
  canManageAreas: boolean,
  canSeeOwnerPrivateDetails: boolean,
  showTrainings: boolean
) => {
  if (!canManageAreas || owners.length === 0) {
    return html``;
  }
  const sorted = showTrainings
    ? [...owners].sort((a, b) => trainingsTotal(b) - trainingsTotal(a))
    : owners;
  return html`
    <details>
      <summary>Inactive owners (${safe(owners.length.toString())})</summary>
      <table>
        <thead>
          <tr>
            <th>Member</th>
            <th>Reason</th>
            ${showTrainings ? trainingsHeader : html``}
            <th>Agreement Signed</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${joinHtml(
            sorted.map(owner =>
              ownerRow(
                areaId,
                owner,
                canManageAreas,
                canSeeOwnerPrivateDetails,
                showTrainings,
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
  const publiclyVisibleOwners = viewModel.canManageAreas
    ? activeOwners
    : area.owners;
  // Only areas with red equipment have anything to train on, so only they get
  // the trainings column.
  const showTrainings = area.equipment.length > 0 && viewModel.canSeeTrainings;
  return html`
  <article id="area-${safe(area.id)}">
    <h2>${sanitizeString(area.name)}</h2>
    ${O.isSome(area.email)
      ? html`<p><strong>Mailing list:</strong> ${safe(area.email.value)}</p>`
      : html``}
    <div>${renderEquipment(area.equipment)}</div>
    ${renderActiveOwners(
      area.id,
      publiclyVisibleOwners,
      viewModel.canManageAreas && inactiveOwners.length > 0,
      viewModel.canManageAreas,
      viewModel.canSeeOwnerPrivateDetails,
      showTrainings
    )}
    ${viewModel.canManageAreas ? renderInactiveOwners(area.id, inactiveOwners, viewModel.canManageAreas, viewModel.canSeeOwnerPrivateDetails, showTrainings) : html``}
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
