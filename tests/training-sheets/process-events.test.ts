import {faker} from '@faker-js/faker';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {EventOfType} from '../../src/types/domain-event';
import pino from 'pino';
import * as T from 'io-ts';
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
      it('Only take new rows', async () => {
        await framework.commands.equipment.trainingSheet({
          equipmentId: addEquipment.id,
          trainingSheetId: gsheetData.METAL_LATHE.data.spreadsheetId!,
        });
        await framework.commands.equipment.trainingSheetQuizResult({
          id: faker.string.uuid() as UUID,
          equipmentId: addEquipment.id,
          trainingSheetId: gsheetData.METAL_LATHE.data.spreadsheetId!,
          ...gsheetData.METAL_LATHE.entries[0],
        });
        deps = dependenciesForTrainingSheetsWorker(framework);
        await updateTrainingQuizResults(
          localPullGoogleSheetData,
          deps,
          deps.logger,
          0 as T.Int
        );
        expect(deps.commitedEvents).toHaveLength(0);
      });
      it('training sheet with a summary page', async () => {
        await framework.commands.equipment.trainingSheet({
          equipmentId: addEquipment.id,
          trainingSheetId: gsheetData.LASER_CUTTER.data.spreadsheetId!,
        });

        deps = dependenciesForTrainingSheetsWorker(framework);
        await updateTrainingQuizResults(
          localPullGoogleSheetData,
          deps,
          deps.logger,
          0 as T.Int
        );
        const expected: readonly Partial<
          EventOfType<'EquipmentTrainingQuizResult'>
        >[] = gsheetData.LASER_CUTTER.entries.map(e => ({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: addEquipment.id,
          trainingSheetId: gsheetData.LASER_CUTTER.data.spreadsheetId!,
          actor: {
            tag: 'system',
          },
          ...e,
        }));
        expect(deps.commitedEvents).toHaveLength(expected.length);

        for (const [actualEvent, expectedEvent] of RA.zip(
          sortQuizResults(deps.commitedEvents),
          sortQuizResults(expected)
        )) {
          expect(actualEvent).toMatchObject<
            Partial<EventOfType<'EquipmentTrainingQuizResult'>>
          >(expectedEvent);
        }
      });
      it('training sheet with multiple response pages (different quiz questions)', async () => {
        await framework.commands.equipment.trainingSheet({
          equipmentId: addEquipment.id,
          trainingSheetId: gsheetData.BAMBU.data.spreadsheetId!,
        });

        deps = dependenciesForTrainingSheetsWorker(framework);
        await updateTrainingQuizResults(
          localPullGoogleSheetData,
          deps,
          deps.logger,
          0 as T.Int
        );

        const expected: readonly Partial<
          EventOfType<'EquipmentTrainingQuizResult'>
        >[] = gsheetData.BAMBU.entries.map(e => ({
          type: 'EquipmentTrainingQuizResult',
          equipmentId: addEquipment.id,
          trainingSheetId: gsheetData.BAMBU.data.spreadsheetId!,
          actor: {
            tag: 'system',
          },
          ...e,
        }));
        expect(deps.commitedEvents).toHaveLength(expected.length);

        for (const [actualEvent, expectedEvent] of RA.zip(
          sortQuizResults(deps.commitedEvents),
          sortQuizResults(expected)
        )) {
          expect(actualEvent).toMatchObject<
            Partial<EventOfType<'EquipmentTrainingQuizResult'>>
          >(expectedEvent);
        }
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
});
