import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent, Email} from '../../src/types';
import {EmailAddress} from '../../src/types/email-address';
import {Config} from '../../src/configuration';
import {notifyDigests} from '../../src/sync-worker/notify_digests';
import {
  initTestFramework,
  TestFramework,
} from '../read-models/test-framework';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('the trouble ticket summaries', () => {
  let framework: TestFramework;
  let sentEmails: Email[];
  const OWNER = 70;
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

  const commit = (event: Parameters<typeof framework.depsForCommands.commitEvent>[0] extends never ? never : Parameters<ReturnType<typeof framework.depsForCommands.commitEvent>>[0]) =>
    framework.depsForCommands.commitEvent(
      framework.sharedReadModel.getCurrentEventIndex()
    )(event)();

  const raiseTicket = async (issue: string) => {
    await commit(
      constructEvent('TroubleTicketCreated')({
        actor: {tag: 'system'},
        id: faker.string.uuid() as UUID,
        rowHash: faker.string.hexadecimal({length: 64}),
        sheetId: 'sheet',
        submittedAt: new Date(),
        submittedMemberNumber: null,
        submittedEmail: null,
        submittedName: null,
        submittedEquipment: 'Band Saw',
        equipmentId,
        machine: '',
        areaId: null,
        title: issue,
        mailboxConversationId: '',
        source: 'sheet',
        otherEquipmentDetail: '',
        status: 'Broken',
        attempting: '',
        issue,
        steps: '',
      })
    );
  };

  beforeEach(async () => {
    framework = await initTestFramework();
    sentEmails = [];
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: OWNER,
      email: 'owner@test.com' as EmailAddress,
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
    await framework.commands.area.addOwner({
      areaId,
      memberNumber: OWNER,
    });
  });

  afterEach(() => framework.close());

  // The rule that keeps this from being a nuisance: no changes, no email, and
  // no record that one was sent - so the next summary still covers the period
  // just gone.
  it('sends nothing when nothing happened', async () => {
    await notifyDigests(deps());

    expect(sentEmails).toHaveLength(0);
    expect(
      await framework.getAllEventsByType('MemberTicketDigestSent')
    ).toHaveLength(0);
  });

  it('sends an owner a weekly summary of their area', async () => {
    await raiseTicket('the blade is blunt');

    await notifyDigests(deps());

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].recipient).toStrictEqual('owner@test.com');
    expect(sentEmails[0].subject).toContain('this week');
    expect(sentEmails[0].text).toContain('the blade is blunt');
    expect(sentEmails[0].text).toContain('Band Saw');
  });

  it('says how to stop getting them', async () => {
    await raiseTicket('the blade is blunt');
    await notifyDigests(deps());

    expect(sentEmails[0].text).toContain('/notification-settings');
  });

  it('does not send the same changes twice', async () => {
    await raiseTicket('the blade is blunt');
    await notifyDigests(deps());
    await notifyDigests(deps());

    expect(sentEmails).toHaveLength(1);
  });

  // A week later, with something new to say.
  it('sends the next one when the period has passed', async () => {
    await raiseTicket('the blade is blunt');
    await notifyDigests(deps());

    await raiseTicket('the guard is loose');
    const nextWeek = new Date(Date.now() + 8 * DAY_MS);
    await notifyDigests(deps(), nextWeek);

    expect(sentEmails).toHaveLength(2);
    expect(sentEmails[1].text).toContain('the guard is loose');
    expect(sentEmails[1].text).not.toContain('the blade is blunt');
  });

  it('stays quiet in a week when nothing happened, then speaks up again', async () => {
    await raiseTicket('the blade is blunt');
    await notifyDigests(deps());

    // A quiet week: due, but with nothing to say.
    await notifyDigests(deps(), new Date(Date.now() + 8 * DAY_MS));
    expect(sentEmails).toHaveLength(1);

    await raiseTicket('the fence is bent');
    await notifyDigests(deps(), new Date(Date.now() + 16 * DAY_MS));
    expect(sentEmails).toHaveLength(2);
    expect(sentEmails[1].text).toContain('the fence is bent');
  });

  it('leaves somebody who asked to hear as it happens out of the summary', async () => {
    await framework.commands.notificationPreferences.set({
      memberNumber: OWNER,
      scope: 'my-areas' as NonEmptyString,
      preference: 'live',
    });
    await raiseTicket('the blade is blunt');

    await notifyDigests(deps());

    expect(sentEmails).toHaveLength(0);
  });

  it('leaves somebody who asked for nothing out of it too', async () => {
    await framework.commands.notificationPreferences.set({
      memberNumber: OWNER,
      scope: 'my-areas' as NonEmptyString,
      preference: 'none',
    });
    await raiseTicket('the blade is blunt');

    await notifyDigests(deps());

    expect(sentEmails).toHaveLength(0);
  });

  it('sends a daily summary to somebody who asked for one', async () => {
    await framework.commands.notificationPreferences.set({
      memberNumber: OWNER,
      scope: 'my-areas' as NonEmptyString,
      preference: 'daily',
    });
    await raiseTicket('the blade is blunt');

    await notifyDigests(deps());

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].subject).toContain('today');
  });
});
