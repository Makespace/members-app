import * as O from 'fp-ts/Option';
import * as RR from 'fp-ts/ReadonlyRecord';
import * as RA from 'fp-ts/ReadonlyArray';


import { TrainingMatrix } from '../training-matrix/render';
import { EquipmentId } from '../../types/equipment-id';
import { FullQuizResultsForMember } from '../../read-models/external-state/equipment-quiz';
import { UUID } from 'io-ts-types';
import { Member } from '../../read-models/shared-state/return-types';
import { pipe } from 'fp-ts/lib/function';
import { SharedReadModel } from '../../read-models/shared-state';

export const constructTrainingMatrix = (
  member: Member,
  sharedReadModel: SharedReadModel,
  quizData: FullQuizResultsForMember
): TrainingMatrix => {
  const matrix: Record<EquipmentId, TrainingMatrix[0]> = {};

  for (const [equipmentId, equipment_quiz] of RR.toEntries(quizData.equipmentQuiz)) {
    const equipment = sharedReadModel.equipment.get(equipmentId);
    if (O.isSome(equipment)) {
      matrix[equipmentId] = {
        equipment_id: equipmentId,
        equipment_name: equipment.value.name,
        equipment_quiz,
        is_owner: pipe(
          member.ownerOf,
          RA.findFirst(ownerOf => ownerOf.id === equipment.value.area.id),
          O.map(o => o.ownershipRecordedAt)
        ),
        is_trained: pipe(
          member.trainedOn,
          RA.findFirst(entry => entry.id === equipmentId),
          O.map(t => t.trainedAt)
        ),
        is_trainer: pipe(
          member.trainerFor,
          RA.findFirst(entry => entry.equipment_id === equipmentId),
          O.map(t => t.since)
        ),
      };
    }
  }

  return [
    {
      equipment_id: '12345678-12345678-4111-1234-12341234' as UUID,
      equipment_name: 'Metal Mill',
      equipment_quiz: {
        passedAt: [],
        attempted: [
          {
            response_submitted: new Date(),
            sheet_id: 'abc',
            score: 9,
            max_score: 10,
            percentage: 90
          }
        ]
      },
      is_owner: O.none,
      is_trained: O.none,
      is_trainer: O.none,
    },
    {
      equipment_id: '12345678-12345678-4111-1234-12341234' as UUID,
      equipment_name: 'Metal Lathe',
      equipment_quiz: {
        passedAt: [new Date()],
        attempted: [
          {
            response_submitted: new Date(),
            sheet_id: 'abc',
            score: 9,
            max_score: 10,
            percentage: 90
          }
        ]
      },
      is_owner: O.some(new Date()),
      is_trained: O.some(new Date()),
      is_trainer: O.some(new Date()),
    }
  ]
}
