import {faker} from '@faker-js/faker';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {EventOfType} from '../../src/types/domain-event';
import pino from 'pino';
import * as RA from 'fp-ts/lib/ReadonlyArray';
import * as N from 'fp-ts/number';
import * as O from 'fp-ts/Option';
import * as gsheetData from '../data/google_sheet_data';
import {pullNewEquipmentQuizResults} from '../../src/read-models/shared-state/async-apply-external-event-sources';
import {localPullGoogleSheetData} from '../init-dependencies/pull-local-google';
import {
  EpochTimestampMilliseconds,
  Equipment,
} from '../../src/read-models/shared-state/return-types';
import {getSomeOrFail} from '../helpers';
import {EmailAddress} from '../../src/types';
import {getLatestEvent} from '../data/google_sheet_data';

const sortQuizResults = RA.sort({
  compare: (a, b) =>
    N.Ord.compare(
      (a as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochMS,
      (b as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochMS
    ),
  equals: (a, b) =>
    N.Ord.equals(
      (a as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochMS,
      (b as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochMS
    ),
});

const pullNewEquipmentQuizResultsLocal = async (equipment: Equipment) =>
  pullNewEquipmentQuizResults(
    pino({
      level: 'fatal',
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
    localPullGoogleSheetData,
    equipment
  )();

const defaultEquipment = (): Equipment => ({
  id: 'ebedee32-49f4-4d36-a350-4fa7848792bf' as UUID,
  name: 'Metal Lathe',
  trainers: [],
  trainedMembers: [],
  area: {
    id: 'f9cee7aa-75c6-42cc-8585-0e658044fe8e',
    name: 'Metal Shop',
  },
  membersAwaitingTraining: [],
  orphanedPassedQuizes: [],
  failedQuizAttempts: [],
  trainingSheetId: O.none,
  lastQuizResult: O.none,
  lastQuizSync: O.none,
});

const extractEvents = async (
  spreadsheetId: O.Option<string>,
  lastQuizResult: O.Option<EpochTimestampMilliseconds> = O.none
) => {
  const equipment = defaultEquipment();
  equipment.trainingSheetId = spreadsheetId;
  equipment.lastQuizResult = lastQuizResult;
  return await pullNewEquipmentQuizResultsLocal(equipment);
};

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
  data: gsheetData.ManualParsed,
  equipmentAfter: Equipment
) =>
  expect(getSomeOrFail(equipmentAfter.lastQuizResult)).toStrictEqual(
    getLatestEvent(data).timestampEpochMS
  );

describe('Training sheets worker', () => {
  describe('Process results', () => {
    describe('Processes a registered training sheet', () => {
      it('Equipment with no training sheet', async () => {
        expect(await extractEvents(O.none)).toHaveLength(0);
      });

      it('empty sheet produces no events', async () => {
        expect(
          await extractEvents(O.some(gsheetData.EMPTY.data.spreadsheetId!))
        ).toHaveLength(0);
      });
      it('metal lathe training sheet', async () => {
        const results = await extractEvents(
          O.some(gsheetData.METAL_LATHE.data.spreadsheetId!)
        );
        expect(results).toHaveLength(1);
        expect(results[0]).toMatchObject<
          Partial<EventOfType<'EquipmentTrainingQuizResult'>>
        >({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: defaultEquipment().id,
          trainingSheetId: gsheetData.METAL_LATHE.data.spreadsheetId!,
          ...gsheetData.METAL_LATHE.entries[0],
        });
      });
      it('training sheet with a summary page', async () => {
        const results = await extractEvents(
          O.some(gsheetData.LASER_CUTTER.data.spreadsheetId!)
        );
        const expected: readonly Partial<
          EventOfType<'EquipmentTrainingQuizResult'>
        >[] = gsheetData.LASER_CUTTER.entries.map(e => ({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: defaultEquipment().id,
          trainingSheetId: gsheetData.LASER_CUTTER.data.spreadsheetId!,
          actor: {
            tag: 'system',
          },
          ...e,
        }));
        expect(results).toHaveLength(expected.length);

        for (const [actualEvent, expectedEvent] of RA.zip(
          sortQuizResults(results),
          sortQuizResults(expected)
        )) {
          expect(actualEvent).toMatchObject<
            Partial<EventOfType<'EquipmentTrainingQuizResult'>>
          >(expectedEvent);
        }
      });
      it('training sheet with multiple response pages (different quiz questions)', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!)
        );
        const expected: readonly Partial<
          EventOfType<'EquipmentTrainingQuizResult'>
        >[] = gsheetData.BAMBU.entries.map(e => ({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: defaultEquipment().id,
          trainingSheetId: gsheetData.BAMBU.data.spreadsheetId!,
          actor: {
            tag: 'system',
          },
          ...e,
        }));
        expect(results).toHaveLength(expected.length);

        for (const [actualEvent, expectedEvent] of RA.zip(
          sortQuizResults(results),
          sortQuizResults(expected)
        )) {
          expect(actualEvent).toMatchObject<
            Partial<EventOfType<'EquipmentTrainingQuizResult'>>
          >(expectedEvent);
        }
      });
      it('Only take new rows, date in future', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!),
          O.some(Date.now() as EpochTimestampMilliseconds)
        );
        expect(results).toHaveLength(0);
      });
      it('Only take new rows, date in far past', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!),
          O.some(0 as EpochTimestampMilliseconds)
        );
        expect(results).toHaveLength(gsheetData.BAMBU.entries.length);
      });

      // The quiz results have dates:
      // 1700768963 Thursday, November 23, 2023 7:49:23 PM
      // 1700769348 Thursday, November 23, 2023 7:55:48 PM
      // 1710249052 Tuesday, March 12, 2024 1:10:52 PM
      // 1710249842 Tuesday, March 12, 2024 1:24:02 PM

      it('Only take new rows, exclude 1', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!),
          O.some(1700768963_000 as EpochTimestampMilliseconds)
        );
        expect(results).toHaveLength(3);
      });

      it('Only take new rows, exclude 2', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!),
          O.some(1700769348_000 as EpochTimestampMilliseconds)
        );
        expect(results).toHaveLength(2);
      });

      it('Only take new rows, exclude 3', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!),
          O.some(1710249052_000 as EpochTimestampMilliseconds)
        );
        expect(results).toHaveLength(1);
      });

      it('Only take new rows, exclude all (already have latest)', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!),
          O.some(1710249842_000 as EpochTimestampMilliseconds)
        );
        expect(results).toHaveLength(0);
      });
    });
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
          email: gsheetData.METAL_LATHE.entries[0]
            .emailProvided as EmailAddress,
        });
        const areaId = await addArea(framework);
        const bambu = await addWithSheet(
          framework,
          'bambu',
          areaId,
          O.some(gsheetData.BAMBU.data.spreadsheetId!)
        );
        const lathe = await addWithSheet(
          framework,
          'Metal Lathe',
          areaId,
          O.some(gsheetData.METAL_LATHE.data.spreadsheetId!)
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
        expect(
          bambuAfter.membersAwaitingTraining[0].memberNumber
        ).toStrictEqual(gsheetData.BAMBU.entries[0].memberNumberProvided);
        expect(
          bambuAfter.membersAwaitingTraining[0].emailAddress
        ).toStrictEqual(gsheetData.BAMBU.entries[0].emailProvided);
        expect(
          bambuAfter.membersAwaitingTraining[0].waitingSince
        ).toStrictEqual(
          new Date(getLatestEvent(gsheetData.BAMBU).timestampEpochMS)
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
          timestamp: new Date(
            gsheetData.METAL_LATHE.entries[0].timestampEpochMS
          ),
          quizAnswers: gsheetData.METAL_LATHE.entries[0].quizAnswers,
        });
      });
      // it('Handle no equipment', async () => {
      //   const framework = await initTestFramework(1000);
      //   const results = await runAsyncApplyExternalEventSources(framework);
      //   checkLastQuizSync(results);
      //   expect(results.equipmentAfter.size).toStrictEqual(0);
      // });
      // it('Handle equipment with no training sheet', async () => {
      //   const framework = await initTestFramework(1000);
      //   const areaId = await addArea(framework);
      //   const bambu = await addWithSheet(framework, 'bambu', areaId, O.none);
      //   const results = await runAsyncApplyExternalEventSources(framework);
      //   expect(
      //     results.equipmentAfter.get(bambu.id)!.lastQuizSync // No training sheet so not updated.
      //   ).toStrictEqual(O.none);
      //   expect(
      //     results.equipmentAfter.get(bambu.id)!.lastQuizResult
      //   ).toStrictEqual(O.none);
      //   expect(results.newEvents).toHaveLength(0);
      // });
      // it('Rate limit equipment pull', async () => {
      //   const framework = await initTestFramework(1000);
      //   const areaId = await addArea(framework);
      //   const bambu = await addWithSheet(
      //     framework,
      //     'bambu',
      //     areaId,
      //     O.some(gsheetData.BAMBU.data.spreadsheetId!)
      //   );
      //   const results1 = await runAsyncApplyExternalEventSources(framework);
      //   checkLastQuizSync(results1);
      //   const results2 = await runAsyncApplyExternalEventSources(framework);
      //   expect(
      //     results1.equipmentAfter.get(bambu.id)!.lastQuizSync
      //   ).toStrictEqual(results2.equipmentAfter.get(bambu.id)!.lastQuizSync);
      //   expect(results1.newEvents.length).toBeGreaterThan(0);
      //   expect(results2.newEvents).toHaveLength(0);
      // });
      // it('Repeat equipment pull no rate limit', async () => {
      //   const rateLimitMs = 100;
      //   const framework = await initTestFramework(rateLimitMs);
      //   const areaId = await addArea(framework);
      //   const bambu = await addWithSheet(
      //     framework,
      //     'bambu',
      //     areaId,
      //     O.some(gsheetData.BAMBU.data.spreadsheetId!)
      //   );
      //   const results1 = await runAsyncApplyExternalEventSources(framework);
      //   checkLastQuizSync(results1);

      //   await new Promise(res => setTimeout(res, rateLimitMs));
      //   const results2 = await runAsyncApplyExternalEventSources(framework);
      //   checkLastQuizSync(results2);
      //   expect(results1.equipmentAfter.get(bambu.id)!.lastQuizSync).not.toEqual(
      //     results2.equipmentAfter.get(bambu.id)!.lastQuizSync
      //   );
      //   expect(results1.newEvents.length).toBeGreaterThan(0);
      //   expect(results2.newEvents).toHaveLength(0);
      // });
    });
  });
});
