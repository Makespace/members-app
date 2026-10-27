import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
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

const MEMBER = 61;
const OWNER = 62;
const ISSUE = 'Buy cheap watches at spam.example';
const TYPED_NAME = 'Visit spam.example today';

// Anybody can type anybody's address into the public form, so whatever goes
// to that address must be useless for sending a stranger a message.
describe('emails about a ticket raised without logging in', () => {
  let framework: TestFramework;
  let sentEmails: Email[];
  let deps: NotifyTroubleTicketDependencies;
  let equipmentId: UUID;

  const commit = async (event: DomainEvent) =>
    getRightOrFail(
      await framework.depsForCommands.commitEvent(
        framework.sharedReadModel.getCurrentEventIndex()
      )(event)()
    );

  const raise = async (
    reporter: {
      submittedMemberNumber: number | null;
      providedMemberNumber: number | null;
      submittedEmail: string | null;
    },
    source: 'public' | 'app' = 'public'
  ) => {
    const id = faker.string.uuid() as UUID;
    await commit(
      constructEvent('TroubleTicketCreated')({
        actor: source === 'public' ? {tag: 'public'} : systemActor(),
        id,
        rowHash: `app:${faker.string.uuid()}`,
        sheetId: 'app',
        submittedAt: new Date(),
        ...reporter,
        submittedName: TYPED_NAME,
        submittedEquipment: 'Band Saw',
        equipmentId,
        machine: '',
        areaId: null,
        title: '',
        mailboxConversationId: '',
        source,
        otherEquipmentDetail: '',
        status: "It's not working",
        attempting: '',
        issue: ISSUE,
        steps: '',
      })
    );
    return id;
  };

  const to = (address: string) =>
    sentEmails.filter(email => email.recipient === address);

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
        TOKEN_SECRET: 'test-token-secret',
        TROUBLE_TICKET_NOTIFY_TO: 'all',
      } as unknown as Config,
    };
    const areaId = faker.string.uuid() as UUID;
    equipmentId = faker.string.uuid() as UUID;
    for (const [memberNumber, email] of [
      [MEMBER, 'member@test.com'],
      [OWNER, 'owner@test.com'],
    ] as const) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: email as EmailAddress,
        name: undefined,
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
    await framework.commands.area.addOwner({areaId, memberNumber: OWNER});
    await framework.commands.notificationPreferences.set({
      memberNumber: OWNER,
      scope: 'my-areas' as NonEmptyString,
      preference: 'live',
    });
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the address is on a member account', () => {
    beforeEach(async () => {
      await raise({
        submittedMemberNumber: MEMBER,
        providedMemberNumber: null,
        submittedEmail: 'member@test.com',
      });
      await notifyTroubleTicketChanges(deps);
    });

    it('confirms it once, to that address', () => {
      expect(to('member@test.com')).toHaveLength(1);
    });

    it('tells them their member number', () => {
      expect(to('member@test.com')[0].text).toContain(
        `Your member number is ${MEMBER}`
      );
    });

    it('names the machine as we list it, and nothing they typed', () => {
      const [email] = to('member@test.com');
      expect(email.subject).toStrictEqual(
        "We've logged your report about the Band Saw"
      );
      for (const part of [email.subject, email.text, email.html]) {
        expect(part).not.toContain('spam.example');
      }
    });

    it('still gives the owners the whole report', () => {
      expect(to('owner@test.com')[0].text).toContain(ISSUE);
    });
  });

  describe('when the address is on no account', () => {
    beforeEach(async () => {
      await raise({
        submittedMemberNumber: null,
        providedMemberNumber: MEMBER,
        submittedEmail: 'personal@elsewhere.com',
      });
      await notifyTroubleTicketChanges(deps);
    });

    it('confirms it to that address, and only there', () => {
      expect(to('personal@elsewhere.com')).toHaveLength(1);
      expect(to('member@test.com')).toHaveLength(0);
    });

    it('says the address is not on the account for the number they gave', () => {
      expect(to('personal@elsewhere.com')[0].text).toContain(
        `This email address isn't on the account for member ${MEMBER}`
      );
    });

    it('gives them the link to put it on their account', () => {
      const [email] = to('personal@elsewhere.com');
      expect(email.text).toContain(
        'https://members.makespace.org/trouble-tickets/claim?token='
      );
      expect(email.html).toContain('/trouble-tickets/claim?token=');
    });

    it('sends back nothing they typed', () => {
      const [email] = to('personal@elsewhere.com');
      for (const part of [email.subject, email.text, email.html]) {
        expect(part).not.toContain('spam.example');
      }
    });
  });

  // The ticket's title starts out as the issue text, and an update quotes
  // it, so an update to an address on no account must not.
  it('keeps what they typed out of later updates to an address on no account', async () => {
    const ticketId = await raise({
      submittedMemberNumber: null,
      providedMemberNumber: null,
      submittedEmail: 'personal@elsewhere.com',
    });
    await notifyTroubleTicketChanges(deps);
    sentEmails = [];

    await commit(
      constructEvent('TroubleTicketResolved')({
        actor: systemActor(),
        ticketId,
        summary: 'Replaced the blade',
        quiet: false,
      })
    );
    await notifyTroubleTicketChanges(deps);

    const [update] = to('personal@elsewhere.com');
    expect(update.subject).toStrictEqual('Trouble ticket update: Band Saw');
    expect(update.text).toContain('Replaced the blade');
    expect(update.text).toContain('/trouble-tickets/claim?token=');
    for (const part of [update.subject, update.text, update.html]) {
      expect(part).not.toContain('spam.example');
    }
  });

  it('reminds a logged-in member of their number when confirming their report', async () => {
    await raise(
      {
        submittedMemberNumber: MEMBER,
        providedMemberNumber: null,
        submittedEmail: 'member@test.com',
      },
      'app'
    );

    await notifyTroubleTicketChanges(deps);

    expect(to('member@test.com')[0].text).toContain(
      `Your member number is ${MEMBER}`
    );
  });
});
