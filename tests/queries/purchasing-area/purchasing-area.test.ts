import * as E from 'fp-ts/Either';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {constructEvent, EmailAddress, User} from '../../../src/types';
import {constructViewModel} from '../../../src/queries/purchasing-area/construct-view-model';
import {render} from '../../../src/queries/purchasing-area/render';
import {arbitraryActor, getLeftOrFail, getRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('purchasing area page', () => {
  let framework: TestFramework;
  const now = new Date();
  const purchasingAreaId = faker.string.uuid() as UUID;
  const areaId = faker.string.uuid() as UUID;
  const purchaser: User = {
    memberNumber: faker.number.int({min: 1, max: 50_000}),
    emailAddress: faker.internet.email() as EmailAddress,
  };
  const superUser: User = {
    memberNumber: purchaser.memberNumber + 50_000,
    emailAddress: faker.internet.email() as EmailAddress,
  };
  const member: User = {
    memberNumber: purchaser.memberNumber + 100_000,
    emailAddress: faker.internet.email() as EmailAddress,
  };

  const insert = (
    ...events: Parameters<TestFramework['insertIntoSharedReadModel']>[0][]
  ) => events.forEach(event => framework.insertIntoSharedReadModel(event));

  // The rendered page, with markup and whitespace runs collapsed to spaces,
  // plus the raw HTML for checking links.
  const pageFor = (user: User) => {
    const rendered = render(
      getRightOrFail(
        constructViewModel(framework.sharedReadModel, user, now)(
          purchasingAreaId
        )
      )
    );
    return {
      html: rendered,
      textContent: rendered.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' '),
    };
  };

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const user of [purchaser, superUser, member]) {
      insert(
        constructEvent('MemberNumberLinkedToEmail')({
          actor: arbitraryActor(),
          memberNumber: user.memberNumber,
          email: user.emailAddress,
          name: undefined,
          formOfAddress: undefined,
        })
      );
    }
    insert(
      constructEvent('SuperUserDeclared')({
        actor: arbitraryActor(),
        memberNumber: superUser.memberNumber,
      }),
      constructEvent('AreaCreated')({
        actor: arbitraryActor(),
        id: areaId,
        name: 'Wood Shop',
      }),
      constructEvent('PurchasingAreaCreated')({
        actor: arbitraryActor(),
        id: purchasingAreaId,
        name: 'Woodwork',
        yearlyBudgetPence: 200_000,
      }),
      constructEvent('AreaAssignedToPurchasingArea')({
        actor: arbitraryActor(),
        purchasingAreaId,
        areaId,
      }),
      constructEvent('OwnerAdded')({
        actor: arbitraryActor(),
        areaId,
        memberNumber: purchaser.memberNumber,
      }),
      constructEvent('PurchaserAdded')({
        actor: arbitraryActor(),
        purchasingAreaId,
        memberNumber: purchaser.memberNumber,
      })
    );
    await framework.commands.purchaseRequest.submit({
      id: faker.string.uuid() as UUID,
      purchasingAreaId,
      isMemberPaidConsumable: false,
      affectsOtherAreas: false,
      affectedAreaIds: undefined,
      healthAndSafetyRisk: false,
      proposal: undefined,
      summary: 'Bandsaw blades' as never,
      purchases: [
        {
          shop: 'Axminster',
          items: [{notes: 'Bandsaw blade', quantity: '5', cost: '500.00'}],
        },
      ],
      justification: 'Worn out' as never,
      submittedByMemberNumber: undefined,
      actor: {tag: 'user', user: purchaser},
    });
  });

  afterEach(() => {
    framework.close();
  });

  it("shows this year's budget, spend and what is left", () => {
    const text = pageFor(member).textContent ?? '';
    expect(text).toContain('£2,000.00');
    expect(text).toContain('£500.00');
    expect(text).toContain('£1,500.00');
  });

  // The requests table's "By" cell for the one request.
  const byCell = (user: User) => {
    const {html} = pageFor(user);
    const table = html.slice(html.indexOf('Purchase requests in'));
    const row = table.slice(table.indexOf('<tbody>'));
    return row.slice(0, row.indexOf('Bandsaw blades'));
  };

  it('shows who sent each request as the member, number linked', () => {
    expect(byCell(member)).toContain(
      `href=/member/${purchaser.memberNumber}/`
    );
  });

  it("shows the sender's email only to super users and area owners", () => {
    expect(byCell(superUser)).toContain(purchaser.emailAddress);
    expect(byCell(purchaser)).toContain(purchaser.emailAddress);
    expect(byCell(member)).not.toContain(purchaser.emailAddress);
  });

  it('links its areas and lists its requests', () => {
    const page = pageFor(member);
    expect(page.html).toContain(`href="/areas#area-${areaId}"`);
    expect(page.textContent).toContain('Bandsaw blades');
    expect(page.textContent).toContain('Yearly budget');
  });

  it("doesn't count consumables against the budget", async () => {
    await framework.commands.purchaseRequest.submit({
      id: faker.string.uuid() as UUID,
      purchasingAreaId,
      isMemberPaidConsumable: true,
      affectsOtherAreas: false,
      affectedAreaIds: undefined,
      healthAndSafetyRisk: false,
      proposal: undefined,
      summary: 'Sanding discs' as never,
      purchases: [
        {
          shop: 'Axminster',
          items: [{notes: 'Sanding disc', quantity: '100', cost: '630.00'}],
        },
      ],
      justification: 'Sold to members' as never,
      submittedByMemberNumber: undefined,
      actor: {tag: 'user', user: purchaser},
    });
    const text = pageFor(member).textContent;
    expect(text).toContain('Paid for by members (not from the yearly budget)');
    expect(text).toContain('£1,500.00');
  });

  it('lets a member look without changing anything or requesting', () => {
    const page = pageFor(member);
    expect(page.textContent).not.toContain('Add purchaser');
    expect(page.textContent).not.toContain('Request a purchase');
  });

  it('lets a purchaser request a purchase', () => {
    expect(pageFor(purchaser).textContent).toContain('Request a purchase');
    expect(pageFor(purchaser).textContent).not.toContain('Set budget');
  });

  it('lets a super user manage areas, budget and purchasers', () => {
    const page = pageFor(superUser);
    expect(page.textContent).toContain('Add area');
    expect(page.textContent).toContain('Set usual budget');
    expect(page.textContent).toContain('Add purchaser');
    expect(page.html).toContain(
      `href="/purchasing-areas/remove-purchaser?purchasingArea=${purchasingAreaId}&amp;member=${purchaser.memberNumber}"`
    );
  });

  describe("with this year's own budget and recorded spending", () => {
    const spendId = faker.string.uuid() as UUID;
    beforeEach(() => {
      framework.insertIntoSharedReadModel(
        constructEvent('PurchasingAreaYearBudgetSet')({
          actor: arbitraryActor(),
          purchasingAreaId,
          budgetYear: now.getFullYear(),
          yearlyBudgetPence: 500_000,
        })
      );
      framework.insertIntoSharedReadModel(
        constructEvent('PurchasingAreaSpendRecorded')({
          actor: arbitraryActor(),
          id: spendId,
          purchasingAreaId,
          budgetYear: now.getFullYear(),
          amountPence: 300_000,
          description: 'Before requests were in the app',
        })
      );
    });

    it('shows the budget for the year against the usual one, and the recorded spending', () => {
      const text = pageFor(member).textContent;
      expect(text).toContain('£5,000.00 (usually £2,000.00)');
      expect(text).toContain('Before requests were in the app');
      expect(text).toContain('£3,000.00');
      expect(text).toContain('£3,500.00');
    });

    it('lets only super users record spending, set the year budget or remove spending', () => {
      const removeLink = `href="/purchasing-areas/remove-spend?purchasingArea=${purchasingAreaId}&amp;spend=${spendId}"`;
      const forSuperUser = pageFor(superUser);
      expect(forSuperUser.textContent).toContain('Record spending');
      expect(forSuperUser.textContent).toContain(`Set ${now.getFullYear()}'s budget`);
      expect(forSuperUser.textContent).toContain('Set usual budget');
      expect(forSuperUser.html).toContain(removeLink);
      const forMember = pageFor(member);
      expect(forMember.textContent).not.toContain('Record spending');
      expect(forMember.html).not.toContain(removeLink);
    });
  });

  it('is not found for an unknown purchasing area', () => {
    const result = constructViewModel(
      framework.sharedReadModel,
      member,
      now
    )(faker.string.uuid());
    expect(E.isLeft(result)).toBe(true);
    expect(getLeftOrFail(result)).toMatchObject({
      status: StatusCodes.NOT_FOUND,
    });
  });
});
