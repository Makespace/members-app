import {faker} from '@faker-js/faker';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';

import {EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';
import {getRightOrFail, getSomeOrFail} from '../../helpers';
import {
  FullQuizResults,
  getFullQuizResultsForEquipment,
} from '../../../src/read-models/external-state/equipment-quiz';
import {storeSync} from '../../../src/sync-worker/db/store_sync';
import {SheetDataTable} from '../../../src/sync-worker/google/sheet-data-table';

const runGetQuizResults = async (
  framework: TestFramework,
  trainingSheetId: string,
  equipmentId: UUID
) =>
  getRightOrFail(
    await getFullQuizResultsForEquipment(
      {
        sharedReadModel: framework.sharedReadModel,
        lastQuizSync: framework.lastSync,
        getSheetData: framework.getSheetData,
      },
      trainingSheetId,
      getSomeOrFail(framework.sharedReadModel.equipment.get(equipmentId))
    )()
  );

const populateQuizData = async (
  framework: TestFramework,
  syncDate: Date,
  entries: SheetDataTable['rows']
) => {
  getRightOrFail(await framework.storeTrainingSheetRowsRead(entries)());
  for (const trainingSheetId of new Set(entries.map(m => m.sheet_id))) {
    getRightOrFail(
      await storeSync(framework.googleDB)(trainingSheetId, syncDate)()
    );
  }
};

describe('Get equipment quiz', () => {
  let framework: TestFramework;
  const addTrainedMember = {
    memberNumber: faker.number.int() as Int,
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
  };
  const addAwaitingTrainingMember = {
    memberNumber: faker.number.int({max: 10000}) as Int,
    email: faker.internet.email() as EmailAddress,
    name: undefined,
    formOfAddress: undefined,
  };
  const createArea = {
    id: faker.string.uuid() as UUID,
    name: faker.airline.airport().name as NonEmptyString,
  };
  const addEquipment = {
    id: faker.string.uuid() as UUID,
    name: faker.science.chemicalElement().name as NonEmptyString,
    areaId: createArea.id,
  };
  const markTrained = {
    equipmentId: addEquipment.id,
    memberNumber: addTrainedMember.memberNumber,
  };
  const addTrainingSheet = {
    equipmentId: addEquipment.id,
    trainingSheetId: 'testTrainingSheetId',
  };

  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  describe('when equipment has 1 trained member and 1 member awaiting training', () => {
    let quizResults: FullQuizResults;
    let quizSyncDate: Date;
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail(
        addTrainedMember
      );
      await framework.commands.memberNumbers.linkNumberToEmail(
        addAwaitingTrainingMember
      );
      await framework.commands.area.create(createArea);
      await framework.commands.equipment.add(addEquipment);
      await framework.commands.trainers.markTrained(markTrained);
      await framework.commands.equipment.trainingSheet(addTrainingSheet);
      quizSyncDate = faker.date.past();
      await populateQuizData(framework, quizSyncDate, [
        {
          sheet_id: addTrainingSheet.trainingSheetId,
          sheet_name: faker.animal.bear(),
          row_index: 2, // 1 is the sheet headers.
          response_submitted: faker.date.past(),
          member_number_provided: addTrainedMember.memberNumber,
          email_provided: addTrainedMember.email,
          score: 10,
          max_score: 10,
          percentage: 100,
          cached_at: new Date(),
        },
        {
          sheet_id: addTrainingSheet.trainingSheetId,
          sheet_name: faker.animal.bear(),
          row_index: 3,
          response_submitted: faker.date.past(),
          member_number_provided: addAwaitingTrainingMember.memberNumber,
          email_provided: addAwaitingTrainingMember.email,
          score: 10,
          max_score: 10,
          percentage: 100,
          cached_at: new Date(),
        },
      ]);
      quizResults = await runGetQuizResults(
        framework,
        addTrainingSheet.trainingSheetId,
        addTrainingSheet.equipmentId
      );
    });

    it('only 1 member appears as awaiting training', () => {
      expect(
        quizResults.membersAwaitingTraining.map(m => m.memberNumber)
      ).toStrictEqual([addAwaitingTrainingMember.memberNumber]);
    });
    it('last quiz sync matches expected', () => {
      expect(getSomeOrFail(quizResults.lastQuizSync)).toStrictEqual(
        quizSyncDate
      );
    });

    it('no failed quizes', () => {
      expect(quizResults.failedQuizes).toStrictEqual([]);
    });
    it('no unknown member passes', () => {
      expect(quizResults.unknownMembersAwaitingTraining).toStrictEqual([]);
    });
  });
});
