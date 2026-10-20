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
      summary: 'Bandsaw blades' as never,
      purchases: [{shop: 'Axminster', items: '5 x blade', cost: '500.00'}],
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
      summary: 'Sanding discs' as never,
      purchases: [{shop: 'Axminster', items: '100 x disc', cost: '630.00'}],
      justification: 'Sold to members' as never,
      submittedByMemberNumber: undefined,
      actor: {tag: 'user', user: purchaser},
    });
    const text = pageFor(member).textContent;
    expect(text).toContain('Consumable (not from the yearly budget)');
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
    expect(page.textContent).toContain('Set budget');
    expect(page.textContent).toContain('Add purchaser');
    expect(page.html).toContain(
      `href="/purchasing-areas/remove-purchaser?purchasingArea=${purchasingAreaId}&amp;member=${purchaser.memberNumber}"`
    );
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
