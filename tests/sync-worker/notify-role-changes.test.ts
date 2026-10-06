import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Email} from '../../src/types';
import {EmailAddress} from '../../src/types/email-address';
import {Config} from '../../src/configuration';
import {notifyRoleChanges} from '../../src/sync-worker/notify_role_changes';
import {
  initTestFramework,
  TestFramework,
} from '../read-models/test-framework';

describe('telling somebody a new job changed their email', () => {
  let framework: TestFramework;
  let sentEmails: Email[];
  const TRAINER = 80;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;

  const deps = () => ({
    logger: framework.depsForCommands.logger,
    sharedReadModel: framework.sharedReadModel,
    getAllEventsByType: framework.depsForCommands.getAllEventsByType,
    commitEvent: framework.depsForCommands.commitEvent,
    sendEmail: (email: Email) => {
      sentEmails.push(email);
      return TE.right('sent' as const);
    },
    conf: {
        PUBLIC_URL: 'https://members.makespace.org',
        // These tests are about what gets sent, so the mail is switched on.
        TROUBLE_TICKET_NOTIFY_TO: 'all',
      } as unknown as Config,
  });

  const stored = () =>
    framework.sharedReadModel.notificationPreferences.forMember(TRAINER);

  beforeEach(async () => {
    framework = await initTestFramework();
    sentEmails = [];
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: TRAINER,
      email: 'trainer@test.com' as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    // The read model refuses a trainer who does not own the area the machine
    // is in, so every trainer here is an owner first - which is the rule at
    // Makespace anyway.
    await framework.commands.area.addOwner({areaId, memberNumber: TRAINER});
  });

  // Becoming an owner is itself a role change, so it is reacted to and its
  // email cleared away before each test looks at what its own change did.
  const settle = async () => {
    await notifyRoleChanges(deps());
    sentEmails.length = 0;
  };

  afterEach(() => framework.close());

  it('puts a new trainer on a daily summary of their machine', async () => {
    await settle();
    await framework.commands.trainers.add({equipmentId, memberNumber: TRAINER});

    await notifyRoleChanges(deps());

    expect(stored().get(`equipment:${equipmentId}`)).toBe('daily');
  });

  it('tells them, and says where to change it', async () => {
    await settle();
    await framework.commands.trainers.add({equipmentId, memberNumber: TRAINER});

    await notifyRoleChanges(deps());

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].recipient).toStrictEqual('trainer@test.com');
    expect(sentEmails[0].subject).toContain('Band Saw');
    expect(sentEmails[0].text).toContain('daily summary');
    expect(sentEmails[0].text).toContain('/notification-settings');
  });

  // Taking on a machine is taking on the job of looking after it. Opting out
  // afterwards is theirs to do; the email is what makes that possible.
  it('overrules somebody who had muted that machine beforehand', async () => {
    await settle();
    await framework.commands.notificationPreferences.set({
      memberNumber: TRAINER,
      scope: `equipment:${equipmentId}` as NonEmptyString,
      preference: 'none',
    });
    await framework.commands.trainers.add({equipmentId, memberNumber: TRAINER});

    await notifyRoleChanges(deps());

    expect(stored().get(`equipment:${equipmentId}`)).toBe('daily');
    expect(sentEmails).toHaveLength(1);
  });

  it('does not react to the same change twice', async () => {
    await settle();
    await framework.commands.trainers.add({equipmentId, memberNumber: TRAINER});

    await notifyRoleChanges(deps());
    await notifyRoleChanges(deps());

    expect(sentEmails).toHaveLength(1);
  });

  // The important half of not reacting twice: somebody who opts out after
  // being told is not quietly opted back in on the next pass.
  it('leaves them alone if they turn it off afterwards', async () => {
    await settle();
    await framework.commands.trainers.add({equipmentId, memberNumber: TRAINER});
    await notifyRoleChanges(deps());

    await framework.commands.notificationPreferences.set({
      memberNumber: TRAINER,
      scope: `equipment:${equipmentId}` as NonEmptyString,
      preference: 'none',
    });
    await notifyRoleChanges(deps());

    expect(stored().get(`equipment:${equipmentId}`)).toBe('none');
    expect(sentEmails).toHaveLength(1);
  });

  it('puts the machine back to following its area when they stop training', async () => {
    await settle();
    await framework.commands.trainers.add({equipmentId, memberNumber: TRAINER});
    await notifyRoleChanges(deps());
    sentEmails.length = 0;

    await framework.commands.trainers.remove({
      equipmentId,
      memberNumber: TRAINER,
    });
    await notifyRoleChanges(deps());

    expect(stored().has(`equipment:${equipmentId}`)).toBe(false);
    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].subject).toContain('no longer a trainer');
  });

  it('clears what a new owner said about the area before it was theirs', async () => {
    await framework.commands.notificationPreferences.set({
      memberNumber: TRAINER,
      scope: `area:${areaId}` as NonEmptyString,
      preference: 'none',
    });

    await notifyRoleChanges(deps());

    expect(stored().has(`area:${areaId}`)).toBe(false);
    expect(sentEmails[0].subject).toContain('an owner of');
  });

  // The history is full of people being made trainers years ago.
  it('says nothing about a job somebody took on long ago', async () => {
    await settle();
    await framework.commands.trainers.add({equipmentId, memberNumber: TRAINER});

    const muchLater = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    await notifyRoleChanges(deps(), muchLater);

    expect(sentEmails).toHaveLength(0);
    expect(stored().has(`equipment:${equipmentId}`)).toBe(false);
  });
});
