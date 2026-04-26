import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';

import {registerTrainingSheet} from '../../../src/commands/equipment/register-training-sheet';
import {
  arbitraryActor,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';
import { constructEvent } from '../../../src/types';

describe('register-training-sheet', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('No training sheet registered', () => {
    const command = {
      equipmentId: faker.string.uuid() as UUID,
      trainingSheetId: faker.string.alphanumeric(8),
      actor: arbitraryActor(),
    };

    it('Registers a new training sheet id', async () => {
      const result = pipe(
        await getTaskEitherRightOrFail(
          registerTrainingSheet.process({
            command,
            rm: framework.sharedReadModel,
          })
        ),
        getSomeOrFail
      );

      expect(result).toStrictEqual(
        expect.objectContaining({
          type: 'EquipmentTrainingSheetRegistered',
          equipmentId: command.equipmentId,
          trainingSheetId: command.trainingSheetId,
        })
      );
    });
  });

  describe('Same training sheet registered', () => {
    const command = {
      equipmentId: faker.string.uuid() as UUID,
      trainingSheetId: faker.string.alphanumeric(8),
      actor: arbitraryActor(),
    };
    it('A duplicate event is registered', async () => {
      framework.insertIntoSharedReadModel(
        constructEvent('EquipmentTrainingSheetRegistered')(command)
      );
      const result = pipe(
        await getTaskEitherRightOrFail(
          registerTrainingSheet.process({
            command,
            rm: framework.sharedReadModel,
          })
        ),
        getSomeOrFail
      );

      expect(result).toStrictEqual(
        expect.objectContaining({
          type: 'EquipmentTrainingSheetRegistered',
          equipmentId: command.equipmentId,
          trainingSheetId: command.trainingSheetId,
        })
      );
    });
  });

  describe('Different training sheet registered', () => {
    const command = {
      equipmentId: faker.string.uuid() as UUID,
      trainingSheetId: faker.string.alphanumeric(32),
      actor: arbitraryActor(),
    };
    const diffTrainingSheet = {
      ...command,
      trainingSheetId: faker.string.alphanumeric(32),
    };

    it('updates the training sheet registered', async () => {
      framework.insertIntoSharedReadModel(constructEvent('EquipmentTrainingSheetRegistered')(command));
      const result = pipe(
        await getTaskEitherRightOrFail(
          registerTrainingSheet.process({
            command: diffTrainingSheet,
            rm: framework.sharedReadModel,
          })
        ),
        getSomeOrFail
      );
      expect(result).toStrictEqual(
        expect.objectContaining({
          type: 'EquipmentTrainingSheetRegistered',
          equipmentId: diffTrainingSheet.equipmentId,
          trainingSheetId: diffTrainingSheet.trainingSheetId,
        })
      );
    });
  });
});
