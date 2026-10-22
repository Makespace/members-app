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
      conf: {
        PUBLIC_URL: 'https://members.makespace.org',
        // These tests are about what gets sent, so the mail is switched on.
        TROUBLE_TICKET_NOTIFY_TO: 'all',
      } as unknown as Config,
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
        source: 'sheet',
        equipmentId: null,
        machine: '',
        areaId: null,
        title: '',
        mailboxConversationId: '',
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

  // Logging a ticket now tells whoever reported it, whatever route it came
  // in by. Each test below is about a later change, so the confirmation is
  // sent and cleared first rather than counted in every assertion.
  const settle = async () => {
    await notifyTroubleTicketChanges(deps);
    sentEmails.length = 0;
  };

  afterEach(() => {
    framework.close();
  });

  it('emails the submitter on a status change and records it', async () => {
    await settle();
    await commit(
      constructEvent('TroubleTicketResolved')({
        quiet: false,
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
    // One for logging the ticket, one for resolving it.
    expect(notified).toHaveLength(2);
    // The record says who was told, so the ticket's history can.
    expect(notified[notified.length - 1].recipients).toEqual([
      'submitter@test.com',
    ]);
  });

  it('a quiet resolve sends no email and records no marker', async () => {
    await settle();
    const before = await framework.getAllEventsByType(
      'TroubleTicketNotificationSent'
    );
    await commit(
      constructEvent('TroubleTicketResolved')({
        quiet: true,
        actor: systemActor(),
        ticketId,
        summary: 'was already fixed months ago',
      })
    );

    await notifyTroubleTicketChanges(deps);

    expect(sentEmails).toHaveLength(0);
    const notified = await framework.getAllEventsByType(
      'TroubleTicketNotificationSent'
    );
    expect(notified).toHaveLength(before.length);
  });

  it('does not re-notify on a second run', async () => {
    await settle();
    await commit(
      constructEvent('TroubleTicketResolved')({
        quiet: false,
        actor: systemActor(),
        ticketId,
        summary: 'fixed it',
      })
    );

    await notifyTroubleTicketChanges(deps);
    await notifyTroubleTicketChanges(deps);

    expect(sentEmails).toHaveLength(1);
  });

  // A super-user handing a ticket to somebody: the submitter hears who is on
  // it now, and the one it was handed to hears that it is theirs.
  describe('when a ticket is assigned to somebody else', () => {
    const ASSIGNER = 1337;
    const ASSIGNEE = 7;

    const link = (memberNumber: number, name: string) =>
      commit(
        constructEvent('MemberNumberLinkedToEmail')({
          actor: systemActor(),
          memberNumber,
          email: `member${memberNumber}@test.com` as EmailAddress,
          name,
          formOfAddress: undefined,
        })
      );

    const assignedBy = (actorNumber: number) =>
      commit(
        constructEvent('TroubleTicketAssigned')({
          actor: {
            tag: 'user',
            user: {
              emailAddress: `member${actorNumber}@test.com` as EmailAddress,
              memberNumber: actorNumber,
            },
          },
          ticketId,
          trainerMemberNumber: ASSIGNEE,
          comment: 'Back on Tuesday',
        })
      );

    beforeEach(async () => {
      await link(ASSIGNER, 'Ada Admin');
      await link(ASSIGNEE, 'Tara Trainer');
      await settle();
    });

    const emailTo = (recipient: string) =>
      sentEmails.find(email => email.recipient === recipient);

    it('tells the submitter who is working on it and who assigned it', async () => {
      await assignedBy(ASSIGNER);
      await notifyTroubleTicketChanges(deps);

      expect(emailTo('submitter@test.com')?.text).toContain(
        'Tara Trainer is now working on this ticket (assigned by Ada Admin).'
      );
      // The comment is the assigner's, not the assignee's.
      expect(emailTo('submitter@test.com')?.text).toContain(
        'Ada Admin said: Back on Tuesday'
      );
    });

    it('tells the member it was assigned to that it is theirs', async () => {
      await assignedBy(ASSIGNER);
      await notifyTroubleTicketChanges(deps);

      expect(emailTo('member7@test.com')?.text).toContain(
        'Ada Admin has assigned this ticket to you.'
      );
    });

    it('records the member it was assigned to among those told', async () => {
      await assignedBy(ASSIGNER);
      await notifyTroubleTicketChanges(deps);

      const notified = await framework.getAllEventsByType(
        'TroubleTicketNotificationSent'
      );
      expect(notified[notified.length - 1].recipients).toContain(
        'member7@test.com'
      );
    });

    // Picking a ticket up yourself is not news to you.
    it('does not email somebody who picked the ticket up themselves', async () => {
      await assignedBy(ASSIGNEE);
      await notifyTroubleTicketChanges(deps);

      expect(emailTo('member7@test.com')).toBeUndefined();
      expect(emailTo('submitter@test.com')?.text).toContain(
        'Tara Trainer is now working on this ticket.'
      );
    });
  });
});
