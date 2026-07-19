/**
 * @jest-environment jsdom
 */

import * as O from 'fp-ts/Option';
import {UUID} from 'io-ts-types';
import {renderTrainingMatrix, TrainingMatrix} from '../../../src/queries/training-matrix/render';
import {EquipmentId} from '../../../src/types/equipment-id';

const areaId = '11111111-1111-4111-8111-111111111111' as UUID;
const equipmentId = '22222222-2222-4222-8222-222222222222' as EquipmentId;

const renderPage = (trainingMatrix: TrainingMatrix): HTMLBodyElement => {
  const body = document.createElement('body');
  body.innerHTML = renderTrainingMatrix(trainingMatrix);
  return body;
};

describe('training matrix render', () => {
  it('links area names to the area page', () => {
    const page = renderPage([
      {
        area: {
          id: areaId,
          name: 'Laser Area',
          is_owner: O.none,
        },
        equipment: [
          {
            equipment_id: equipmentId,
            equipment_name: 'Laser Cutter',
            is_trainer: O.none,
            is_trained: O.none,
            equipment_quiz: {
              passedAt: [],
              attempted: [],
            },
          },
        ],
      },
    ]);

    expect(page.querySelector(`a[href="/areas#area-${areaId}"]`)!.textContent).toContain('Laser Area');
  });

  it('renders areas that have no equipment', () => {
    const page = renderPage([
      {
        area: {
          id: areaId,
          name: 'Laser Area',
          is_owner: O.some(new Date('2025-01-01T00:00:00.000Z')),
        },
        equipment: [],
      },
    ]);

    expect(page.querySelector(`a[href="/areas#area-${areaId}"]`)!.textContent).toContain('Laser Area');
    expect(page.textContent).toContain('No equipment assigned');
  });
});
