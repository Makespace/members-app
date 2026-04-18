import {faker} from '@faker-js/faker';
import {Int} from 'io-ts';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent, EmailAddress} from '../../../src/types';
import {
  failedEventsTable,
  memberNumbersTable,
  trainingStatsNotificationTable,
} from '../../../src/read-models/shared-state/state';
import {getSomeOrFail} from '../../helpers';
import {initTestFramework, TestFramework} from '../test-framework';

const sorted = <T>(items: ReadonlyArray<T>) => [...items].sort();

const addMember = (
  framework: TestFramework,
  memberNumber: number,
  email = faker.internet.email() as EmailAddress
) =>
  framework.commands.memberNumbers.linkNumberToEmail({
    memberNumber,
    email,
    name: undefined,
    formOfAddress: undefined,
  });

const addAreaAndEquipment = async (framework: TestFramework) => {
  const area = {
    id: faker.string.uuid() as UUID,
    name: faker.company.buzzNoun() as NonEmptyString,
  };
  const equipment = {
    id: faker.string.uuid() as UUID,
    name: faker.company.buzzNoun() as NonEmptyString,
    areaId: area.id,
  };

  await framework.commands.area.create(area);
  await framework.commands.equipment.add(equipment);

  return {area, equipment};
};

const notificationRows = (framework: TestFramework) =>
  framework.sharedReadModel.db
    .select()
    .from(trainingStatsNotificationTable)
    .all();

const insertRejoinedEvent = (
  framework: TestFramework,
  oldMemberNumber: number,
  newMemberNumber: number
) =>
  framework.insertIntoSharedReadModel(
    constructEvent('MemberRejoinedWithNewNumber')({
      oldMemberNumber,
      newMemberNumber,
      actor: {tag: 'token', token: 'admin'},
    })
  );

