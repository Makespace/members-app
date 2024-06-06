import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import {registerTrainingSheet} from '../../../src/commands/equipment/register-training-sheet';
import {DomainEvent} from '../../../src/types';
import {arbitraryActor, getSomeOrFail} from '../../helpers';

describe('register-training-sheet', () => {
  describe('No training sheet registered', () => {
    const events: ReadonlyArray<DomainEvent> = [];
    const command = {
      equipmentId: faker.string.uuid() as UUID,
      trainingSheetId: faker.string.alphanumeric(8),
      actor: arbitraryActor(),
    };

    const result = pipe(
      registerTrainingSheet.process({command, events}),
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
    it.todo('Does nothing');
  });

  describe('Different training sheet registered', () => {
    it.todo('Registers the sheet');
  });
});
