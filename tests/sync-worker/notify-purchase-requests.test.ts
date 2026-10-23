import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {NonEmptyString, UUID} from 'io-ts-types';
import {Actor, Email} from '../../src/types';
import {EmailAddress} from '../../src/types/email-address';
import {Config} from '../../src/configuration';
import {
  notifyPurchaseRequests,
  NotifyPurchaseRequestDependencies,
} from '../../src/sync-worker/notify_purchase_requests';
import {TestFramework, initTestFramework} from '../read-models/test-framework';

// Who hears about a purchase request, and what they're told, end to end:
// requests go in through the commands, and the notifier sends the emails.
describe('purchase request notifications', () => {
  let framework: TestFramework;
  let sentEmails: Email[];
  let deps: NotifyPurchaseRequestDependencies;

  const REQUESTER = 101;
  const PURCHASER = 102;
  const MANAGER = 103;
  const DIRECTOR = 104;
  const METAL_OWNER = 105;
  const SUPER_USER = 106;
  const emailOf = (memberNumber: number) => `m${memberNumber}@test.com`;
  const asMember = (memberNumber: number): Actor => ({
    tag: 'user',
    user: {
      memberNumber,
      emailAddress: emailOf(memberNumber) as EmailAddress,
    },
  });

  const woodArea = faker.string.uuid() as UUID;
  const metalArea = faker.string.uuid() as UUID;
  const managementArea = faker.string.uuid() as UUID;
  const directorsArea = faker.string.uuid() as UUID;
  const purchasingAreaId = faker.string.uuid() as UUID;

  const request = async (
    cost: string,
    overrides: Record<string, unknown> = {},
    from = REQUESTER
  ) => {
    const id = faker.string.uuid() as UUID;
    await framework.commands.purchaseRequest.submit({
      id,
      purchasingAreaId,
      isMemberPaidConsumable: false,
      affectsOtherAreas: false,
      affectedAreaIds: undefined,
      healthAndSafetyRisk: false,
      proposal: {need: 'It is needed', options: [], preferred: '', risks: []},
      summary: 'Bandsaw <b>blades</b>' as never,
      purchases: [{shop: 'Axminster', items: [{notes: 'Blade', quantity: '1', cost}]}],
      justification: 'Worn out' as never,
      submittedByMemberNumber: undefined,
      buyingDirectly: undefined,
      amount: undefined,
      outsideBudget: undefined,
      ...overrides,
      actor: asMember(from),
    } as never);
    return id;
  };

  const notify = async () => {
    sentEmails = [];
    await notifyPurchaseRequests(deps);
    return sentEmails;
  };
  const recipients = (emails: ReadonlyArray<Email>) =>
    emails.map(email => email.recipient).sort();
  const to = (emails: ReadonlyArray<Email>, memberNumber: number) =>
    emails.find(email => email.recipient === emailOf(memberNumber))!;

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
        TROUBLE_TICKET_NOTIFY_TO: 'all',
        MANAGEMENT_TEAM_AREA_ID: managementArea,
        DIRECTORS_AREA_ID: directorsArea,
      } as unknown as Config,
    };
    for (const memberNumber of [
      REQUESTER,
      PURCHASER,
      MANAGER,
      DIRECTOR,
      METAL_OWNER,
      SUPER_USER,
    ]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber,
        email: emailOf(memberNumber) as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    for (const [id, name] of [
      [woodArea, 'Wood Shop'],
      [metalArea, 'Metal Shop'],
      [managementArea, 'Management Team'],
      [directorsArea, 'Directors'],
    ] as const) {
      await framework.commands.area.create({id, name: name as NonEmptyString});
    }
    for (const [areaId, memberNumber] of [
      [woodArea, REQUESTER],
      [woodArea, PURCHASER],
      [managementArea, MANAGER],
      [directorsArea, DIRECTOR],
      [metalArea, METAL_OWNER],
    ] as const) {
      await framework.commands.area.addOwner({areaId, memberNumber});
    }
    await framework.commands.superUser.declare({memberNumber: DIRECTOR});
    await framework.commands.superUser.declare({memberNumber: SUPER_USER});
    await framework.commands.purchasingArea.create({
      id: purchasingAreaId,
      name: 'Wood Shop' as NonEmptyString,
      yearlyBudget: 500_000,
    } as never);
    await framework.commands.purchasingArea.assignArea({
      purchasingAreaId,
      areaId: woodArea,
    } as never);
    await framework.commands.purchasingArea.addPurchaser({
      purchasingAreaId,
      memberNumber: PURCHASER,
    } as never);
  });

  afterEach(() => {
    framework.close();
  });

  describe('a request needing purchaser approval', () => {
    it("asks the area's purchasers, not whoever sent it", async () => {
      await request('50');
      const emails = await notify();
      expect(recipients(emails)).toStrictEqual([emailOf(PURCHASER)]);
      expect(emails[0].subject).toBe(
        'Purchase request to approve: Bandsaw <b>blades</b>'
      );
      expect(emails[0].text).toContain('Please approve or decline it.');
    });

    it('sends each email once', async () => {
      await request('50');
      await notify();
      expect(await notify()).toStrictEqual([]);
    });

    it('asks the super users when the area has no active purchaser', async () => {
      await framework.commands.area.removeOwner({
        areaId: woodArea,
        memberNumber: PURCHASER,
      } as never);
      await request('50');
      expect(recipients(await notify())).toStrictEqual(
        [emailOf(DIRECTOR), emailOf(SUPER_USER)].sort()
      );
    });

    it('tells everyone who heard, and whoever sent it, the outcome and note', async () => {
      const id = await request('50');
      await notify();
      await framework.commands.purchaseRequest.approve({
        id,
        note: 'Go ahead',
        actor: asMember(PURCHASER),
      });
      const emails = await notify();
      // The purchaser decided it, so isn't told about their own decision.
      expect(recipients(emails)).toStrictEqual([emailOf(REQUESTER)]);
      expect(emails[0].subject).toBe(
        'Purchase request approved: Bandsaw <b>blades</b>'
      );
      expect(emails[0].text).toContain('Note: Go ahead');
    });
  });

  describe('a request needing director approval', () => {
    it("tells the Management Team, the Directors and the area's owners", async () => {
      await request('1200');
      const emails = await notify();
      expect(recipients(emails)).toStrictEqual(
        [emailOf(PURCHASER), emailOf(MANAGER), emailOf(DIRECTOR)].sort()
      );
      // Only a super user can decide it.
      expect(to(emails, DIRECTOR).text).toContain('Please approve or decline it.');
      expect(to(emails, MANAGER).text).toContain("There's nothing you need to do.");
      expect(to(emails, MANAGER).subject).toBe(
        'Purchase request needing director approval: Bandsaw <b>blades</b>'
      );
    });

    it('also tells the owners of areas it could negatively impact', async () => {
      await request('50', {affectsOtherAreas: true, affectedAreaIds: [metalArea]});
      const emails = await notify();
      expect(recipients(emails)).toContain(emailOf(METAL_OWNER));
      expect(to(emails, METAL_OWNER).subject).toBe(
        'Purchase request that could affect your area: Bandsaw <b>blades</b>'
      );
      expect(to(emails, METAL_OWNER).text).toContain("an owners' meeting");
      expect(to(emails, METAL_OWNER).text).toContain(
        "You're an owner in an area it could potentially impact (Metal Shop)."
      );
      expect(to(emails, METAL_OWNER).text).not.toContain(
        "There's nothing you need to do."
      );
    });

    it('needs a note to approve, which everyone who heard is told', async () => {
      const id = await request('1200');
      await notify();
      await expect(
        framework.commands.purchaseRequest.approve({
          id,
          note: '',
          actor: asMember(DIRECTOR),
        })
      ).rejects.toThrow();
      await framework.commands.purchaseRequest.approve({
        id,
        note: 'Agreed at the October owners forum',
        actor: asMember(DIRECTOR),
      });
      const emails = await notify();
      expect(recipients(emails)).toStrictEqual(
        [emailOf(REQUESTER), emailOf(PURCHASER), emailOf(MANAGER)].sort()
      );
      expect(emails[0].text).toContain('Note: Agreed at the October owners forum');
    });
  });

  it('tells the Directors when a super user goes ahead without a proposal', async () => {
    await request(
      '0',
      {purchases: undefined, buyingDirectly: true, amount: '1200'},
      SUPER_USER
    );
    const emails = await notify();
    expect(recipients(emails)).toStrictEqual([emailOf(DIRECTOR)]);
    expect(emails[0].subject).toBe(
      'Purchase recorded without a proposal: Bandsaw <b>blades</b>'
    );
  });

  it("doesn't tell anyone about a purchase bought directly within the rules", async () => {
    await request('0', {purchases: undefined, buyingDirectly: true, amount: '50'}, PURCHASER);
    expect(await notify()).toStrictEqual([]);
  });

  it('escapes what was typed in the email', async () => {
    await request('50');
    const [email] = await notify();
    expect(email.html).toContain('Bandsaw &lt;b&gt;blades&lt;/b&gt;');
    expect(email.html).not.toContain('<b>blades</b>');
  });
});
