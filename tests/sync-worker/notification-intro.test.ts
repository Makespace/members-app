import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent, Email} from '../../src/types';
import {EmailAddress} from '../../src/types/email-address';
import {Config} from '../../src/configuration';
import {notifyTroubleTicketChanges} from '../../src/sync-worker/notify_trouble_tickets';
import {notifyDigests} from '../../src/sync-worker/notify_digests';
import {INTRO_AFTER_EMAILS} from '../../src/templates/trouble-ticket-email';
import {initTestFramework, TestFramework} from '../read-models/test-framework';

// Somebody's first notifications arrive from a system nobody has told them
// about, so those few say what it is. After that they know.

describe('introducing the notifications to somebody new', () => {
  let framework: TestFramework;
  let sentEmails: Email[];
  const OWNER = 97;
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
      TROUBLE_TICKET_NOTIFY_TO: 'all',
    } as unknown as Config,
  });

  const raise = async (issue: string) =>
    framework.depsForCommands.commitEvent(
      framework.sharedReadModel.getCurrentEventIndex()
    )(
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
    )();

  const introduced = () =>
    sentEmails.filter(email => email.text.includes('can now be submitted'));

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
    await framework.commands.area.addOwner({areaId, memberNumber: OWNER});
    await framework.commands.notificationPreferences.set({
      memberNumber: OWNER,
      scope: 'my-areas' as NonEmptyString,
      preference: 'live',
    });
  });

  afterEach(() => framework.close());

  it('explains itself in a first notification', async () => {
    await raise('The blade is blunt');

    await notifyTroubleTicketChanges(deps());

    expect(introduced()).toHaveLength(1);
    expect(sentEmails[0].text).toContain('can now be submitted and tracked');
    expect(sentEmails[0].text).toContain('/notification-settings');
    expect(sentEmails[0].html).toContain('can now be submitted');
  });

  // The point of counting: it has to stop.
  it('stops explaining once they have heard from us enough', async () => {
    for (let i = 0; i < INTRO_AFTER_EMAILS + 3; i++) {
      await raise(`Something went wrong ${i}`);
      await notifyTroubleTicketChanges(deps());
    }

    expect(sentEmails.length).toBeGreaterThan(INTRO_AFTER_EMAILS);
    expect(introduced()).toHaveLength(INTRO_AFTER_EMAILS);
  });

  it('explains itself in a first summary too', async () => {
    await framework.commands.notificationPreferences.set({
      memberNumber: OWNER,
      scope: 'my-areas' as NonEmptyString,
      preference: 'daily',
    });
    await raise('The blade is blunt');

    await notifyDigests(deps());

    expect(introduced()).toHaveLength(1);
  });

  // A summary that was worked out but never sent should not use up one of
  // somebody's introductions.
  it('does not count a summary that was held back', async () => {
    await framework.commands.notificationPreferences.set({
      memberNumber: OWNER,
      scope: 'my-areas' as NonEmptyString,
      preference: 'daily',
    });
    await raise('The blade is blunt');
    const heldBack = {
      ...deps(),
      conf: {
        PUBLIC_URL: 'https://members.makespace.org',
        TROUBLE_TICKET_NOTIFY_TO: '',
      } as unknown as Config,
    };

    await notifyDigests(heldBack);

    expect(
      framework.sharedReadModel.notificationPreferences.emailsSentTo(OWNER)
    ).toStrictEqual(0);
  });
});
