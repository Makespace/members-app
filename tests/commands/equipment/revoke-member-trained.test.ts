import {applyToResource} from '../../../src/commands/apply-command-to-resource';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';
import {faker} from '@faker-js/faker';
import {systemActor, tokenActor, userActor} from '../../helpers';
import {UUID} from 'io-ts-types';
import {UserActor} from '../../../src/types/actor';
import {Int} from 'io-ts';
import {
  revokeMemberTrained,
  RevokeMemberTrained,
} from '../../../src/commands/trainers/revoke-member-trained';

describe('revokeMemberTrained', () => {
  let framework: TestFramework;
  let applyRevokeMemberTrained: ReturnType<
    typeof applyToResource<RevokeMemberTrained>
  >;
  beforeEach(async () => {
    framework = await initTestFramework();
    applyRevokeMemberTrained = applyToResource(
      framework.depsForApplyToResource,
      revokeMemberTrained
    );
  });
  afterEach(() => {
    framework.eventStoreDb.close();
  });

  [tokenActor(), systemActor()].forEach(actor => {
    describe(`${actor.tag} revoke member trained`, () => {
      const equipmentId = faker.string.uuid() as UUID;
      const memberNumber = faker.number.int() as Int;
      beforeEach(async () => {
        await applyRevokeMemberTrained(
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
          'RevokeTrainedOnEquipment'
        );
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          equipmentId,
          memberNumber,
          revokedByMemberNumber: null,
        });
      });
    });
  });

  describe('user revoke member trained', () => {
    const equipmentId = faker.string.uuid() as UUID;
    const memberNumber = faker.number.int() as Int;
    let actor: UserActor;
    beforeEach(async () => {
      actor = userActor();
      await applyRevokeMemberTrained(
        {
          equipmentId,
          memberNumber,
        },
        userActor()
      )();
    });

    it('Records the revoked training under the correct trainer', async () => {
      const events = await framework.getAllEventsByType(
        'RevokeTrainedOnEquipment'
      );
      expect(events).toHaveLength(1);
      expect(events[0]).toMatchObject({
        equipmentId,
        memberNumber,
        revokedByMemberNumber: actor.user.memberNumber,
      });
    });
  });
});
