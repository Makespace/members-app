import * as O from 'fp-ts/Option';
import { EquipmentId } from '../../types/equipment-id';
import { html, HtmlSubstitution, joinHtml, Safe, sanitizeString } from '../../types/html';
import { tooltipWith} from '../shared-render/tool-tip';
import { FullQuizResultsForMember } from '../../read-models/external-state/equipment-quiz';
import { UUID } from 'io-ts-types';

const GREEN_TICK = html`✅`;
const WAVY_DASH = html`〰️`;
const PLACEHOLDER = html`-`;

const renderYes = (when: O.Option<Date>) => O.isSome(when) ? tooltipWith(html`Since ${when.value.toLocaleDateString() as Safe}`, GREEN_TICK) : PLACEHOLDER;

const renderEquipmentQuizStatus = (equipment_quiz: TrainingMatrix[0]['equipment'][0]['equipment_quiz']) => {
  if (equipment_quiz.passedAt.length > 0) {
    return tooltipWith(equipment_quiz.passedAt.map(d => d.toLocaleDateString()).join(',') as Safe, GREEN_TICK);
  }
  if (equipment_quiz.attempted.length > 0) {
    return tooltipWith(equipment_quiz.attempted.map(d => html`${d.percentage}% - ${d.response_submitted.toLocaleDateString() as Safe}`).join(',') as Safe, WAVY_DASH);
  }
  return PLACEHOLDER;
};

const renderTrainingMatrixRow = (areaColumn: HtmlSubstitution, ownerColumn: HtmlSubstitution, row: TrainingMatrix[0]['equipment'][0]) => html`
  <tr>
    ${areaColumn}
    ${ownerColumn}
    <th scope="row">
      <a href="/equipment/${row.equipment_id}">
        ${sanitizeString(row.equipment_name)}
      </a>
    </th>
    <th scope="row">
      ${renderEquipmentQuizStatus(row.equipment_quiz)}
    </th>
    <th scope="row">
      ${renderYes(row.is_trained)}
    </th>
    <th scope="row">
      ${renderYes(row.is_trainer)}
    </th>
  </tr>
`;

export type TrainingMatrix = ReadonlyArray<{
  area: {
    id: UUID,
    name: string,
    is_owner: O.Option<Date>,
  },
  equipment: ReadonlyArray<{
    equipment_name: string,
    equipment_id: EquipmentId,
    is_trainer: O.Option<Date>,
    is_trained: O.Option<Date>,
    equipment_quiz: FullQuizResultsForMember['equipmentQuiz'][UUID]
  }>
}>;

export const renderTrainingMatrix = (tm: TrainingMatrix) => {
  const flattenedWithAreaColumn: [HtmlSubstitution, HtmlSubstitution, TrainingMatrix[0]['equipment'][0]][] = [];
  for (const area of tm) {
    const areaColumnValue = html`<th rowspan="${area.equipment.length}">${sanitizeString(area.area.name)}</th>`;
    const ownerColumnValue = html`<th rowspan="${area.equipment.length}">${renderYes(area.area.is_owner)}</th>`;
    flattenedWithAreaColumn.push([areaColumnValue, ownerColumnValue, area.equipment[0]]);
    for (const equipment of area.equipment.slice(1)) {
      flattenedWithAreaColumn.push([html``, html``, equipment]);
    }
  }
  return html`
      <table>
        <thead>
          <tr>
            <th scope="row">Area</th>
            <th scope="row">Owner</th>
            <th scope="row">Equipment</th>
            <th scope="row">Equipment Quiz Passed</th>
            <th scope="row">Training Complete</th>
            <th scope="row">Trainer</th>
          </tr>
        </thead>
        <tbody>
          ${
            joinHtml(flattenedWithAreaColumn.map(([areaColumn, ownerColumn, equipment]) => renderTrainingMatrixRow(areaColumn, ownerColumn, equipment)))
          }
        </tbody>
      </table>
  `
};
