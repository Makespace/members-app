import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';

import {registerTrainingSheet} from '../../../src/commands/equipment/register-training-sheet';
import {arbitraryActor, getSomeOrFail} from '../../helpers';

describe('register-training-sheet', () => {
  describe('No training sheet registered', () => {
    const command = {
      equipmentId: faker.string.uuid() as UUID,
      trainingSheetId: faker.string.alphanumeric(8),
      actor: arbitraryActor(),
    };

    const result = pipe(
      registerTrainingSheet.process({command, events: RA.empty}),
      getSomeOrFail
    );

    it('Registers a new training sheet id', () => {
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
    const events = RA.fromArray([
      pipe(
        registerTrainingSheet.process({command, events: RA.empty}),
        getSomeOrFail
      ),
    ]);

    const result = pipe(
      registerTrainingSheet.process({command, events}),
      getSomeOrFail
    );

    it('A duplicate event is registered', () => {
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
    const events = RA.fromArray([
      pipe(
        registerTrainingSheet.process({command, events: RA.empty}),
        getSomeOrFail
      ),
    ]);

    const diffTrainingSheet = {
      ...command,
      trainingSheetId: faker.string.alphanumeric(8),
    };

    expect(command.trainingSheetId).not.toEqual(
      diffTrainingSheet.trainingSheetId
    );

    const result = pipe(
      registerTrainingSheet.process({command: diffTrainingSheet, events}),
      getSomeOrFail
    );

    it('It keeps the same training sheet registered', () => {
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
