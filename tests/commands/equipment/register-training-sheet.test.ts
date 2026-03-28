import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';

import {registerTrainingSheet} from '../../../src/commands/equipment/register-training-sheet';
import {arbitraryActor, getRightOrFail, getSomeOrFail} from '../../helpers';
import { initTestFramework, TestFramework } from '../../read-models/test-framework';

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
        await registerTrainingSheet.process({command, events: RA.empty, deps: framework})(),
        getRightOrFail,
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
      const events = RA.fromArray([
        pipe(
          await registerTrainingSheet.process({command, events: RA.empty, deps: framework})(),
          getRightOrFail,
          getSomeOrFail
        ),
      ]);

      const result = pipe(
        await registerTrainingSheet.process({command, events, deps: framework})(),
        getRightOrFail,
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
      trainingSheetId: faker.string.alphanumeric(8),
      actor: arbitraryActor(),
    };

    const diffTrainingSheet = {
      ...command,
      trainingSheetId: faker.string.alphanumeric(8),
    };

    it('It keeps the same training sheet registered', async () => {
      expect(command.trainingSheetId).not.toEqual( // Check that the test data itself is ok.
        diffTrainingSheet.trainingSheetId
      );
      const events = RA.fromArray([
        pipe(
          await registerTrainingSheet.process({command, events: RA.empty, deps: framework})(),
          getRightOrFail,
          getSomeOrFail
        ),
      ]);
      const result = pipe(
        await registerTrainingSheet.process({command: diffTrainingSheet, events, deps: framework})(),
        getRightOrFail,
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
