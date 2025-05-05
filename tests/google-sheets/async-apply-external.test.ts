import * as O from 'fp-ts/Option';
import {NonEmptyString, UUID} from 'io-ts-types';
import {faker} from '@faker-js/faker';
import * as gsheetData from '../data/google_sheet_data';
import {initTestFramework, TestFramework} from '../read-models/test-framework';
import {EmailAddress} from '../../src/types';
import {getRightOrFail, getSomeOrFail} from '../helpers';
import {
  EpochTimestampMilliseconds,
  Equipment,
} from '../../src/read-models/shared-state/return-types';
import {EventOfType} from '../../src/types/domain-event';

describe('Integration asyncApplyExternalEventSources', () => {
  const addArea = async (framework: TestFramework) => {
    const createArea = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    await framework.commands.area.create(createArea);
    return createArea.id;
  };

  const addWithSheet = async (
    framework: TestFramework,
    name: string,
    areaId: UUID,
    trainingSheetId: O.Option<string>
  ) => {
    const equipment = {
      id: faker.string.uuid() as UUID,
      name: name as NonEmptyString,
      areaId,
    };
    await framework.commands.equipment.add(equipment);
    if (O.isSome(trainingSheetId)) {
      await framework.commands.equipment.trainingSheet({
        equipmentId: equipment.id,
        trainingSheetId: trainingSheetId.value,
      });
    }
    return {
      ...equipment,
      trainingSheetId,
    };
  };

  it('Handle multiple equipment both populated', async () => {
    const framework = await initTestFramework(1000);

    // Create the users which the results are registered too.
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: gsheetData.BAMBU.entries[0].memberNumberProvided,
      email: gsheetData.BAMBU.entries[0].emailProvided as EmailAddress,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: gsheetData.METAL_LATHE.entries[0].memberNumberProvided,
      email: gsheetData.METAL_LATHE.entries[0].emailProvided as EmailAddress,
    });
    const areaId = await addArea(framework);
    const bambu = await addWithSheet(
      framework,
      'bambu',
      areaId,
      O.some(gsheetData.BAMBU.apiResp.spreadsheetId!)
    );
    const lathe = await addWithSheet(
      framework,
      'Metal Lathe',
      areaId,
      O.some(gsheetData.METAL_LATHE.apiResp.spreadsheetId!)
    );
    const results = await runAsyncApplyExternalEventSources(framework);
    checkLastQuizSyncUpdated(results);
    checkLastQuizEventTimestamp(
      gsheetData.BAMBU,
      results.equipmentAfter.get(bambu.id)!
    );
    checkLastQuizEventTimestamp(
      gsheetData.METAL_LATHE,
      results.equipmentAfter.get(lathe.id)!
    );

    // We already test the produced quiz result events above
    // and testing updateState is also tested elsewhere so this integration
    // test doesn't need to enumerate every combination it just needs to check
    // that generally the equipment is getting updated.
    const bambuAfter = results.equipmentAfter.get(bambu.id)!;
    expect(bambuAfter.orphanedPassedQuizes).toHaveLength(0);
    expect(bambuAfter.membersAwaitingTraining).toHaveLength(1);
    expect(bambuAfter.membersAwaitingTraining[0].memberNumber).toStrictEqual(
      gsheetData.BAMBU.entries[0].memberNumberProvided
    );
    expect(bambuAfter.membersAwaitingTraining[0].emailAddress).toStrictEqual(
      gsheetData.BAMBU.entries[0].emailProvided
    );
    expect(bambuAfter.membersAwaitingTraining[0].waitingSince).toStrictEqual(
      new Date(gsheetData.getLatestEvent(gsheetData.BAMBU).timestampEpochMS)
    );

    // Lathe results only have a single failed entry.
    const latheAfter = results.equipmentAfter.get(lathe.id)!;
    expect(latheAfter.orphanedPassedQuizes).toHaveLength(0);
    expect(latheAfter.failedQuizAttempts).toHaveLength(1);
    expect(latheAfter.failedQuizAttempts[0]).toMatchObject({
      emailAddress: gsheetData.METAL_LATHE.entries[0]
        .emailProvided as EmailAddress,
      memberNumber: gsheetData.METAL_LATHE.entries[0].memberNumberProvided,
      score: gsheetData.METAL_LATHE.entries[0].score,
      maxScore: gsheetData.METAL_LATHE.entries[0].maxScore,
      percentage: gsheetData.METAL_LATHE.entries[0].percentage,
      timestamp: new Date(gsheetData.METAL_LATHE.entries[0].timestampEpochMS),
    });

    framework.eventStoreDb.close();
  });
  it('Handle no equipment', async () => {
    const framework = await initTestFramework(1000);
    const results = await runAsyncApplyExternalEventSources(framework);
    checkLastQuizSyncUpdated(results);
    expect(results.equipmentAfter.size).toStrictEqual(0);

    framework.eventStoreDb.close();
  });
  it('Handle equipment with no training sheet', async () => {
    const framework = await initTestFramework(1000);
    const areaId = await addArea(framework);
    const bambu = await addWithSheet(framework, 'bambu', areaId, O.none);
    const results = await runAsyncApplyExternalEventSources(framework);
    expect(
      results.equipmentAfter.get(bambu.id)!.lastQuizSync // No training sheet so not updated.
    ).toStrictEqual(O.none);
    expect(results.equipmentAfter.get(bambu.id)!.lastQuizResult).toStrictEqual(
      O.none
    );

    framework.eventStoreDb.close();
  });
  it('Rate limit equipment pull', async () => {
    const framework = await initTestFramework(1000);
    const areaId = await addArea(framework);
    const bambu = await addWithSheet(
      framework,
      'bambu',
      areaId,
      O.some(gsheetData.BAMBU.apiResp.spreadsheetId!)
    );
    const results1 = await runAsyncApplyExternalEventSources(framework);
    checkLastQuizSyncUpdated(results1);
    const results2 = await runAsyncApplyExternalEventSources(framework);
    expect(results1.equipmentAfter.get(bambu.id)!.lastQuizSync).toStrictEqual(
      results2.equipmentAfter.get(bambu.id)!.lastQuizSync
    );

    framework.eventStoreDb.close();
  });
  describe('Repeat equipment pull no rate limit', () => {
    let framework: TestFramework;
    let results1: ApplyExternalEventsResults;
    let cachedData1: ReadonlyArray<
      | EventOfType<'EquipmentTrainingQuizResult'>
      | EventOfType<'EquipmentTrainingQuizSync'>
    >;
    let results2: ApplyExternalEventsResults;
    let cachedData2: ReadonlyArray<
      | EventOfType<'EquipmentTrainingQuizResult'>
      | EventOfType<'EquipmentTrainingQuizSync'>
    >;
    let equipment: {id: UUID; trainingSheetId: O.Option<string>};

    beforeEach(async () => {
      const rateLimitMs = 100;
      framework = await initTestFramework(rateLimitMs);
      const areaId = await addArea(framework);
      equipment = await addWithSheet(
        framework,
        'bambu',
        areaId,
        O.some(gsheetData.BAMBU.apiResp.spreadsheetId!)
      );
      results1 = await runAsyncApplyExternalEventSources(framework);
      cachedData1 = getRightOrFail(
        getSomeOrFail(
          getRightOrFail(
            await framework.getCachedSheetData(
              getSomeOrFail(equipment.trainingSheetId)
            )()
          )
        ).cached_data
      );
      await new Promise(res => setTimeout(res, rateLimitMs * 2)); // The rate limit varies between [rateLimitMs, 2 * rateLimitMs] to spread cpu load.
      results2 = await runAsyncApplyExternalEventSources(framework);
      cachedData2 = getRightOrFail(
        getSomeOrFail(
          getRightOrFail(
            await framework.getCachedSheetData(
              getSomeOrFail(equipment.trainingSheetId)
            )()
          )
        ).cached_data
      );
    });
    afterEach(() => {
      framework.eventStoreDb.close();
    });

    it('updates the last quiz sync both times indicating a sync both times', () => {
      checkLastQuizSyncUpdated(results1);
      checkLastQuizSyncUpdated(results2);
      expect(
        results1.equipmentAfter.get(equipment.id)!.lastQuizSync
      ).not.toEqual(results2.equipmentAfter.get(equipment.id)!.lastQuizSync);
    });

    it('Cached data is the same after both runs', () => {
      // The source (our simulated google endpoint using local data) doesn't change so we should cache the same
      // number of events both times.
      expect(cachedData1.length).toBeGreaterThan(1); // At least 1 event is the sync event then x more events from the data source.
      expect(cachedData2.length).toStrictEqual(cachedData1.length);
    });
  });
});

