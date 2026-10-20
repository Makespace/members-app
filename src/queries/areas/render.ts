import {pipe} from 'fp-ts/lib/function';
import {
  html,
  Html,
  joinHtml,
  safe,
  SanitizedString,
  sanitizeString,
} from '../../types/html';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  AreaViewModel,
  EquipmentViewModel,
  OwnerVerdict,
  OwnerViewModel,
  ViewModel,
} from './view-model';
import {renderReasonChips} from '../../templates/recurly-reasons';
import {renderMember} from '../../templates/member';
import {renderTrainingSparkline} from '../../templates/training-sparkline';
import {tooltip} from '../shared-render/tool-tip';
import {renderOwnerAgreementCell} from '../shared-render/owner-agreement';
import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import { mailTo } from '../../templates/mailto';
import {
  categoryDot,
  categoryLabel,
} from '../../templates/equipment-category';
import {EquipmentCategory} from '../../types/equipment-category';


const renderSignedAt = (owner: OwnerViewModel) =>
  renderOwnerAgreementCell(owner.agreement);

// Anyone who needs to sign, or sign again, can be sent the invite.
const renderSignedAtForManager = (owner: OwnerViewModel) => {
  if (
    owner.agreement.state === 'signed' ||
    owner.agreement.state === 'renewal-due'
  ) {
    return renderSignedAt(owner);
  }
  return html`
    ${owner.agreement.state === 'unsigned' ? html`` : renderSignedAt(owner)}
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

// The verdict is only evaluated for super-users, the only viewers who see the
// inactive-owners section where it is rendered.
const getVerdict = (owner: OwnerViewModel): OwnerVerdict =>
  pipe(
    owner.verdict,
    O.getOrElseW(() => {
      throw new Error('Owner verdict was never evaluated for this viewer');
    })
  );

const trainingsHeader = html`<th>
  Trainings
  ${tooltip(
    safe(
      'Shows trainings completed within this area, in the last four quarters (most recent quarter is to the right)'
    )
  )}
</th>`;

const ownerRow = (
  areaId: AreaViewModel['id'],
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
  areaId: AreaViewModel['id'],
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
          <th>Owner</th>
          ${showTrainings ? trainingsHeader : html``}
          ${canSeeOwnerPrivateDetails
            ? html`<th>Agreement Signed</th>`
            : html``}
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
  areaId: AreaViewModel['id'],
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
                html`<td>${renderReasonChips(getVerdict(owner).reasons)}</td>`
              )
            )
          )}
        </tbody>
      </table>
    </details>
  `;
};

const renderEquipmentItem = (item: EquipmentViewModel) => html`
  <div class="equipment-with-sparkline"
    >${categoryDot(item.category)}<a href="/equipment/${safe(item.id)}"
      >${sanitizeString(item.name)}</a
    >
    ${item.category === 'red'
      ? renderTrainingSparkline(item.trainingsByQuarter)
      : html``}</div
  >
`;

const STICKER_ORDER: ReadonlyArray<EquipmentCategory> = [
  'red',
  'orange',
  'green',
];

// How many red, orange and green items a category holds; colours it has none
// of are left out.
const renderStickerCounts = (items: ReadonlyArray<EquipmentViewModel>) =>
  joinHtml(
    STICKER_ORDER.flatMap(sticker => {
      const count = items.filter(item => item.category === sticker).length;
      return count === 0
        ? []
        : [
            html`<span
              class="eq-cat eq-cat--${safe(sticker)}"
              title="${safe(count.toString())} ${categoryLabel(
                sticker
              )}"
              ><span class="eq-cat__dot" aria-hidden="true"></span
              ><span class="visually-hidden"
                >${categoryLabel(sticker)}:</span
              >${safe(count.toString())}</span
            >`,
          ];
    })
  );

