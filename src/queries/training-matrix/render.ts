import * as O from 'fp-ts/Option';
import { EquipmentId } from '../../types/equipment-id';
import { html, HtmlSubstitution, joinHtml, Safe, safe, sanitizeString } from '../../types/html';
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

type TrainingMatrixEquipment = TrainingMatrix[0]['equipment'][0];

type TrainingMatrixRow =
  | {
      type: 'equipment';
      equipment: TrainingMatrixEquipment;
    }
  | {
      type: 'no-equipment';
    };

const renderEquipmentCells = (row: TrainingMatrixEquipment) => html`
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
`;

const renderNoEquipmentCells = html`
  <th scope="row">No equipment assigned</th>
  <th scope="row">${PLACEHOLDER}</th>
  <th scope="row">${PLACEHOLDER}</th>
  <th scope="row">${PLACEHOLDER}</th>
`;

const renderTrainingMatrixRow = (areaColumn: HtmlSubstitution, ownerColumn: HtmlSubstitution, row: TrainingMatrixRow) => html`
  <tr>
    ${areaColumn}
    ${ownerColumn}
    ${row.type === 'equipment'
      ? renderEquipmentCells(row.equipment)
      : renderNoEquipmentCells}
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
  const flattenedWithAreaColumn: [HtmlSubstitution, HtmlSubstitution, TrainingMatrixRow][] = [];
  for (const area of tm) {
    const rowSpan = Math.max(area.equipment.length, 1);
    const areaColumnValue = html`<th rowspan="${rowSpan}"><a href="/areas#area-${safe(area.area.id)}">${sanitizeString(area.area.name)}</a></th>`;
    const ownerColumnValue = html`<th rowspan="${rowSpan}">${renderYes(area.area.is_owner)}</th>`;

    if (area.equipment.length === 0) {
      flattenedWithAreaColumn.push([
        areaColumnValue,
        ownerColumnValue,
        {type: 'no-equipment'},
      ]);
      continue;
    }

    flattenedWithAreaColumn.push([areaColumnValue, ownerColumnValue, {
      type: 'equipment',
      equipment: area.equipment[0],
    }]);
    for (const equipment of area.equipment.slice(1)) {
      flattenedWithAreaColumn.push([html``, html``, {
        type: 'equipment',
        equipment,
      }]);
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
