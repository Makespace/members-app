import * as O from 'fp-ts/Option';
import { TrainingMatrix } from '../training-matrix/render';
import { EquipmentId } from '../../types/equipment-id';
import { FullQuizResultsForMember } from '../../read-models/external-state/equipment-quiz';
import { Member } from '../../read-models/shared-state/return-types';
import { pipe } from 'fp-ts/lib/function';
import { SharedReadModel } from '../../read-models/shared-state';

export const constructTrainingMatrix = (
  member: Member,
  sharedReadModel: SharedReadModel,
  quizData: FullQuizResultsForMember
): TrainingMatrix => {
  const matrix: Record<EquipmentId, TrainingMatrix[0]> = {};
  const equipmentList = sharedReadModel.equipment.getAll().toSorted(
    (a, b) => {
      if (a.area.id !== b.area.id) {
        return a.area.name.localeCompare(b.area.name, ['en-US']);
      }
      return a.name.localeCompare(b.name, ['en-US']);
    }
  );
  for (const equipment of equipmentList) {
    const quizResults = O.fromNullable(quizData.equipmentQuiz[equipment.id]);
    const isOwnerOfArea = O.fromNullable(member.ownerOf.find(o => o.id === equipment.area.id));
    const isTrainedOnEquipment = O.fromNullable(member.trainedOn.find(t => t.id === equipment.id));
    const isTrainerForEquipment = O.fromNullable(member.trainerFor.find(t => t.equipment_id === equipment.id));
    if (O.isNone(quizResults) && O.isNone(isOwnerOfArea) && O.isNone(isTrainedOnEquipment) && O.isNone(isTrainerForEquipment)) {
      continue;
    }
    matrix[equipment.id] = {
      equipment_id: equipment.id,
      equipment_name: equipment.name,
      equipment_quiz: pipe(
        quizResults,
        O.getOrElse<TrainingMatrix[0]['equipment_quiz']>(
          () => ({
            passedAt: [],
            attempted: [],
          })
        )
      ),
      is_owner: pipe(
       isOwnerOfArea,
       O.map(
        o => o.ownershipRecordedAt
       ) 
      ),
      is_trained: pipe(
        isTrainedOnEquipment,
        O.map(
          t => t.trainedAt
        )
      ),
      is_trainer: pipe(
        isTrainerForEquipment,
        O.map(
          t => t.since
        )
      ),
    };
  }

  return Object.values(matrix);
}
