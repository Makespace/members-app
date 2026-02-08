import * as O from 'fp-ts/Option';
import { EquipmentId } from '../../types/equipment-id';
import { html, sanitizeString } from '../../types/html';



const renderTrainingMatrixRow = (row: TrainingMatrix[0]) => html`
  <tr>
    <th scope="row">
        <a href="/equipment/${row.equipment_id}">
            ${sanitizeString(row.equipment_name)}
        </a>
    </th>
    <th scope="row">
    
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
