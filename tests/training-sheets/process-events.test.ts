import {faker} from '@faker-js/faker';
import * as TE from 'fp-ts/TaskEither';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {
  DomainEvent,
  EventName,
  EventOfType,
} from '../../src/types/domain-event';
import {happyPathAdapters} from '../init-dependencies/happy-path-adapters.helper';
import {updateTrainingQuizResults} from '../../src/training-sheets/training-sheets-worker';
import {Dependencies} from '../../src/dependencies';
import {Resource} from '../../src/types/resource';
import pino, {Logger} from 'pino';
import {failureWithStatus} from '../../src/types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import * as gsheetData from '../data/google_sheet_data';
import {ResourceVersion} from '../../src/types';
import * as O from 'fp-ts/Option';
import * as T from 'io-ts';
import * as RA from 'fp-ts/lib/ReadonlyArray';
import * as N from 'fp-ts/number';

type TrainingSheetWorkerDependencies = Dependencies & {
  commitedEvents: DomainEvent[];
};

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

const dependenciesForTrainingSheetsWorker = (
  framework: TestFramework
): TrainingSheetWorkerDependencies => {
  const commitedEvents: DomainEvent[] = [];
  return {
    ...happyPathAdapters,
    logger: pino({
      level: 'error',
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
    commitedEvents,
    commitEvent:
      (resource: Resource, lastKnownVersion: ResourceVersion) =>
      (event: DomainEvent) => {
        commitedEvents.push(event);
        return happyPathAdapters.commitEvent(resource, lastKnownVersion)(event);
      },
    getAllEventsByType: <T extends EventName>(eventType: T) =>
      TE.tryCatch(
        () => framework.getAllEventsByType(eventType),
        failureWithStatus(
          'Failed to get events from test framework',
          StatusCodes.INTERNAL_SERVER_ERROR
        )
      ),
    updateTrainingQuizResults: O.none,
  };
};

const localPullGoogleSheetData = (logger: Logger, trainingSheetId: string) => {
  logger.debug(`Pulling local google sheet '${trainingSheetId}'`);
  const sheet = gsheetData.TRAINING_SHEETS[trainingSheetId].data;
  return sheet
    ? TE.right(sheet)
    : TE.left({
        message: 'Sheet not found',
      });
};

describe('Training sheets worker', () => {
  describe('Process results', () => {
    let framework: TestFramework;
    beforeEach(async () => {
      framework = await initTestFramework();
    });

    describe('Existing area + equipment', () => {
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
        await framework.commands.area.create(createArea);
        await framework.commands.equipment.add(addEquipment);
      });

      describe('Processes a registered training sheet', () => {
        let deps: TrainingSheetWorkerDependencies;
        it('empty sheet produces no events', async () => {
          await framework.commands.equipment.trainingSheet({
            equipmentId: addEquipment.id,
            trainingSheetId: gsheetData.EMPTY.data.spreadsheetId!,
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
        it('metal lathe training sheet', async () => {
          await framework.commands.equipment.trainingSheet({
            equipmentId: addEquipment.id,
            trainingSheetId: gsheetData.METAL_LATHE.data.spreadsheetId!,
          });

          deps = dependenciesForTrainingSheetsWorker(framework);
          await updateTrainingQuizResults(
            localPullGoogleSheetData,
            deps,
            deps.logger,
            0 as T.Int
          );
          expect(deps.commitedEvents).toHaveLength(1);
          const commitedEvent = deps.commitedEvents[0];
          expect(commitedEvent).toMatchObject<
            Partial<EventOfType<'EquipmentTrainingQuizResult'>>
          >({
            type: 'EquipmentTrainingQuizResult',
            equipmentId: addEquipment.id,
            trainingSheetId: gsheetData.METAL_LATHE.data.spreadsheetId!,
            ...gsheetData.METAL_LATHE.entries[0],
          });
        });
        it('Handle already registered quiz results', async () => {
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
        it('Rate limit prevent double update', async () => {
          await framework.commands.equipment.trainingSheet({
            equipmentId: addEquipment.id,
            trainingSheetId: gsheetData.EMPTY.data.spreadsheetId!,
          });
          deps = dependenciesForTrainingSheetsWorker(framework);

          let timesCalled = 0;
          const callCountWrapper = (
            logger: Logger,
            trainingSheetId: string
          ) => {
            timesCalled++;
            return localPullGoogleSheetData(logger, trainingSheetId);
          };

          await updateTrainingQuizResults(
            callCountWrapper,
            deps,
            deps.logger,
            0 as T.Int
          );

          await updateTrainingQuizResults(
            callCountWrapper,
            deps,
            deps.logger,
            (60 * 1000) as T.Int // Period won't has elapsed since last call.
          );

          expect(timesCalled).toEqual(1);
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
      });
    });
  });
});
