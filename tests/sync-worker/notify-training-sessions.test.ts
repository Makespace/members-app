import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {DateTime} from 'luxon';
import {Actor, Email} from '../../src/types';
import {EmailAddress} from '../../src/types/email-address';
import {Config} from '../../src/configuration';
import {
  notifyTrainingSessions,
  NotifyTrainingSessionDependencies,
} from '../../src/sync-worker/notify_training_sessions';
import {TestFramework, initTestFramework} from '../read-models/test-framework';

// Who hears about sign-ups and cancellations, end to end: changes go in
// through the commands, and the notifier sends the emails.
describe('training session notifications', () => {
  let framework: TestFramework;
  let sentEmails: Email[];
  let deps: NotifyTrainingSessionDependencies;

  const TRAINER = 201;
  const MEMBER = 202;
  const OTHER = 203;
  const emailOf = (memberNumber: number) => `m${memberNumber}@test.com`;
  const as = (memberNumber: number): Actor => ({
    tag: 'user',
    user: {memberNumber, emailAddress: emailOf(memberNumber) as EmailAddress},
  });
  const areaId = faker.string.uuid() as UUID;
  const equipmentId = faker.string.uuid() as UUID;
  const sessionId = faker.string.uuid() as UUID;

  const notify = async () => {
    sentEmails = [];
    await notifyTrainingSessions(deps);
    return sentEmails;
  };
  const recipients = (emails: ReadonlyArray<Email>) =>
    emails.map(email => email.recipient).sort();

  beforeEach(async () => {
    framework = await initTestFramework();
    deps = {
      logger: framework.depsForCommands.logger,
      sharedReadModel: framework.sharedReadModel,
      getAllEventsByType: framework.depsForCommands.getAllEventsByType,
      commitEvent: framework.depsForCommands.commitEvent,
      sendEmail: (email: Email) => {
        sentEmails.push(email);
        return TE.right('sent');
      },
      conf: {
        PUBLIC_URL: 'https://members.makespace.org',
        TROUBLE_TICKET_NOTIFY_TO: 'all',
      } as unknown as Config,
    };
    for (const [memberNumber, name] of [
      [TRAINER, 'Tess Trainer'],
      [MEMBER, 'Morgan Member'],
      [OTHER, 'Olu Other'],
    ] as const) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: emailOf(memberNumber) as EmailAddress,
        name,
        formOfAddress: undefined,
      });
    }
    await framework.commands.area.create({
      id: areaId,
      name: 'Wood Shop' as NonEmptyString,
    });
    await framework.commands.equipment.add({
      id: equipmentId,
      name: 'Band Saw' as NonEmptyString,
      areaId,
    });
    await framework.commands.area.addOwner({areaId, memberNumber: TRAINER});
    await framework.commands.trainers.add({
      equipmentId,
      memberNumber: TRAINER,
    });
    const startsAt = DateTime.now().plus({days: 3});
    await framework.commands.trainers.arrangeTraining({
      sessionId,
      equipmentId,
      startsAt: startsAt.toJSDate(),
      endsAt: startsAt.plus({hours: 2}).toJSDate(),
      spaces: 4,
      description: '',
      attendees: [OTHER],
      signUpsCloseHoursBefore: 1,
      actor: as(TRAINER),
    });
  });

  afterEach(() => {
    framework.close();
  });

  it('tells nobody that a session was arranged', async () => {
    expect(await notify()).toStrictEqual([]);
  });

  it('tells the trainer when somebody signs up, once', async () => {
    await framework.commands.trainingSessions.signUp({
      sessionId,
      actor: as(MEMBER),
    });

    const [email, ...rest] = await notify();

    expect(rest).toStrictEqual([]);
    expect(email.recipient).toStrictEqual(emailOf(TRAINER));
    expect(email.subject).toStrictEqual(
      'Morgan Member signed up for your Band Saw training'
    );
    expect(email.text).toContain('Booked: 2 of 4');
    expect(email.text).toContain(
      `https://members.makespace.org/equipment/${equipmentId}/trainings`
    );
    expect(await notify()).toStrictEqual([]);
  });

  it('tells the trainer when somebody gives up their place', async () => {
    await framework.commands.trainingSessions.cancelPlace({
      sessionId,
      actor: as(OTHER),
    });

    const emails = await notify();

    expect(recipients(emails)).toStrictEqual([emailOf(TRAINER)]);
    expect(emails[0].subject).toStrictEqual(
      'Olu Other cancelled their place on your Band Saw training'
    );
  });

  it('tells everyone booked when the session is called off, with the reason', async () => {
    await framework.commands.trainingSessions.signUp({
      sessionId,
      actor: as(MEMBER),
    });
    await notify();
    await framework.commands.trainingSessions.cancel({
      sessionId,
      reason: 'The saw is broken',
      actor: as(TRAINER),
    });

    const emails = await notify();

    expect(recipients(emails)).toStrictEqual(
      [emailOf(MEMBER), emailOf(OTHER)].sort()
    );
    expect(emails[0].subject).toMatch(/^Cancelled: Band Saw training on /);
    expect(emails[0].text).toContain('Reason: The saw is broken');
    expect(emails[0].text).toContain(
      `https://members.makespace.org/equipment/${equipmentId}/training`
    );
  });

  it('draws the email like the trouble ticket ones', async () => {
    await framework.commands.trainingSessions.signUp({
      sessionId,
      actor: as(MEMBER),
    });

    const [email] = await notify();

    expect(email.html).toContain('#fa990e');
    expect(email.html).toContain('New sign-up');
    expect(email.html).toContain('View your trainings');
  });

  it('holds the mail back while notifications are switched off', async () => {
    deps = {
      ...deps,
      conf: {...deps.conf, TROUBLE_TICKET_NOTIFY_TO: ''} as Config,
    };
    await framework.commands.trainingSessions.signUp({
      sessionId,
      actor: as(MEMBER),
    });

    expect(await notify()).toStrictEqual([]);
  });
});
