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
import {Equipment} from '../../src/read-models/shared-state/return-types';
import {DateTime} from 'luxon';

const sortQuizResults = RA.sort({
  compare: (a, b) =>
    N.Ord.compare(
      (a as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochS,
      (b as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochS
    ),
  equals: (a, b) =>
    N.Ord.equals(
      (a as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochS,
      (b as EventOfType<'EquipmentTrainingQuizResult'>).timestampEpochS
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
  lastQuizResult: O.Option<DateTime> = O.none
) => {
  const equipment = defaultEquipment();
  equipment.trainingSheetId = spreadsheetId;
  equipment.lastQuizResult = lastQuizResult;
  return await pullNewEquipmentQuizResultsLocal(equipment);
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
          O.some(DateTime.now())
        );
        expect(results).toHaveLength(0);
      });
      it('Only take new rows, date in far past', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!),
          O.some(DateTime.fromSeconds(0))
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
          O.some(
            DateTime.fromObject({
              year: 2023,
              month: 11,
              day: 23,
              hour: 19,
              minute: 49,
              second: 23,
            })
          )
        );
        expect(results).toHaveLength(3);
      });

      it('Only take new rows, exclude 2', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!),
          O.some(
            DateTime.fromObject({
              year: 2023,
              month: 11,
              day: 23,
              hour: 19,
              minute: 55,
              second: 48,
            })
          )
        );
        expect(results).toHaveLength(2);
      });

      it('Only take new rows, exclude 3', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!),
          O.some(
            DateTime.fromObject({
              year: 2024,
              month: 3,
              day: 12,
              hour: 13,
              minute: 10,
              second: 52,
            })
          )
        );
        expect(results).toHaveLength(1);
      });

      it('Only take new rows, exclude all (already have latest)', async () => {
        const results = await extractEvents(
          O.some(gsheetData.BAMBU.data.spreadsheetId!),
          O.some(
            DateTime.fromObject({
              year: 2024,
              month: 3,
              day: 12,
              hour: 13,
              minute: 24,
              second: 2,
            })
          )
        );
        expect(results).toHaveLength(0);
      });
    });
    describe('Integration asyncApplyExternalEventSources', () => {
      let framework: TestFramework;
      const createArea = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
      };
      const addEquipment = {
        id: faker.string.uuid() as UUID,
        name: faker.company.buzzNoun() as NonEmptyString,
        areaId: createArea.id,
      };
      beforeEach(async () => {
        framework = await initTestFramework();
        await framework.commands.area.create(createArea);
        await framework.commands.equipment.add(addEquipment);
        await framework.commands.equipment.trainingSheet({
          equipmentId: addEquipment.id,
          trainingSheetId: gsheetData.EMPTY.data.spreadsheetId!,
        });
      });

      it('Check initial test state', () => {
        const equipment = framework.sharedReadModel.equipment.getAll();
        expect(equipment).toHaveLength(1);
      });

      it('Handle multiple equipment', () => {});
      it('Handle no equipment', () => {});
      it('Rate limit equipment pull', () => {});
    });
  });
});
