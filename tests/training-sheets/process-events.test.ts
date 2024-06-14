import {faker} from '@faker-js/faker';
import * as TE from 'fp-ts/TaskEither';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {DomainEvent, EventName} from '../../src/types/domain-event';
import {happyPathAdapters} from '../init-dependencies/happy-path-adapters.helper';
import {run} from '../../src/training-sheets/training-sheets-worker';
import {Dependencies} from '../../src/dependencies';
import {Resource} from '../../src/types/resource';
import pino, {Logger} from 'pino';
import {failureWithStatus} from '../../src/types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import * as gsheetData from '../data/google_sheet_data';

type TrainingSheetWorkerDependencies = Dependencies & {
  commitedEvents: DomainEvent[];
};

const dependenciesForTrainingSheetsWorker = (
  framework: TestFramework
): TrainingSheetWorkerDependencies => {
  const commitedEvents: DomainEvent[] = [];
  return {
    ...happyPathAdapters,
    logger: pino({
      level: 'trace',
      timestamp: pino.stdTimeFunctions.isoTime,
    }),
    commitedEvents,
    commitEvent:
      (resource: Resource, lastKnownVersion: number) =>
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    pullGoogleSheetData: (_logger: Logger, trainingSheetId: string) => {
      const sheet = gsheetData.TRAINING_SHEETS[trainingSheetId];
      return sheet
        ? TE.right(sheet)
        : TE.left({
            message: 'Sheet not found',
          });
    },
  };
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
          await framework.commands.equipment.training_sheet({
            equipmentId: addEquipment.id,
            trainingSheetId: gsheetData.EMPTY.spreadsheetId!,
          });

          deps = dependenciesForTrainingSheetsWorker(framework);
          await run(deps, deps.logger);
          expect(deps.commitedEvents).toHaveLength(0);
        });
        it('metal lathe training sheet', async () => {
          await framework.commands.equipment.training_sheet({
            equipmentId: addEquipment.id,
            trainingSheetId: gsheetData.METAL_LATHE.spreadsheetId!,
          });

          deps = dependenciesForTrainingSheetsWorker(framework);
          await run(deps, deps.logger);
          expect(deps.commitedEvents).toHaveLength(1);
        });
        it.todo('Handle already registered quiz results');
      });
    });
  });
});
