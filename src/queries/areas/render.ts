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
import * as O from 'fp-ts/Option';
import {displayDate, displayDateShort} from '../../templates/display-date';
import {DateTime} from 'luxon';
import {
  Area,
  Equipment,
  Owner,
} from '../../read-models/shared-state/return-types';
import {QuarterCount} from '../../read-models/shared-state/member/training-delivered';
import { renderMemberNumber } from '../../templates/member-number';

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

// Email shown under the name to save a column. It's a button so it can be
// click-to-copied (progressive enhancement - the address is still readable and
// selectable without JS). See the copy handler in templates/head.ts.
const renderCopyableEmail = (email: string) => html`
  <button
    type="button"
    class="copy-text"
    data-copy="${safe(email)}"
    title="Copy email address"
  >
    ${safe(email)}
  </button>
`;

// Tufte-style sparkline: one small green bar per quarter (oldest left, current
// quarter at the right), bar height scaled to the number of trainings that
// owner delivered. Hovering a bar shows the count via a native SVG <title>.
const SPARK_BAR_WIDTH = 6;
const SPARK_BAR_GAP = 3;
const SPARK_HEIGHT = 16;
const SPARK_MAX_BAR = 13;

const trainingsTotal = (owner: OwnerViewModel): number =>
  owner.trainingsByQuarter.reduce((sum, quarter) => sum + quarter.count, 0);

const renderTrainingSparkline = (quarters: ReadonlyArray<QuarterCount>) => {
  const maxCount = Math.max(1, ...quarters.map(q => q.count));
  const width =
    quarters.length * SPARK_BAR_WIDTH + (quarters.length - 1) * SPARK_BAR_GAP;
  const total = quarters.reduce((sum, q) => sum + q.count, 0);
  const bars = quarters.map((quarter, i) => {
    // Zero quarters get a 1px baseline tick so the quarter is still visible.
    const barHeight =
      quarter.count === 0
        ? 1
        : Math.max(2, Math.round((SPARK_MAX_BAR * quarter.count) / maxCount));
    const x = i * (SPARK_BAR_WIDTH + SPARK_BAR_GAP);
    const barClass =
      quarter.count === 0 ? 'spark-bar spark-bar--empty' : 'spark-bar';
    return html`<rect
      class="${safe(barClass)}"
      x="${x}"
      y="${SPARK_HEIGHT - barHeight}"
      width="${SPARK_BAR_WIDTH}"
      height="${barHeight}"
    >
      <title>
        ${safe(
          `${quarter.label}: ${quarter.count} training${
            quarter.count === 1 ? '' : 's'
          }`
        )}
      </title>
    </rect>`;
  });
  return html`<svg
    class="sparkline"
    width="${width}"
    height="${SPARK_HEIGHT}"
    viewBox="0 0 ${width} ${SPARK_HEIGHT}"
    role="img"
    aria-label="${safe(
      `${total} trainings delivered over the last ${quarters.length} quarters`
    )}"
  >
    ${joinHtml(bars)}
  </svg>`;
};

const ownerRow = (
  areaId: Area['id'],
  owner: OwnerViewModel,
  canManageAreas: boolean,
  canSeeOwnerPrivateDetails: boolean,
  showTrainings: boolean,
  reasonCell: Html = html``
) => html`
  <tr>
    <td>
      <div>
        ${sanitizeString(O.getOrElse(() => '-')(owner.name))}
        (${renderMemberNumber(owner.memberNumber)})
      </div>
      ${canSeeOwnerPrivateDetails ? renderCopyableEmail(owner.primaryEmailAddress) : html``}
    </td>
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
          ${showTrainings ? html`<th>Trainings</th>` : html``}
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
            ${showTrainings ? html`<th>Trainings</th>` : html``}
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
  const showTrainings = area.equipment.length > 0;
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