type ApplyExternalEventsResults = {
  startTime: EpochTimestampMilliseconds;
  endTime: EpochTimestampMilliseconds;
  equipmentAfter: Map<string, Equipment>;
};

const runAsyncApplyExternalEventSources = async (
  framework: TestFramework
): Promise<ApplyExternalEventsResults> => {
  const startTime = Date.now() as EpochTimestampMilliseconds;
  await framework.sharedReadModel.asyncApplyExternalEventSources()();
  const endTime = Date.now() as EpochTimestampMilliseconds;
  const equipmentAfter = new Map(
    framework.sharedReadModel.equipment.getAll().map(e => [e.id, e])
  );
  return {
    startTime,
    endTime,
    equipmentAfter,
  };
};

const checkLastQuizSyncUpdated = (results: ApplyExternalEventsResults) => {
  // Check that the last quiz sync property is updated to reflect
  // that a quiz sync was preformed.
  for (const equipment of results.equipmentAfter.values()) {
    expect(getSomeOrFail(equipment.lastQuizSync)).toBeGreaterThanOrEqual(
      results.startTime
    );
    expect(getSomeOrFail(equipment.lastQuizSync)).toBeLessThanOrEqual(
      results.endTime
    );
  }
};

const checkLastQuizEventTimestamp = (
  data: gsheetData.ManualParsed<gsheetData.ManualParsedTrainingSheetEntry>,
  equipmentAfter: Equipment
) =>
  expect(getSomeOrFail(equipmentAfter.lastQuizResult)).toStrictEqual(
    gsheetData.getLatestEvent(data).timestampEpochMS
  );
