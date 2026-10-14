import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Email} from '../../src/types';
import {EmailAddress} from '../../src/types/email-address';
import {Config} from '../../src/configuration';
import {
  forgetAnnouncedRoleChanges,
  notifyRoleChanges,
} from '../../src/sync-worker/notify_role_changes';
import {heldBackSendEmail} from '../../src/trouble-tickets/notification-gate';
import {initTestFramework, TestFramework} from '../read-models/test-framework';

// What the log says about a notification. Somebody checking that the thing
// runs at all has only the log to go on, so "it worked" has to be visible -
// and the lines that repeat every cycle have to not be.

describe('what the notifications say in the log', () => {
  let framework: TestFramework;
  let logged: Array<{level: string; detail: unknown; msg: string}>;
  const MEMBER = 95;
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;

  const recordingLogger = () =>
    ({
      ...framework.depsForCommands.logger,
      info: (detail: unknown, msg?: string) => {
        logged.push({level: 'info', detail, msg: msg ?? String(detail)});
      },
    }) as unknown as TestFramework['depsForCommands']['logger'];

  const deps = (notifyTo: string, sendEmail?: (email: Email) => unknown) => ({
    logger: recordingLogger(),
    sharedReadModel: framework.sharedReadModel,
    getAllEventsByType: framework.depsForCommands.getAllEventsByType,
    commitEvent: framework.depsForCommands.commitEvent,
    sendEmail: ((email: Email) => {
      sendEmail?.(email);
      return TE.right('sent' as const);
    }) as never,
    conf: {
      PUBLIC_URL: 'https://members.makespace.org',
      TROUBLE_TICKET_NOTIFY_TO: notifyTo,
    } as unknown as Config,
  });

  const anEmail = (recipient: string): Email => ({
    recipient: recipient as EmailAddress,
    subject: 'New trouble ticket: The blade is blunt',
    text: 'body',
    html: '<p>body</p>',
  });

  beforeEach(async () => {
    framework = await initTestFramework();
    logged = [];
    forgetAnnouncedRoleChanges();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: MEMBER,
      email: 'member@test.com' as EmailAddress,
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
  });

  afterEach(() => framework.close());

  // Without this, a notification that worked and one that never happened
  // look exactly the same from the log.
  it('says so when an email actually goes out', async () => {
    await heldBackSendEmail(deps('all'))(anEmail('member@test.com'))();

    expect(logged).toHaveLength(1);
    expect(logged[0].msg).toContain('Sent a trouble ticket notification');
    expect(logged[0].detail).toMatchObject({
      emailed: 'member@test.com',
      about: 'New trouble ticket: The blade is blunt',
    });
  });

  it('still says so when one is held back', async () => {
    await heldBackSendEmail(deps(''))(anEmail('member@test.com'))();

    expect(logged[0].msg).toContain('Held back');
    expect(logged[0].detail).toMatchObject({
      wouldHaveEmailed: 'member@test.com',
    });
  });

  // The job reconsiders every held-back role change every cycle. Saying so
  // each time buries everything else in the log.
  it('mentions a held-back role change once, not every cycle', async () => {
    await framework.commands.area.addOwner({areaId, memberNumber: MEMBER});

    await notifyRoleChanges(deps(''));
    await notifyRoleChanges(deps(''));
    await notifyRoleChanges(deps(''));

    expect(
      logged.filter(line => line.msg.includes('Held back a role change'))
    ).toHaveLength(1);
  });
});
