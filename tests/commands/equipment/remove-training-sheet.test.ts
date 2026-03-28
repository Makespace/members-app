import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {pipe} from 'fp-ts/lib/function';
import * as RA from 'fp-ts/ReadonlyArray';

import {removeTrainingSheet} from '../../../src/commands/equipment/remove-training-sheet';
import {arbitraryActor, getRightOrFail, getSomeOrFail} from '../../helpers';
import { initTestFramework, TestFramework } from '../../read-models/test-framework';

describe('remove-training-sheet', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });
  const command = {
    equipmentId: faker.string.uuid() as UUID,
    trainingSheetId: faker.string.alphanumeric(8),
    actor: arbitraryActor(),
  };

  it('Records the remove training sheet event', async () => {
    const result = pipe(
      await removeTrainingSheet.process({command, events: RA.empty, deps: framework})(),
      getRightOrFail,
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