describe('rejoined members', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  it('merges emails, member numbers and activity rows onto one member', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const oldEmail = faker.internet.email() as EmailAddress;
    const newEmail = faker.internet.email() as EmailAddress;
    const oldResources = await addAreaAndEquipment(framework);
    const newResources = await addAreaAndEquipment(framework);

    await addMember(framework, oldMemberNumber, oldEmail);
    await framework.commands.area.addOwner({
      areaId: oldResources.area.id,
      memberNumber: oldMemberNumber,
    });
    await framework.commands.trainers.add({
      equipmentId: oldResources.equipment.id,
      memberNumber: oldMemberNumber,
    });
    await framework.commands.trainers.markTrained({
      equipmentId: oldResources.equipment.id,
      memberNumber: oldMemberNumber,
    });

    await addMember(framework, newMemberNumber, newEmail);
    await framework.commands.area.addOwner({
      areaId: newResources.area.id,
      memberNumber: newMemberNumber,
    });
    await framework.commands.trainers.add({
      equipmentId: newResources.equipment.id,
      memberNumber: newMemberNumber,
    });
    await framework.commands.trainers.markTrained({
      equipmentId: newResources.equipment.id,
      memberNumber: newMemberNumber,
    });

    insertRejoinedEvent(framework, oldMemberNumber, newMemberNumber);

    const byOldNumber = getSomeOrFail(
      framework.sharedReadModel.members.getByMemberNumber(oldMemberNumber)
    );
    const byNewNumber = getSomeOrFail(
      framework.sharedReadModel.members.getByMemberNumber(newMemberNumber)
    );

    expect(byOldNumber).toStrictEqual(byNewNumber);
    expect(byOldNumber.memberNumber).toStrictEqual(newMemberNumber);
    expect(byOldNumber.pastMemberNumbers).toContain(oldMemberNumber);
    expect(sorted(byOldNumber.emails.map(email => email.emailAddress))).toStrictEqual(
      sorted([oldEmail, newEmail])
    );
    expect(sorted(byOldNumber.ownerOf.map(area => area.id))).toStrictEqual(
      sorted([oldResources.area.id, newResources.area.id])
    );
    expect(
      sorted(byOldNumber.trainerFor.map(equipment => equipment.equipment_id))
    ).toStrictEqual(
      sorted([oldResources.equipment.id, newResources.equipment.id])
    );
    expect(sorted(byOldNumber.trainedOn.map(equipment => equipment.id))).toStrictEqual(
      sorted([oldResources.equipment.id, newResources.equipment.id])
    );
    expect(
      framework.sharedReadModel.members
        .getAll()
        .filter(member =>
          [oldMemberNumber, newMemberNumber].some(
            memberNumber => memberNumber === member.memberNumber
          )
        )
    ).toHaveLength(1);
  });

  it('applies member details updates through the new number after rejoining', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const name = faker.person.fullName();

    await addMember(framework, oldMemberNumber);
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });
    await framework.commands.members.editName({
      memberNumber: newMemberNumber,
      name,
    });

    [oldMemberNumber, newMemberNumber].forEach(memberNumber => {
      const member = getSomeOrFail(
        framework.sharedReadModel.members.getByMemberNumber(memberNumber)
      );

      expect(getSomeOrFail(member.name)).toStrictEqual(name);
    });
  });

  it('applies member details updates recorded before the rejoin is linked', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const name = faker.person.fullName();
    const formOfAddress = faker.helpers.arrayElement([
      'he/him',
      'she/her',
      'they/them',
    ]);

    await addMember(framework, oldMemberNumber);
    await framework.commands.members.editName({
      memberNumber: newMemberNumber,
      name,
    });
    await framework.commands.members.editFormOfAddress({
      memberNumber: newMemberNumber,
      formOfAddress,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });

    [oldMemberNumber, newMemberNumber].forEach(memberNumber => {
      const member = getSomeOrFail(
        framework.sharedReadModel.members.getByMemberNumber(memberNumber)
      );

      expect(getSomeOrFail(member.name)).toStrictEqual(name);
      expect(getSomeOrFail(member.formOfAddress)).toStrictEqual(formOfAddress);
    });
    expect(
      framework.sharedReadModel.db.select().from(failedEventsTable).all()
    ).toHaveLength(0);
  });

  it('does not let stale failed member details overwrite newer details when rejoining', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const staleName = faker.person.fullName();
    const latestName = faker.person.fullName();

    await addMember(framework, oldMemberNumber);
    await framework.commands.members.editName({
      memberNumber: newMemberNumber,
      name: staleName,
    });
    await framework.commands.members.editName({
      memberNumber: oldMemberNumber,
      name: latestName,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });

    [oldMemberNumber, newMemberNumber].forEach(memberNumber => {
      const member = getSomeOrFail(
        framework.sharedReadModel.members.getByMemberNumber(memberNumber)
      );

      expect(getSomeOrFail(member.name)).toStrictEqual(latestName);
    });
    expect(
      framework.sharedReadModel.db.select().from(failedEventsTable).all()
    ).toHaveLength(0);
  });

  it('keeps newer old-record member details when merging an existing new record', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const staleName = faker.person.fullName();
    const latestName = faker.person.fullName();

    await addMember(framework, oldMemberNumber);
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: newMemberNumber,
      email: faker.internet.email() as EmailAddress,
      name: staleName,
      formOfAddress: undefined,
    });
    await framework.commands.members.editName({
      memberNumber: oldMemberNumber,
      name: latestName,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });

    [oldMemberNumber, newMemberNumber].forEach(memberNumber => {
      const member = getSomeOrFail(
        framework.sharedReadModel.members.getByMemberNumber(memberNumber)
      );

      expect(getSomeOrFail(member.name)).toStrictEqual(latestName);
    });
  });

  it.each([
    ['old', (oldMemberNumber: number) => oldMemberNumber],
    ['new', (_oldMemberNumber: number, newMemberNumber: number) => newMemberNumber],
  ])(
    'removes owner and trainer rows when ownership is removed by the %s member number',
    async (_name, selectMemberNumber) => {
      const oldMemberNumber = faker.number.int() as Int;
      const newMemberNumber = faker.number.int({
        min: oldMemberNumber + 1,
      }) as Int;
      const {area, equipment} = await addAreaAndEquipment(framework);

      await addMember(framework, oldMemberNumber);
      await addMember(framework, newMemberNumber);
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

      framework.insertIntoSharedReadModel(
        constructEvent('OwnerRemoved')({
          areaId: area.id,
          memberNumber: selectMemberNumber(oldMemberNumber, newMemberNumber),
          actor: {tag: 'token', token: 'admin'},
        })
      );

      [oldMemberNumber, newMemberNumber].forEach(memberNumber => {
        const member = getSomeOrFail(
          framework.sharedReadModel.members.getByMemberNumber(memberNumber)
        );
        expect(member.ownerOf.map(owner => owner.id)).not.toContain(area.id);
        expect(
          member.trainerFor.map(trainer => trainer.equipment_id)
        ).not.toContain(equipment.id);
      });
      const currentArea = getSomeOrFail(framework.sharedReadModel.area.get(area.id));
      const currentEquipment = getSomeOrFail(
        framework.sharedReadModel.equipment.get(equipment.id)
      );
      expect(currentArea.owners).toHaveLength(0);
      expect(currentEquipment.trainers).toHaveLength(0);
    }
  );

  it('moves a training notification from the new record onto the old user during rejoin', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const sentAt = new Date('2026-01-02T03:04:05.000Z');

    await addMember(framework, oldMemberNumber);
    await addMember(framework, newMemberNumber);
    framework.insertIntoSharedReadModel({
      type: 'TrainingStatNotificationSent',
      toMemberNumber: newMemberNumber,
      toMemberEmail: faker.internet.email(),
      recordedAt: sentAt,
      actor: {tag: 'system'},
    });

    insertRejoinedEvent(framework, oldMemberNumber, newMemberNumber);

    const oldUserId = getSomeOrFail(
      framework.sharedReadModel.members.findUserIdByMemberNumber(oldMemberNumber)
    );
    expect(notificationRows(framework)).toStrictEqual([
      expect.objectContaining({
        userId: oldUserId,
        lastEmailSent: sentAt,
      }),
    ]);
  });

  it('keeps the latest training notification when both records have one', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const oldSentAt = new Date('2026-01-02T03:04:05.000Z');
    const newSentAt = new Date('2026-01-03T03:04:05.000Z');

    await addMember(framework, oldMemberNumber);
    await addMember(framework, newMemberNumber);
    [oldMemberNumber, newMemberNumber].forEach((memberNumber, index) => {
      framework.insertIntoSharedReadModel({
        type: 'TrainingStatNotificationSent',
        toMemberNumber: memberNumber,
        toMemberEmail: faker.internet.email(),
        recordedAt: index === 0 ? oldSentAt : newSentAt,
        actor: {tag: 'system'},
      });
    });

    insertRejoinedEvent(framework, oldMemberNumber, newMemberNumber);

    const oldUserId = getSomeOrFail(
      framework.sharedReadModel.members.findUserIdByMemberNumber(oldMemberNumber)
    );
    expect(notificationRows(framework)).toStrictEqual([
      expect.objectContaining({
        userId: oldUserId,
        lastEmailSent: newSentAt,
      }),
    ]);
  });

  it('keeps an older new-record training notification from replacing the old one', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;
    const oldSentAt = new Date('2026-01-03T03:04:05.000Z');
    const newSentAt = new Date('2026-01-02T03:04:05.000Z');

    await addMember(framework, oldMemberNumber);
    await addMember(framework, newMemberNumber);
    [oldMemberNumber, newMemberNumber].forEach((memberNumber, index) => {
      framework.insertIntoSharedReadModel({
        type: 'TrainingStatNotificationSent',
        toMemberNumber: memberNumber,
        toMemberEmail: faker.internet.email(),
        recordedAt: index === 0 ? oldSentAt : newSentAt,
        actor: {tag: 'system'},
      });
    });

    insertRejoinedEvent(framework, oldMemberNumber, newMemberNumber);

    const oldUserId = getSomeOrFail(
      framework.sharedReadModel.members.findUserIdByMemberNumber(oldMemberNumber)
    );
    expect(notificationRows(framework)).toStrictEqual([
      expect.objectContaining({
        userId: oldUserId,
        lastEmailSent: oldSentAt,
      }),
    ]);
  });

  it('only keeps one member-number row for each number after repeated rejoin events', async () => {
    const oldMemberNumber = faker.number.int() as Int;
    const newMemberNumber = faker.number.int({
      min: oldMemberNumber + 1,
    }) as Int;

    await addMember(framework, oldMemberNumber);
    await addMember(framework, newMemberNumber);
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });
    await framework.commands.memberNumbers.markMemberRejoinedWithNewNumber({
      oldMemberNumber,
      newMemberNumber,
    });

    expect(
      framework.sharedReadModel.db.select().from(memberNumbersTable).all()
    ).toHaveLength(2);
  });
});
