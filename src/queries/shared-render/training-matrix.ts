import * as O from 'fp-ts/Option';
import { EquipmentId } from '../../types/equipment-id';
import { html, joinHtml, Safe, sanitizeString } from '../../types/html';
import {tooltip} from '../shared-render/tool-tip';

const GREEN_TICK = '✅' as Safe;
const WAVY_DASH = '〰️' as Safe;

const renderYes = (when: O.Option<Date>) => O.isSome(when) ? html`
  ${GREEN_TICK}${tooltip(when.value.toLocaleDateString() as Safe)}
` : html`-`;

const renderTrainingMatrixRow = (row: TrainingMatrix[0]) => html`
  <tr>
    <th scope="row">
      <a href="/equipment/${row.equipment_id}">
        ${sanitizeString(row.equipment_name)}
      </a>
    </th>
    <th scope="row">
      ${
        O.isSome(row.equipment_quiz_passed) ? html`
          ${GREEN_TICK}${tooltip(row.equipment_quiz_passed.value.toLocaleDateString() as Safe)}
        ` : html`
          ${WAVY_DASH}${tooltip(row.equipment_quiz_attempts.map(d => d.toLocaleDateString() as Safe).join(',') as Safe)}
        `
      }
    </th>
    <th scope="row">
      ${renderYes(row.is_trained)}
    </th>
    <th scope="row">
      ${renderYes(row.is_owner)}
    </th>
    <th scope="row">
      ${renderYes(row.is_trainer)}
    </th>
  </tr>
`;

export type TrainingMatrix = ReadonlyArray<{
  equipment_name: string,
  equipment_id: EquipmentId,
  is_trainer: O.Option<Date>,
  is_owner: O.Option<Date>,
  is_trained: O.Option<Date>,
  equipment_quiz_passed: O.Option<Date>,
  equipment_quiz_attempts: Date[],
}>;

export const renderTrainingMatrix = (tm: TrainingMatrix) => html`
    <table>
      <caption>
        Training Matrix
      </caption>
      <thead>
        <tr>
          <th scope="Equipment"></th>
          <th scope="Equipment Quiz Passed"></th>
          <th scope="Training Complete"></th>
          <th scope="Owner"></th>
          <th scope="Trainer"></th>
        </tr>
      </thead>
      <tbody>
        ${
          joinHtml(tm.map(renderTrainingMatrixRow))
        }
      </tbody>
    </table>
`;
