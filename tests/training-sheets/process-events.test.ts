import {faker} from '@faker-js/faker';
import {process} from '../../src/training-sheets/training-sheets-worker';
import {TestFramework, initTestFramework} from '../read-models/test-framework';
import {NonEmptyString, UUID} from 'io-ts-types';
import {EventOfType} from '../../src/types/domain-event';
import {happyPathAdapters} from '../init-dependencies/happy-path-adapters.helper';

describe('Training sheets worker', () => {
  describe('Run whole', () => {
    it.todo('Test the run function');
  });

  describe('Process results', () => {
    let sheetRegEvents: ReadonlyArray<
      EventOfType<'EquipmentTrainingSheetRegistered'>
    >;
    let existingQuizResultEvents: ReadonlyArray<
      EventOfType<'EquipmentTrainingQuizResult'>
    >;

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
        const registerTrainingSheet = {
          equipmentId: addEquipment.id,
          trainingSheetId: faker.string.uuid(),
        };
        beforeEach(async () => {
          await framework.commands.equipment.training_sheet(
            registerTrainingSheet
          );
          sheetRegEvents = await framework.getAllEventsByType(
            'EquipmentTrainingSheetRegistered'
          );
          existingQuizResultEvents = await framework.getAllEventsByType(
            'EquipmentTrainingQuizResult'
          );
        });

        it.skip('generates equipment events', async () => {
          const result = process(
            happyPathAdapters.logger,
            happyPathAdapters,
            sheetRegEvents,
            existingQuizResultEvents
          );
          const newEvents = Object.values(await result);
          expect(newEvents).toHaveLength(1);
        });
        it.todo('Handle already registered quiz results');
      });
    });
  });
});
