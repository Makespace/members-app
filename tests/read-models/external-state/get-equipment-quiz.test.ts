import {faker} from '@faker-js/faker';
import {TestFramework, initTestFramework} from '../test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';

import {EmailAddress} from '../../../src/types';
import {Int} from 'io-ts';
import {getRightOrFail, getSomeOrFail} from '../../helpers';
import {
  FullQuizResultsForEquipment,
  FullQuizResultsForMember,
  getFullQuizResultsForEquipment,
  getFullQuizResultsForMember,
} from '../../../src/read-models/external-state/equipment-quiz';
import {storeSync} from '../../../src/sync-worker/db/store_sync';
import {SheetDataTable} from '../../../src/sync-worker/google/sheet-data-table';

const runGetQuizResultsByEquipment = async (
  framework: TestFramework,
  trainingSheetId: string,
  equipmentId: UUID,
): Promise<FullQuizResultsForEquipment> => getRightOrFail(
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

const runGetQuizResultsByMemberNumber = async (
  framework: TestFramework,
  memberNumber: number,
): Promise<FullQuizResultsForMember> => getRightOrFail(
  await getFullQuizResultsForMember(
    {
      sharedReadModel: framework.sharedReadModel,
      getSheetDataByMemberNumber: framework.getSheetDataByMemberNumber,
    },
    memberNumber
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
    let quizSyncDate: Date;

    const trainedMemberQuizAttempt: SheetDataTable["rows"][0] = {
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
    };
    const awaitingTrainingMemberQuizAttempt: SheetDataTable["rows"][0] = {
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
    };

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
        trainedMemberQuizAttempt,
        awaitingTrainingMemberQuizAttempt
      ]);
    });

    describe('getFullQuizResultsForEquipment', () => {
      let quizResultsByEquipment: FullQuizResultsForEquipment;
      beforeEach(async () => {
        quizResultsByEquipment = await runGetQuizResultsByEquipment(
          framework,
          addTrainingSheet.trainingSheetId,
          addTrainingSheet.equipmentId
        );
      });
      it('only 1 member appears as awaiting training', () => {
        expect(
          quizResultsByEquipment.membersAwaitingTraining.map(m => m.memberNumber)
        ).toStrictEqual([addAwaitingTrainingMember.memberNumber]);
      });
      it('last quiz sync matches expected', () => {
        expect(getSomeOrFail(quizResultsByEquipment.lastQuizSync)).toStrictEqual(
          quizSyncDate
        );
      });

      it('no failed quizes', () => {
        expect(quizResultsByEquipment.failedQuizes).toStrictEqual([]);
      });
      it('no unknown member passes', () => {
        expect(quizResultsByEquipment.unknownMembersAwaitingTraining).toStrictEqual([]);
      });
    });

    describe('quizResultsByMember', () => {
      let quizResultsForTrainedMember: FullQuizResultsForMember;
      let quizResultsForMemberAwaitingTraining: FullQuizResultsForMember;

      beforeEach(async () => {
        quizResultsForTrainedMember = await runGetQuizResultsByMemberNumber(
          framework,
          addTrainedMember.memberNumber
        );
        quizResultsForMemberAwaitingTraining = await runGetQuizResultsByMemberNumber(
          framework,
          addAwaitingTrainingMember.memberNumber
        );
      });
      it('shows the trained member as having passed the quiz', () => {
        expect(quizResultsForTrainedMember.equipmentQuizPassedAt[addEquipment.id]).toStrictEqual(
          [trainedMemberQuizAttempt.response_submitted]
        );
      });
      it('shows the trained member as having no other quiz attempts', () => {
        expect(quizResultsForTrainedMember.equipmentQuizAttempted).toStrictEqual({});
      });
      it('shows the member awaiting training as having passed the quiz', () => {
        expect(quizResultsForMemberAwaitingTraining.equipmentQuizPassedAt[addEquipment.id]).toStrictEqual(
          [awaitingTrainingMemberQuizAttempt.response_submitted]
        );
      });
      it('shows the member awaiting training as having no other quiz attempts', () => {
        expect(quizResultsForMemberAwaitingTraining.equipmentQuizAttempted).toStrictEqual({});
      });
    });
  });
});
