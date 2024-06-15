import * as E from 'fp-ts/Either';
import {applyToResource} from '../../../src/commands/apply-command-to-resource';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';
import {
  AddTrainer,
  addTrainer,
} from '../../../src/commands/trainers/add-trainer';
import {faker} from '@faker-js/faker';
import {arbitraryActor} from '../../helpers';
import {UUID} from 'io-ts-types';

describe('addTrainer', () => {
  let framework: TestFramework;
  let applyAddTrainer: ReturnType<typeof applyToResource<AddTrainer>>;
  beforeEach(async () => {
    framework = await initTestFramework();
    applyAddTrainer = applyToResource(
      framework.depsForApplyToResource,
      addTrainer
    );
  });
  const equipmentId = faker.string.uuid() as UUID;

  describe('when multiple trainers are added', () => {
    beforeEach(async () => {
      await applyAddTrainer(
        {equipmentId, memberNumber: faker.number.int()},
        arbitraryActor()
      )();
      await applyAddTrainer(
        {equipmentId, memberNumber: faker.number.int()},
        arbitraryActor()
      )();
    });
    it('records all of them', async () => {
      const events = await framework.getAllEventsByType('TrainerAdded');
      expect(events).toHaveLength(2);
    });
  });

  describe('when a command is repeatedly called', () => {
    const input = {
      equipmentId,
      memberNumber: faker.number.int(),
    };
    beforeEach(async () => {
      await applyAddTrainer(input, arbitraryActor())();
    });

    it('is idempotent', async () => {
      const result = await applyAddTrainer(input, arbitraryActor())();
      expect(result).toStrictEqual(E.left(expect.anything()));
    });
  });
});
