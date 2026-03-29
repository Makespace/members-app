import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';

import {removeTrainingSheet} from '../../../src/commands/equipment/remove-training-sheet';
import {
  arbitraryActor,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';

describe('remove-training-sheet', () => {
  const command = {
    equipmentId: faker.string.uuid() as UUID,
    trainingSheetId: faker.string.alphanumeric(8),
    actor: arbitraryActor(),
  };

  it('Records the remove training sheet event', async () => {
    const result = pipe(
      await getTaskEitherRightOrFail(
        removeTrainingSheet.process({command, events: RA.empty})
      ),
      getSomeOrFail
    );

    expect(result).toStrictEqual(
      expect.objectContaining({
        type: 'EquipmentTrainingSheetRemoved',
        equipmentId: command.equipmentId,
      })
    );
  });
});
