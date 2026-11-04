import {BetterSQLite3Database} from 'drizzle-orm/better-sqlite3';
import {eq} from 'drizzle-orm';
import {UUID} from 'io-ts-types';
import {
  equipmentTrainingPrerequisitesTable,
  equipmentTrainingRequirementsTable,
} from '../state';

export type TrainingRequirements = {
  quizRequired: boolean;
  prerequisiteEquipmentIds: ReadonlyArray<UUID>;
};

// What a machine asks of a member before its practical: the quiz, unless an
// owner who trains on it has said otherwise, and nothing else unless they
// have named machines to be trained on first.
export const getTrainingRequirements =
  (db: BetterSQLite3Database) =>
  (equipmentId: UUID): TrainingRequirements => ({
    quizRequired:
      db
        .select({quizRequired: equipmentTrainingRequirementsTable.quizRequired})
        .from(equipmentTrainingRequirementsTable)
        .where(eq(equipmentTrainingRequirementsTable.equipmentId, equipmentId))
        .get()?.quizRequired ?? true,
    prerequisiteEquipmentIds: db
      .select({
        id: equipmentTrainingPrerequisitesTable.prerequisiteEquipmentId,
      })
      .from(equipmentTrainingPrerequisitesTable)
      .where(eq(equipmentTrainingPrerequisitesTable.equipmentId, equipmentId))
      .all()
      .map(row => row.id),
  });
