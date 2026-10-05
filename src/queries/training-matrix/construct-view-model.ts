import * as O from 'fp-ts/Option';
import { TrainingMatrix } from '../training-matrix/render';
import { FullQuizResultsForMember } from '../../read-models/external-state/equipment-quiz';
import { Member, MinimalArea } from '../../read-models/shared-state/return-types';
import { pipe } from 'fp-ts/lib/function';
import { SharedReadModel } from '../../read-models/shared-state';
import { UUID } from 'io-ts-types';

export const constructTrainingMatrix = (
  member: Member,
  sharedReadModel: SharedReadModel,
  quizData: FullQuizResultsForMember
): TrainingMatrix => {
  // Minimal equipment rows plus an area map: the full equipment view expands
  // every machine's trainers and trained members (with their member details),
  // work proportional to the whole membership that this matrix never consumes
  // (issue #414; same approach as the ticket board).
  const areasById = new Map<UUID, MinimalArea>(
    sharedReadModel.area.getAllMinimal().map(area => [area.id, area] as const)
  );
  // Matches the old expansion's fallback for a machine whose area row is
  // missing (foreign keys make that hard to reach; kept for parity).
  const areaFor = (areaId: UUID): MinimalArea =>
    areasById.get(areaId) ?? {id: areaId, name: 'unknown', email: O.none};

  const equipmentList = sharedReadModel.equipment.getAllMinimal().toSorted(
    (a, b) => {
      if (a.areaId !== b.areaId) {
        return areaFor(a.areaId).name.localeCompare(areaFor(b.areaId).name, ['en-US']);
      }
      return a.name.localeCompare(b.name, ['en-US']);
    }
  );

  const equipmentEntries = equipmentList.flatMap(
    equipment => {
      const area = areaFor(equipment.areaId);
      const quizResults = O.fromNullable(quizData.equipmentQuiz[equipment.id]);
      const isOwnerOfArea = O.fromNullable(member.ownerOf.find(o => o.id === equipment.areaId));
      const isTrainedOnEquipment = O.fromNullable(member.trainedOn.find(t => t.id === equipment.id));
      const isTrainerForEquipment = O.fromNullable(member.trainerFor.find(t => t.equipment_id === equipment.id));
      if (O.isNone(quizResults) && O.isNone(isOwnerOfArea) && O.isNone(isTrainedOnEquipment) && O.isNone(isTrainerForEquipment)) {
        return [];
      }
      return [{
        equipment_id: equipment.id,
        equipment_name: equipment.name,
        area: {
          ...area,
          is_owner: pipe(isOwnerOfArea, O.map(o => o.ownershipRecordedAt)),
        },
        equipment_quiz: pipe(
          quizResults,
          O.getOrElse<TrainingMatrix[0]['equipment'][0]['equipment_quiz']>(
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
      }];
    }
  );

  const result: {
    area: TrainingMatrix[0]['area'],
    equipment: TrainingMatrix[0]['equipment'][0][],
  }[] = [];
  let currentArea: O.Option<typeof result[0]> = O.none;
  for (const entry of equipmentEntries) {
    // We know these are sorted by area then equipment name.
    if (O.isNone(currentArea)) {
      // First entry.
      currentArea = O.some({
        area: entry.area,
        equipment: [entry],
      });
      continue;
    }

    if (currentArea.value.area.id !== entry.area.id) {
      // We must have moved onto a new area.
      result.push(currentArea.value);
      currentArea = O.some({
        area: entry.area,
        equipment: [entry],
      });
      continue
    }

    // We must still be aggregating the current area.
    currentArea.value.equipment.push(entry);
  }

  if (O.isSome(currentArea)) {
    result.push(currentArea.value);
  }

  for (const ownerOfArea of member.ownerOf) {
    if (result.some(area => area.area.id === ownerOfArea.id)) {
      continue;
    }

    result.push({
      area: {
        id: ownerOfArea.id as TrainingMatrix[0]['area']['id'],
        name: ownerOfArea.name,
        is_owner: O.some(ownerOfArea.ownershipRecordedAt),
      },
      equipment: [],
    });
  }

  return result.toSorted((a, b) => a.area.name.localeCompare(b.area.name, ['en-US']));
}
