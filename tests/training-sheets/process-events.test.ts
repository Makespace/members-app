import {faker} from '@faker-js/faker';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {DomainEvent, EventOfType} from '../../src/types/domain-event';
import pino, {Logger} from 'pino';
import * as RA from 'fp-ts/lib/ReadonlyArray';
import * as N from 'fp-ts/number';
import * as O from 'fp-ts/Option';
import * as gsheetData from '../data/google_sheet_data';
import {
  asyncApplyExternalEventSources,
  pullNewEquipmentQuizResults,
} from '../../src/read-models/shared-state/async-apply-external-event-sources';
import {localPullGoogleSheetData} from '../init-dependencies/pull-local-google';
import {
  EpochTimestampMilliseconds,
  Equipment,
} from '../../src/read-models/shared-state/return-types';
import {DateTime} from 'luxon';
import {getSomeOrFail} from '../helpers';

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
  id: 'ebedee32-49f4-4d36-a350-4fa7848792bf',
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

const runAsyncApplyExternalEventSources = async (
  logger: Logger,
  framework: TestFramework
) => {
  const startTime = DateTime.utc().toSeconds();
  const newEvents: DomainEvent[] = [];
  await asyncApplyExternalEventSources(
    logger,
    framework.sharedReadModel.db,
    localPullGoogleSheetData,
    newEvents.push
  )()();
  const endTime = DateTime.utc().toSeconds();
  const equipmentAfter = new Map(
    framework.sharedReadModel.equipment.getAll().map(e => [e.id, e])
  );
  // Check that the last quiz sync property is updated to reflect
  // that a quiz sync was preformed.
  for (const equipment of equipmentAfter.values()) {
    expect(equipment.lastQuizSync).toBeGreaterThan(startTime);
    expect(equipment.lastQuizSync).toBeLessThan(endTime);
  }
  return {
    startTime,
    newEvents,
    endTime,
    equipmentAfter,
  };
};

const checkLastQuizEventTimestamp = (
  data: gsheetData.ManualParsed,
  equipmentAfter: Equipment
) => {
  const latestEvent = data.entries.sort(
    (a, b) => a.timestampEpochMS - b.timestampEpochMS
  )[data.entries.length - 1];
  expect(getSomeOrFail(equipmentAfter.lastQuizResult)).toStrictEqual(
    latestEvent.timestampEpochMS
  );
};

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
          equipmentId: defaultEquipment().id as UUID,
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
          equipmentId: defaultEquipment().id as UUID,
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
          equipmentId: defaultEquipment().id as UUID,
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
      let framework: TestFramework;
      let logger: Logger;
      const createArea = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
      };
      beforeEach(async () => {
        logger = pino({level: 'silent'});
        framework = await initTestFramework();
        await framework.commands.area.create(createArea);
      });

      const addWithSheet = async (
        name: string,
        areaId: UUID,
        trainingSheetId: string
      ) => {
        const equipment = {
          id: faker.string.uuid() as UUID,
          name: name as NonEmptyString,
          areaId,
        };
        await framework.commands.equipment.add(equipment);
        await framework.commands.equipment.trainingSheet({
          equipmentId: equipment.id,
          trainingSheetId,
        });
        return {
          ...equipment,
          trainingSheetId,
        };
      };

      it('Handle multiple equipment both populated', async () => {
        const bambu = await addWithSheet(
          'bambu',
          createArea.id,
          gsheetData.BAMBU.data.spreadsheetId!
        );
        const lathe = await addWithSheet(
          'Metal Lathe',
          createArea.id,
          gsheetData.METAL_LATHE.data.spreadsheetId!
        );
        const results = await runAsyncApplyExternalEventSources(
          logger,
          framework
        );
        checkLastQuizEventTimestamp(
          gsheetData.BAMBU,
          results.equipmentAfter.get(bambu.id)!
        );
        checkLastQuizEventTimestamp(
          gsheetData.METAL_LATHE,
          results.equipmentAfter.get(lathe.id)!
        );
        expect(results['newEvents']).toHaveLength(
          gsheetData.BAMBU.entries.length +
            gsheetData.METAL_LATHE.entries.length
        );
      });
      it('Handle no equipment', async () => {
        const results = await runAsyncApplyExternalEventSources(
          logger,
          framework
        );
        expect(results.equipmentAfter).toHaveLength(0);
      });
      it('Rate limit equipment pull', () => {});
      it('Handle equipment in different areas', () => {});
    });
  });
});
