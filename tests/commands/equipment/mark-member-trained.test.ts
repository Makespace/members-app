import {applyToResource} from '../../../src/commands/apply-command-to-resource';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';
import {
  MarkMemberTrained,
  markMemberTrained,
} from '../../../src/commands/trainers/mark-member-trained';
import {faker} from '@faker-js/faker';
import {systemActor, tokenActor, userActor} from '../../helpers';
import {UUID} from 'io-ts-types';
import {UserActor} from '../../../src/types/actor';
import {Int} from 'io-ts';

describe('markMemberTrained', () => {
  let framework: TestFramework;
  let applyMarkMemberTrained: ReturnType<
    typeof applyToResource<MarkMemberTrained>
  >;
  beforeEach(async () => {
    framework = await initTestFramework();
    applyMarkMemberTrained = applyToResource(
      framework.depsForApplyToResource,
      markMemberTrained
    );
  });
  afterEach(() => {
    framework.eventStoreDb.close();
  });

  [tokenActor(), systemActor()].forEach(actor => {
    describe(`${actor.tag} mark member trained`, () => {
      const equipmentId = faker.string.uuid() as UUID;
      const memberNumber = faker.number.int() as Int;
      beforeEach(async () => {
        await applyMarkMemberTrained(
          {
            equipmentId,
            memberNumber,
          },
          actor
        )();
      });

      [tokenActor()];

      it('Records the training as system', async () => {
        const events = await framework.getAllEventsByType(
          'MemberTrainedOnEquipment'
        );
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          equipmentId,
          memberNumber,
          trainedByMemberNumber: null,
        });
      });
    });
  });

  describe('user mark member trained', () => {
    const equipmentId = faker.string.uuid() as UUID;
    const memberNumber = faker.number.int() as Int;
    let actor: UserActor;
    beforeEach(async () => {
      actor = userActor();
      await applyMarkMemberTrained(
        {
          equipmentId,
          memberNumber,
        },
        userActor()
      )();
    });

    it('Records the training under the correct trainer', async () => {
      const events = await framework.getAllEventsByType(
        'MemberTrainedOnEquipment'
      );
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        equipmentId,
        memberNumber,
        trainedByMemberNumber: actor.user.memberNumber,
      });
    });
  });
});
