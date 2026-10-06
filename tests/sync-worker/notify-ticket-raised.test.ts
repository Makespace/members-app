import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
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

const SUBMITTER = 61;

describe('confirming a newly raised ticket', () => {
  let framework: TestFramework;
  let sentEmails: Email[];
  let deps: NotifyTroubleTicketDependencies;

  const commit = async (event: DomainEvent) =>
    getRightOrFail(
      await framework.depsForCommands.commitEvent(
        framework.sharedReadModel.getCurrentEventIndex()
      )(event)()
    );

  const addTicket = async (source: 'app' | 'sheet' | 'email') =>
    commit(
      constructEvent('TroubleTicketCreated')({
        actor: systemActor(),
        id: faker.string.uuid() as UUID,
        rowHash: faker.string.hexadecimal({length: 64}),
        sheetId: source,
        submittedAt: new Date(),
        submittedMemberNumber: SUBMITTER,
        submittedEmail: 'submitter@test.com',
        submittedName: 'Sam Submitter',
        submittedEquipment: 'Bandsaw',
        equipmentId: null,
        machine: '',
        areaId: null,
        title: '',
        mailboxConversationId: '',
        source,
        otherEquipmentDetail: '',
        status: "It's not working",
        attempting: 'cutting',
        issue: 'Blade stalls',
        steps: '',
      })
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
    await commit(
      constructEvent('MemberNumberLinkedToEmail')({
        actor: systemActor(),
        memberNumber: SUBMITTER,
        email: 'submitter@test.com' as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  it('emails the member who raised it in the app', async () => {
    await addTicket('app');

    await notifyTroubleTicketChanges(deps);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].recipient).toStrictEqual('submitter@test.com');
    expect(sentEmails[0].subject).toContain("We've logged your report");
    expect(sentEmails[0].text).toContain('will address it soon');
  });

  // What keeps the imported history quiet is its age, not the route it came
  // in by. The backfill records each ticket at the time it was actually
  // reported, so years-old tickets fall outside the window.
  it('never emails about a ticket reported long ago', async () => {
    await addTicket('sheet');

    const muchLater = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    await notifyTroubleTicketChanges(deps, muchLater);

    expect(sentEmails).toHaveLength(0);
  });

  // The fix this replaced a source check for: somebody who reports a problem
  // on the Google form hears that it was logged, same as everybody else.
  it('tells the submitter about a ticket that came in on the form', async () => {
    await addTicket('sheet');

    await notifyTroubleTicketChanges(deps);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].recipient).toStrictEqual('submitter@test.com');
  });

  it('tells the member who wrote in to management', async () => {
    await addTicket('email');

    await notifyTroubleTicketChanges(deps);

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].recipient).toStrictEqual('submitter@test.com');
  });

  it('does not confirm the same ticket twice', async () => {
    await addTicket('app');
    await notifyTroubleTicketChanges(deps);
    await notifyTroubleTicketChanges(deps);

    expect(sentEmails).toHaveLength(1);
  });
});
