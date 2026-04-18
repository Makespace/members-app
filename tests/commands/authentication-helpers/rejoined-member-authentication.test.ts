import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {isAdminOrSuperUser} from '../../../src/commands/authentication-helpers/is-admin-or-super-user';
import {isEquipmentOwner} from '../../../src/commands/authentication-helpers/is-equipment-owner';
import {isEquipmentTrainer} from '../../../src/commands/authentication-helpers/is-equipment-trainer';
import {isSelf} from '../../../src/commands/authentication-helpers/is-self';
import {isSelfOrPrivileged} from '../../../src/commands/authentication-helpers/is-self-or-privileged';
import {Actor, EmailAddress} from '../../../src/types';
import {initTestFramework, TestFramework} from '../../read-models/test-framework';

describe('rejoined member authentication helpers', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('treats old and new linked member numbers as the same self user', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const oldActor = {
      tag: 'user',
      user: {
        memberNumber: oldMemberNumber,
        emailAddress: faker.internet.email() as EmailAddress,
      },
    } satisfies Actor;
    const newActor = {
      tag: 'user',
      user: {
        memberNumber: newMemberNumber,
        emailAddress: faker.internet.email() as EmailAddress,
      },
    } satisfies Actor;

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: oldMemberNumber,
      email: oldActor.user.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: newMemberNumber,
      email: newActor.user.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });

    [oldActor, newActor].forEach(actor => {
      [oldMemberNumber, newMemberNumber].forEach(memberNumber => {
        expect(
          isSelf({
            actor,
            rm: framework.sharedReadModel,
            input: {memberNumber},
          })
        ).toBe(true);
        expect(
          isSelfOrPrivileged({
            actor,
            rm: framework.sharedReadModel,
            input: {memberNumber},
          })
        ).toBe(true);
      });
    });
  });

  it('recognises linked old and new member numbers as equipment owner and trainer', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const oldActor = {
      tag: 'user',
      user: {
        memberNumber: oldMemberNumber,
        emailAddress: faker.internet.email() as EmailAddress,
      },
    } satisfies Actor;
    const newActor = {
      tag: 'user',
      user: {
        memberNumber: newMemberNumber,
        emailAddress: faker.internet.email() as EmailAddress,
      },
    } satisfies Actor;
    const area = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
    };
    const equipment = {
      id: faker.string.uuid() as UUID,
      name: faker.company.buzzNoun() as NonEmptyString,
      areaId: area.id,
    };

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: oldMemberNumber,
      email: oldActor.user.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: newMemberNumber,
      email: newActor.user.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create(area);
    await framework.commands.equipment.add(equipment);
    await framework.commands.area.addOwner({
      areaId: area.id,
      memberNumber: oldMemberNumber,
    });
    await framework.commands.trainers.add({
      equipmentId: equipment.id,
      memberNumber: oldMemberNumber,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });

    [oldActor, newActor].forEach(actor => {
      expect(
        isEquipmentOwner({
          actor,
          rm: framework.sharedReadModel,
          input: {equipmentId: equipment.id},
        })
      ).toBe(true);
      expect(
        isEquipmentTrainer({
          actor,
          rm: framework.sharedReadModel,
          input: {equipmentId: equipment.id},
        })
      ).toBe(true);
    });
  });

  it('recognises super user status through any linked member number', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const oldActor = {
      tag: 'user',
      user: {
        memberNumber: oldMemberNumber,
        emailAddress: faker.internet.email() as EmailAddress,
      },
    } satisfies Actor;
    const newActor = {
      tag: 'user',
      user: {
        memberNumber: newMemberNumber,
        emailAddress: faker.internet.email() as EmailAddress,
      },
    } satisfies Actor;

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: oldMemberNumber,
      email: oldActor.user.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: newMemberNumber,
      email: newActor.user.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });
    await framework.commands.superUser.declare({
      memberNumber: newMemberNumber,
    });

    [oldActor, newActor].forEach(actor => {
      expect(
        isAdminOrSuperUser({
          actor,
          rm: framework.sharedReadModel,
        })
      ).toBe(true);
    });
  });
});