const renderEquipmentGroup = (
  name: Html | SanitizedString,
  items: ReadonlyArray<EquipmentViewModel>
) => html`
  <details class="area-eq-group">
    <summary>
      <span class="area-eq-group__name">${name}</span>
      <span class="area-eq-group__counts">${renderStickerCounts(items)}</span>
    </summary>
    <div>${joinHtml(items.map(renderEquipmentItem))}</div>
  </details>
`;

// Areas that use categories show one collapsed section per category (empty
// ones are skipped), then whatever is not in a category yet under "Other".
// Areas without categories list everything at once.
const renderEquipment = (area: AreaViewModel) => {
  if (area.equipment.length === 0) {
    return html`<p>No equipment currently assigned to this area.</p>`;
  }
  if (area.equipmentCategories.length === 0) {
    return html`
      <div>
        <strong>Equipment:</strong>
        <div>${joinHtml(area.equipment.map(renderEquipmentItem))}</div>
      </div>
    `;
  }
  const inCategory = (id: AreaViewModel['equipmentCategories'][number]['id']) =>
    area.equipment.filter(item =>
      O.exists(categoryId => categoryId === id)(item.areaCategoryId)
    );
  const known = new Set(area.equipmentCategories.map(category => category.id));
  const other = area.equipment.filter(
    item =>
      !O.exists((categoryId: UUID) => known.has(categoryId))(
        item.areaCategoryId
      )
  );
  return html`
    <div>
      <strong>Equipment:</strong>
      <div class="area-eq-groups">
        ${joinHtml(
          area.equipmentCategories.flatMap(category => {
            const items = inCategory(category.id);
            return items.length === 0
              ? []
              : [renderEquipmentGroup(sanitizeString(category.name), items)];
          })
        )}
        ${other.length === 0
          ? html``
          : renderEquipmentGroup(html`Other`, other)}
      </div>
    </div>
  `;
};

const renderArea =
  (viewModel: ViewModel) =>
  (area: AreaViewModel) => {
  // The verdict is only evaluated for super-users, the only viewers of the
  // inactive-owners section; everyone else sees the full owner list.
  const evaluatedOwners = area.owners
    .filter(owner => O.isSome(owner.verdict))
    .map(owner => ({...owner, ...getVerdict(owner)}));
  const activeOwners = evaluatedOwners.filter(owner => owner.isActiveOwner);
  const inactiveOwners = evaluatedOwners.filter(owner => !owner.isActiveOwner);
  const publiclyVisibleOwners = viewModel.canManageAreas
    ? activeOwners
    : area.owners;
  // Only areas with red equipment have anything to train on, so only they get
  // the trainings column.
  const showTrainings =
    area.equipment.some(item => item.category === 'red') &&
    viewModel.canSeeTrainings;
  return html`
  <article id="area-${safe(area.id)}">
    <div class="area-heading">
      <h2>${sanitizeString(area.name)}</h2>
      ${area.canManage
        ? html`<a class="button" href="/areas/manage?area=${safe(area.id)}"
            >Manage area</a
          >`
        : html``}
    </div>
    ${O.isSome(area.email)
      ? html`<p><strong>Mailing list:</strong> ${mailTo(area.email.value, O.none, O.none)}</p>`
      : html``}
    ${O.isSome(area.purchasingArea)
      ? html`<p>
          <strong>Purchasing area:</strong>
          <a href="/purchasing-areas/${area.purchasingArea.value.id}"
            >${sanitizeString(area.purchasingArea.value.name)}</a
          >
        </p>`
      : html``}
    <div>${renderEquipment(area)}</div>
    ${renderActiveOwners(
      area.id,
      publiclyVisibleOwners,
      viewModel.canManageAreas && inactiveOwners.length > 0,
      viewModel.canManageAreas,
      viewModel.canSeeOwnerPrivateDetails,
      showTrainings
    )}
    ${viewModel.canManageAreas ? renderInactiveOwners(area.id, inactiveOwners, viewModel.canManageAreas, viewModel.canSeeOwnerPrivateDetails, showTrainings) : html``}
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
