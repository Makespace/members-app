import {applyCommand} from '../../../src/commands/apply-command';
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
import {NonEmptyString, UUID} from 'io-ts-types';
import {UserActor} from '../../../src/types/actor';
import {Int} from 'io-ts';
import { EmailAddress } from '../../../src/types';
import { LinkNumberToEmail } from '../../../src/commands/member-numbers/link-number-to-email';
import { CreateArea } from '../../../src/commands/area/create';
import { AddEquipment } from '../../../src/commands/equipment/add';

describe('markMemberTrained', () => {
  const member: LinkNumberToEmail = {
    email: faker.internet.email() as EmailAddress,
    memberNumber: faker.number.int() as Int,
    name: undefined,
    formOfAddress: undefined
  };
  const area: CreateArea = {
    id: faker.string.uuid() as UUID,
    name: faker.airline.airline().name as NonEmptyString,
  };
  const equipment: AddEquipment = {
    name: faker.airline.airplane().name as NonEmptyString,
    id: faker.string.uuid() as UUID,
    areaId: area.id,
  };

  let framework: TestFramework;
  let applyMarkMemberTrained: ReturnType<
    typeof applyCommand<MarkMemberTrained>
  >;
  beforeEach(async () => {
    framework = await initTestFramework();
    applyMarkMemberTrained = applyCommand(
      framework.depsForCommands,
      markMemberTrained
    );
    await framework.commands.memberNumbers.linkNumberToEmail(member);
    await framework.commands.area.create(area);
    await framework.commands.equipment.add(equipment);
  });
  afterEach(() => {
    framework.close();
  });

  [tokenActor(), systemActor()].forEach(actor => {
    describe(`${actor.tag} mark member trained`, () => {
      beforeEach(async () => {
        await applyMarkMemberTrained(
          {
            equipmentId: equipment.id,
            memberNumber: member.memberNumber as Int,
          },
          actor
        )();
      });

      it('Records the training as system', async () => {
        const events = await framework.getAllEventsByType(
          'MemberTrainedOnEquipment'
        );
        expect(events).toHaveLength(1);
        expect(events[0]).toMatchObject({
          equipmentId: equipment.id,
          memberNumber: member.memberNumber,
          trainedByMemberNumber: null,
        });
      });
    });
  });

  describe('user mark member trained', () => {
    let actor: UserActor;
    beforeEach(async () => {
      actor = userActor();
      await applyMarkMemberTrained(
        {
          equipmentId: equipment.id,
          memberNumber: member.memberNumber as Int,
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
        equipmentId: equipment.id,
        memberNumber: member.memberNumber as Int,
        trainedByMemberNumber: actor.user.memberNumber,
      });
    });
  });
});
