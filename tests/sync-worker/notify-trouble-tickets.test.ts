import {faker} from '@faker-js/faker';
import * as TE from 'fp-ts/TaskEither';
import {UUID} from 'io-ts-types';
import {constructEvent, Email} from '../../src/types';
import {EmailAddress} from '../../src/types/email-address';
import {Config} from '../../src/configuration';
import {DomainEvent} from '../../src/types/domain-event';
import {
  notifyTroubleTicketChanges,
  NotifyTroubleTicketDependencies,
} from '../../src/sync-worker/notify_trouble_tickets';
import {getRightOrFail, systemActor} from '../helpers';
import {TestFramework, initTestFramework} from '../read-models/test-framework';

const SUBMITTER = 50;

describe('notifyTroubleTicketChanges', () => {
  let framework: TestFramework;
  let sentEmails: Email[];
  let deps: NotifyTroubleTicketDependencies;
  let ticketId: UUID;

  const commit = async (event: DomainEvent) =>
    getRightOrFail(
      await framework.depsForCommands.commitEvent(
        framework.sharedReadModel.getCurrentEventIndex()
      )(event)()
    );

  beforeEach(async () => {
    framework = await initTestFramework();
    sentEmails = [];
    deps = {
      logger: framework.depsForCommands.logger,
      sharedReadModel: framework.sharedReadModel,
      getAllEventsByType: framework.depsForCommands.getAllEventsByType,
      commitEvent: framework.depsForCommands.commitEvent,
      sendEmail: (email: Email) => {
        sentEmails.push(email);
        return TE.right('sent');
      },
      conf: {PUBLIC_URL: 'https://members.makespace.org'} as unknown as Config,
    };

    ticketId = faker.string.uuid() as UUID;
    await commit(
      constructEvent('MemberNumberLinkedToEmail')({
        actor: systemActor(),
        memberNumber: SUBMITTER,
        email: 'submitter@test.com' as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      })
    );
    await commit(
      constructEvent('TroubleTicketCreated')({
        actor: systemActor(),
        id: ticketId,
        rowHash: faker.string.hexadecimal({length: 64}),
        sheetId: 'sheet-1',
        submittedAt: faker.date.past(),
        submittedMemberNumber: SUBMITTER,
        submittedEmail: 'submitter@test.com',
        submittedName: 'Sam Submitter',
        submittedEquipment: null,
        otherEquipmentDetail: '',
        status: 'Broken',
        attempting: 'x',
        issue: 'the issue',
        steps: '',
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  it('emails the submitter on a status change and records it', async () => {
    await commit(
      constructEvent('TroubleTicketResolved')({
        actor: systemActor(),
        ticketId,
        summary: 'fixed it',
      })
    );

    await notifyTroubleTicketChanges(deps);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].recipient).toStrictEqual('submitter@test.com');
    expect(sentEmails[0].subject).toContain('the issue');

    const notified = await framework.getAllEventsByType(
      'TroubleTicketNotificationSent'
    );
    expect(notified).toHaveLength(1);
  });

  it('does not re-notify on a second run', async () => {
    await commit(
      constructEvent('TroubleTicketResolved')({
        actor: systemActor(),
        ticketId,
        summary: 'fixed it',
      })
    );

    await notifyTroubleTicketChanges(deps);
    await notifyTroubleTicketChanges(deps);

    expect(sentEmails).toHaveLength(1);
  });
});
