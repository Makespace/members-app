import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {Html, html, joinHtml, safe, sanitizeString} from '../../types/html';
import {EquipmentLinks, ViewModel} from './view-model';

const HERE = '/equipment-links';

const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// Set here and come straight back here, rather than being dropped on the
// machine's page: somebody filling gaps is working down a list.
const setter = (input: {
  action: string;
  field: string;
  equipmentId: string;
  placeholder: string;
  label: string;
}) => html`
  <form
    action="${safe(input.action)}?next=${safe(encodeURIComponent(HERE))}"
    method="post"
    class="eq-links__set"
  >
    <label class="visually-hidden" for="${safe(`${input.field}-${input.equipmentId}`)}"
      >${sanitizeString(input.label)}</label
    >
    <input
      type="url"
      name="${safe(input.field)}"
      id="${safe(`${input.field}-${input.equipmentId}`)}"
      placeholder="${sanitizeString(input.placeholder)}"
      required
    />
    <input type="hidden" name="equipmentId" value="${safe(input.equipmentId)}" />
    <button type="submit">Save</button>
  </form>
`;

const linkOrSetter = (
  current: O.Option<string>,
  input: {action: string; field: string; equipmentId: string; placeholder: string; label: string}
): Html =>
  pipe(
    current,
    O.match(
      () => setter(input),
      url =>
        html`<a class="eq-capsule" href="${safe(url)}" title="${sanitizeString(url)}">
          <span class="eq-capsule__where">${sanitizeString(hostOf(url))}</span>
        </a>`
    )
  );

const row = (item: EquipmentLinks): Html => html`
  <tr>
    <td>
      <a href="/equipment/${safe(item.id)}">${sanitizeString(item.name)}</a>
    </td>
    <td>${sanitizeString(item.areaName)}</td>
    <td>
      ${linkOrSetter(item.guideUrl, {
        action: '/equipment/set-guide-url',
        field: 'guideUrl',
        equipmentId: item.id,
        placeholder: 'https://equipment.makespace.org/...',
        label: `Equipment guide for ${item.name}`,
      })}
    </td>
    <td>
      ${linkOrSetter(item.riskAssessmentUrl, {
        action: '/equipment/set-risk-assessment-url',
        field: 'riskAssessmentUrl',
        equipmentId: item.id,
        placeholder: 'https://...',
        label: `Risk assessment for ${item.name}`,
      })}
    </td>
  </tr>
`;

const table = (items: ReadonlyArray<EquipmentLinks>): Html => html`
  <table class="eq-links">
    <tr>
      <th>Machine</th>
      <th>Area</th>
      <th>Equipment guide</th>
      <th>Risk assessment</th>
    </tr>
    ${joinHtml(items.map(row))}
  </table>
`;

const count = (have: number, total: number): Html =>
  html`${sanitizeString(String(have))} of ${sanitizeString(String(total))}`;

export const render = (viewModel: ViewModel): Html => html`
  <div class="stack">
    <h1>Equipment guides and risk assessments</h1>
    <p>
      Which machines have somewhere to point a member asking how to use this,
      and somewhere to point one asking what the hazards are. Fill a gap here
      and you come straight back to the list.
    </p>
    <p>
      <strong>Equipment guide:</strong>
      ${count(viewModel.withGuide, viewModel.total)} &middot;
      <strong>Risk assessment:</strong>
      ${count(viewModel.withRiskAssessment, viewModel.total)}
    </p>
    ${viewModel.missing.length === 0
      ? html`<p>Every machine has both.</p>`
      : html`
          <h2>Missing something (${sanitizeString(String(viewModel.missing.length))})</h2>
          ${table(viewModel.missing)}
        `}
    ${viewModel.complete.length === 0
      ? html``
      : html`
          <h2>Complete (${sanitizeString(String(viewModel.complete.length))})</h2>
          ${table(viewModel.complete)}
        `}
    <p>
      <small
        >Machines marked obsolete are left out: they need neither.</small
      >
    </p>
  </div>
`;
