import {loadCachedSheetData} from '../../src/load-cached-sheet-data';
import {
  cacheSheetData,
  getCachedSheetData,
} from '../../src/init-dependencies/google/get-cached-sheet-data';
import pino from 'pino';
import {ensureCachedSheetDataTableExists} from '../../src/init-dependencies/google/ensure-cached-sheet-data-table-exists';
import {getRightOrFail, getSomeOrFail} from '../helpers';
import {constructEvent, EventOfType} from '../../src/types/domain-event';
import {NonEmptyString, UUID} from 'io-ts-types';
import {faker} from '@faker-js/faker';
import {initTestFramework, TestFramework} from '../read-models/test-framework';
import {EmailAddress} from '../../src/types';

describe('Load cached sheet data', () => {
  const createArea = {
    id: faker.string.uuid() as UUID,
    name: faker.airline.airport().name as NonEmptyString,
  };
  const linkMember = {
    memberNumber: faker.number.int(2000),
    email: 'foo@example.com' as EmailAddress,
  };
  const addEquipment = [
    {
      id: 'f7615644-3220-41ba-9cb4-0198520203a3' as UUID,
      name: faker.science.chemicalElement().name as NonEmptyString,
      areaId: createArea.id,
    },
    {
      id: 'aaaa5644-3220-4ccc-9cb4-ffff520203a3' as UUID,
      name: faker.science.chemicalElement().name as NonEmptyString,
      areaId: createArea.id,
    },
  ];
  const registerSheet = [
    {
      equipmentId: addEquipment[0].id,
      trainingSheetId: 'trainingSheet1',
    },
    {
      equipmentId: addEquipment[1].id,
      trainingSheetId: 'trainingSheet2',
    },
  ];

  let _loadCachedSheetData: ReturnType<typeof loadCachedSheetData>;
  let _cacheSheetData: ReturnType<typeof cacheSheetData>;
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
    getRightOrFail(
      await ensureCachedSheetDataTableExists(framework.eventStoreDb)()
    );
    const logger = pino();
    _cacheSheetData = cacheSheetData(framework.eventStoreDb);
    _loadCachedSheetData = loadCachedSheetData(
      getCachedSheetData(framework.eventStoreDb),
      logger,
      framework.sharedReadModel.updateState
    );

    await framework.commands.memberNumbers.linkNumberToEmail(linkMember);
    await framework.commands.area.create(createArea);
    await Promise.all(addEquipment.map(framework.commands.equipment.add));
    await Promise.all(
      registerSheet.map(framework.commands.equipment.trainingSheet)
    );
  });
  describe('Load previously cached data - 2 pieces of equipment', () => {
    const timestamp = new Date(2024, 1, 23, 4, 23, 45);
    const trainingQuizResults: ReadonlyArray<
      EventOfType<'EquipmentTrainingQuizResult'>
    > = [
      constructEvent('EquipmentTrainingQuizResult')({
        equipmentId: registerSheet[0].equipmentId,
        id: faker.string.uuid() as UUID,
        trainingSheetId: registerSheet[0].trainingSheetId,
        memberNumberProvided: linkMember.memberNumber,
        emailProvided: linkMember.email,
        score: 10,
        maxScore: 10,
        percentage: 100,
        timestampEpochMS: 1739133427000,
      }),
      constructEvent('EquipmentTrainingQuizResult')({
        equipmentId: registerSheet[1].equipmentId,
        id: faker.string.uuid() as UUID,
        trainingSheetId: registerSheet[1].trainingSheetId,
        memberNumberProvided: linkMember.memberNumber,
        emailProvided: linkMember.email,
        score: 7,
        maxScore: 10,
        percentage: 70,
        timestampEpochMS: 1739133422000,
      }),
    ];
    const trainingSyncEvents: ReadonlyArray<
      EventOfType<'EquipmentTrainingQuizSync'>
    > = [
      constructEvent('EquipmentTrainingQuizSync')({
        equipmentId: registerSheet[0].equipmentId,
      }),
      constructEvent('EquipmentTrainingQuizSync')({
        equipmentId: registerSheet[1].equipmentId,
      }),
    ];
    const data: {
      sheetId: string;
      timestamp: Date;
      data: ReadonlyArray<
        | EventOfType<'EquipmentTrainingQuizSync'>
        | EventOfType<'EquipmentTrainingQuizResult'>
      >;
    }[] = [
      {
        sheetId: registerSheet[0].trainingSheetId,
        timestamp,
        data: [trainingSyncEvents[0], trainingQuizResults[0]],
      },
      {
        sheetId: registerSheet[1].trainingSheetId,
        timestamp,
        data: [trainingSyncEvents[1], trainingQuizResults[1]],
      },
    ];
    beforeEach(async () => {
      await Promise.all(
        data.map(data =>
          _cacheSheetData(data.timestamp, data.sheetId, data.data)()
        )
      );
      await Promise.all(
        registerSheet.map(sheet =>
          _loadCachedSheetData(
            getSomeOrFail(
              framework.sharedReadModel.equipment.get(sheet.equipmentId)
            )
          )
        )
      );
    });

    it('Loads the last quiz sync time correctly', () => {
      for (let i = 0; i < registerSheet.length; i++) {
        expect(
          getSomeOrFail(
            getSomeOrFail(
              framework.sharedReadModel.equipment.get(
                registerSheet[i].equipmentId
              )
            ).lastQuizSync
          )
        ).toStrictEqual(trainingSyncEvents[i].recordedAt.getTime());
      }
    });

    it('Loads the training quiz results for first piece of equipment', () => {
      // Note we are only checking some attributes are as expected. The point of this test is not to check
      // everything - just enough that we verify the load from cache functionality is working as expected.
      const membersWaiting = getSomeOrFail(
        framework.sharedReadModel.equipment.get(registerSheet[0].equipmentId)
      ).membersAwaitingTraining;
      expect(membersWaiting).toHaveLength(1);
      expect(membersWaiting[0].memberNumber).toStrictEqual(
        linkMember.memberNumber
      );
      expect(membersWaiting[0].waitingSince).toStrictEqual(
        trainingQuizResults[0].recordedAt
      );
    });

    it('Loads the training quiz results for second piece of equipment', () => {
      const membersWaiting = getSomeOrFail(
        framework.sharedReadModel.equipment.get(registerSheet[1].equipmentId)
      ).membersAwaitingTraining;
      expect(membersWaiting).toHaveLength(1);
      expect(membersWaiting[0].memberNumber).toStrictEqual(
        linkMember.memberNumber
      );
      expect(membersWaiting[0].waitingSince).toStrictEqual(
        trainingQuizResults[1].recordedAt
      );
    });
  });
});
