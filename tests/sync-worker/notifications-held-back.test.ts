import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {constructEvent, Email} from '../../src/types';
import {EmailAddress} from '../../src/types/email-address';
import {Config} from '../../src/configuration';
import {notifyTroubleTicketChanges} from '../../src/sync-worker/notify_trouble_tickets';
import {notifyDigests} from '../../src/sync-worker/notify_digests';
import {notifyRoleChanges} from '../../src/sync-worker/notify_role_changes';
import {initTestFramework, TestFramework} from '../read-models/test-framework';

// Deploying the notification stack with the mail held back, so the logs can
// say who it would have written to before anybody's inbox is involved.

describe('holding the trouble ticket notifications back', () => {
  let framework: TestFramework;
  let sentEmails: Email[];
  const OWNER = 90;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;

  const deps = (notifyTo: string) => ({
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
      TROUBLE_TICKET_NOTIFY_TO: notifyTo,
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
  });

  afterEach(() => framework.close());

  it('sends no live mail when nobody is allowed', async () => {
    await framework.commands.notificationPreferences.set({
      memberNumber: OWNER,
      scope: 'my-areas' as NonEmptyString,
      preference: 'live',
    });
    await raise('The blade is blunt');

    await notifyTroubleTicketChanges(deps(''));

    expect(sentEmails).toHaveLength(0);
  });

  it('sends no summaries when nobody is allowed', async () => {
    await raise('The blade is blunt');

    await notifyDigests(deps(''));

    expect(sentEmails).toHaveLength(0);
  });

  // The watermark still moves, so the day the mail is switched on nobody
  // receives a fortnight of held-back history in one go.
  it('still records the summary it held back, marked as held back', async () => {
    await raise('The blade is blunt');

    await notifyDigests(deps(''));

    const recorded = await framework.getAllEventsByType(
      'MemberTicketDigestSent'
    );
    expect(recorded).toHaveLength(1);
    expect(recorded[0].suppressed).toBe(true);
  });

  it('marks a summary it did send as not held back', async () => {
    await raise('The blade is blunt');

    await notifyDigests(deps('all'));

    const recorded = await framework.getAllEventsByType(
      'MemberTicketDigestSent'
    );
    expect(recorded[0].suppressed).toBe(false);
    expect(sentEmails).toHaveLength(1);
  });

  // Overruling somebody's choice is only fair because they are told. With
  // nobody to tell, their choice is left exactly as they left it.
  it('leaves a new trainer\'s own choice alone rather than rewriting it unannounced', async () => {
    await framework.commands.notificationPreferences.set({
      memberNumber: OWNER,
      scope: `equipment:${equipmentId}` as NonEmptyString,
      preference: 'none',
    });
    await framework.commands.trainers.add({
      equipmentId,
      memberNumber: OWNER,
    });

    await notifyRoleChanges(deps(''));

    expect(
      framework.sharedReadModel.notificationPreferences
        .forMember(OWNER)
        .get(`equipment:${equipmentId}`)
    ).toBe('none');
    expect(sentEmails).toHaveLength(0);
  });

  it('writes only to the addresses on the list', async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: 91,
      email: 'tester@test.com' as EmailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.area.addOwner({areaId, memberNumber: 91});
    await raise('The blade is blunt');

    await notifyDigests(deps('tester@test.com'));

    expect(sentEmails.map(email => email.recipient)).toStrictEqual([
      'tester@test.com',
    ]);
  });
});
