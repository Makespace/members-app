import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {Actor, constructEvent, EmailAddress} from '../../../src/types';
import {submit} from '../../../src/commands/purchase-request/submit';
import {
  EventOfType,
  isEventOfType,
} from '../../../src/types/domain-event';
import {
  arbitraryActor,
  getLeftOrFail,
  getRightOrFail,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('submit purchase request', () => {
  let framework: TestFramework;
  const purchasingAreaId = faker.string.uuid() as UUID;
  const areaId = faker.string.uuid() as UUID;
  const purchaserNumber = faker.number.int({min: 1, max: 50_000});
  const otherMemberNumber = purchaserNumber + 50_000;
  const userActor = (memberNumber: number): Actor => ({
    tag: 'user',
    user: {memberNumber, emailAddress: faker.internet.email() as EmailAddress},
  });
  const purchaser = userActor(purchaserNumber);

  const insert = (
    ...events: Parameters<TestFramework['insertIntoSharedReadModel']>[0][]
  ) => events.forEach(event => framework.insertIntoSharedReadModel(event));

  // What the browser posts, before decoding: pounds as strings, yes/no as
  // "true"/"false", and the fixed shop entries (blank ones included).
  const formBody = (overrides: Record<string, unknown> = {}) => ({
    id: faker.string.uuid(),
    purchasingAreaId,
    estimatedAmount: '250.00',
    isMemberPaidConsumable: 'false',
    isOperations: 'false',
    under100PerYear: 'false',
    summary: 'Sewing machine',
    purchases: [
      {
        shop: 'Sewing Direct',
        link: 'sewingdirect.com/machine',
        items: '1 x sewing machine',
        cost: '240',
      },
      {shop: '', link: '', items: '', cost: ''},
      {shop: '', link: '', items: '', cost: ''},
    ],
    justification: 'The old one is too small for quilts',
    ...overrides,
  });

  const submitAs = (actor: Actor, body: Record<string, unknown>) =>
    submit.process({
      command: {...getRightOrFail(submit.decode(body)), actor},
      rm: framework.sharedReadModel,
    });

  const submitted = async (
    body: Record<string, unknown>
  ): Promise<EventOfType<'PurchaseRequestSubmitted'>> => {
    const event = getSomeOrFail(
      await getTaskEitherRightOrFail(submitAs(purchaser, body))
    );
    if (!isEventOfType('PurchaseRequestSubmitted')(event)) {
      throw new Error(`Expected a purchase request, got ${event.type}`);
    }
    return event;
  };

  const failure = async (body: Record<string, unknown>, actor = purchaser) =>
    getLeftOrFail(await submitAs(actor, body)());

  beforeEach(async () => {
    framework = await initTestFramework();
    insert(
      constructEvent('MemberNumberLinkedToEmail')({
        actor: arbitraryActor(),
        memberNumber: purchaserNumber,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      }),
      constructEvent('MemberNumberLinkedToEmail')({
        actor: arbitraryActor(),
        memberNumber: otherMemberNumber,
        email: faker.internet.email() as EmailAddress,
        name: undefined,
        formOfAddress: undefined,
      }),
      constructEvent('AreaCreated')({
        actor: arbitraryActor(),
        id: areaId,
        name: 'Textiles',
      }),
      constructEvent('PurchasingAreaCreated')({
        actor: arbitraryActor(),
        id: purchasingAreaId,
        name: 'Textiles',
        yearlyBudgetPence: 150_000,
      }),
      constructEvent('AreaAssignedToPurchasingArea')({
        actor: arbitraryActor(),
        purchasingAreaId,
        areaId,
      }),
      constructEvent('OwnerAdded')({
        actor: arbitraryActor(),
        areaId,
        memberNumber: purchaserNumber,
      }),
      constructEvent('PurchaserAdded')({
        actor: arbitraryActor(),
        purchasingAreaId,
        memberNumber: purchaserNumber,
      })
    );
  });

  afterEach(() => {
    framework.close();
  });

  describe('a CapEx request within the budget', () => {
    it('records it as coming from the budget, with what it was worked out from', async () => {
      const body = formBody();
      expect(await submitted(body)).toMatchObject({
        type: 'PurchaseRequestSubmitted',
        id: body.id,
        purchasingAreaId,
        submittedByMemberNumber: purchaserNumber,
        summary: 'Sewing machine',
        estimatedAmountPence: 25_000,
        justification: 'The old one is too small for quilts',
        isMemberPaidConsumable: false,
        isOperations: false,
        under100PerYear: false,
        outcome: 'capex-from-budget',
        approval: 'none',
        budgetYear: new Date().getFullYear(),
        yearlyBudgetPence: 150_000,
        spentThisYearPence: 0,
      });
    });

    it('keeps only the filled-in shops, with the link and cost tidied', async () => {
      expect((await submitted(formBody())).purchases).toStrictEqual([
        {
          shop: 'Sewing Direct',
          link: 'https://sewingdirect.com/machine',
          items: '1 x sewing machine',
          costPence: 24_000,
        },
      ]);
    });

    it('ignores an outcome the browser tries to supply', async () => {
      const event = await submitted(
        formBody({outcome: 'opex-consumable', estimatedAmount: '100.00'})
      );
      expect(event.outcome).toStrictEqual('capex-from-budget');
    });
  });

  describe('when earlier CapEx this year leaves too little budget', () => {
    beforeEach(async () => {
      insert(await submitted(formBody({estimatedAmount: '900.00'})));
    });

    it('needs a proposal', async () => {
      const event = await submitted(formBody({estimatedAmount: '600.01'}));
      expect(event).toMatchObject({
        outcome: 'capex-proposal-needed',
        approval: 'proposal',
        spentThisYearPence: 90_000,
      });
    });

    it('comes from the budget when it lands exactly on it', async () => {
      const event = await submitted(formBody({estimatedAmount: '600.00'}));
      expect(event.outcome).toStrictEqual('capex-from-budget');
    });
  });

  it('needs a proposal for a single purchase of exactly £1,000', async () => {
    insert(
      constructEvent('PurchasingAreaBudgetSet')({
        actor: arbitraryActor(),
        purchasingAreaId,
        yearlyBudgetPence: 1_000_000,
      })
    );
    const event = await submitted(formBody({estimatedAmount: '1000'}));
    expect(event.outcome).toStrictEqual('capex-proposal-needed');
  });

  it('uses the estimate, not the shop costs, even when they disagree', async () => {
    const event = await submitted(
      formBody({
        estimatedAmount: '100.00',
        purchases: [{shop: 'A', items: 'thing', cost: '5000.00'}],
      })
    );
    expect(event).toMatchObject({
      estimatedAmountPence: 10_000,
      outcome: 'capex-from-budget',
    });
  });

  describe('a consumable members pay for', () => {
    it('is OpEx, with the questions it did not need dropped', async () => {
      const event = await submitted(
        formBody({
          isMemberPaidConsumable: 'true',
          isOperations: '',
          under100PerYear: 'true',
        })
      );
      expect(event).toMatchObject({
        outcome: 'opex-consumable',
        isMemberPaidConsumable: true,
        isOperations: null,
        under100PerYear: null,
      });
    });
  });

  it("records that operations spending needs the directors' approval", async () => {
    const event = await submitted(
      formBody({isOperations: 'true', estimatedAmount: '630.00'})
    );
    expect(event).toMatchObject({
      outcome: 'opex-operations',
      approval: 'directors',
      under100PerYear: null,
    });
  });

  it('asks for the operations answer when it is needed and missing', async () => {
    const body = formBody();
    delete (body as Record<string, unknown>).isOperations;
    expect(await failure(body)).toMatchObject({
      status: StatusCodes.BAD_REQUEST,
      message:
        'Please say whether this is maintenance, a running cost or a like-for-like replacement.',
    });
  });

  describe('the shops', () => {
    it('needs at least one', async () => {
      expect(
        await failure(formBody({purchases: [{shop: '', items: ''}]}))
      ).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        message: 'Please add at least one shop or website to buy from.',
      });
    });

    it('needs the items for each shop given', async () => {
      expect(
        await failure(
          formBody({
            purchases: [
              {shop: 'A', items: 'thing'},
              {shop: 'Hobbycraft', items: ' '},
            ],
          })
        )
      ).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        message: 'Shop 2: please list what to buy from Hobbycraft.',
      });
    });

    it('needs the shop for each list of items', async () => {
      expect(
        await failure(formBody({purchases: [{shop: '', items: 'thing'}]}))
      ).toMatchObject({
        message: 'Shop 1: please say which shop or website.',
      });
    });

    it('refuses a link that is not a web address', async () => {
      expect(
        await failure(
          formBody({purchases: [{shop: 'A', items: 'x', link: 'ftp://a.b'}]})
        )
      ).toMatchObject({status: StatusCodes.BAD_REQUEST});
    });

    it('refuses a cost that is not an amount', async () => {
      expect(
        await failure(
          formBody({purchases: [{shop: 'A', items: 'x', cost: 'lots'}]})
        )
      ).toMatchObject({
        message: 'A: the cost should be in pounds, e.g. 42.50.',
      });
    });

    it('accepts shops posted keyed by index, in index order', async () => {
      const event = await submitted(
        formBody({
          purchases: {
            '21': {shop: 'Second', items: 'b'},
            '3': {shop: 'First', items: 'a', link: '', cost: ''},
          },
        })
      );
      expect(event.purchases.map(purchase => purchase.shop)).toStrictEqual([
        'First',
        'Second',
      ]);
    });

    it('records several shops', async () => {
      const event = await submitted(
        formBody({
          purchases: [
            {shop: 'A', items: '2 x a'},
            {shop: 'B', items: '1 x b', cost: '3.50'},
          ],
        })
      );
      expect(event.purchases).toStrictEqual([
        {shop: 'A', link: null, items: '2 x a', costPence: null},
        {shop: 'B', link: null, items: '1 x b', costPence: 350},
      ]);
    });
  });

  it('refuses an estimate of nothing', () => {
    expect(submit.decode(formBody({estimatedAmount: '0'}))._tag).toStrictEqual(
      'Left'
    );
  });

  it('fails for a purchasing area that does not exist', async () => {
    expect(
      await failure(formBody({purchasingAreaId: faker.string.uuid()}))
    ).toMatchObject({status: StatusCodes.NOT_FOUND});
  });

  it('must come from a logged-in member', async () => {
    expect(await failure(formBody(), arbitraryActor())).toMatchObject({
      status: StatusCodes.BAD_REQUEST,
      message: 'Purchase requests must be submitted by a logged-in member.',
    });
  });

  it('does nothing when the same request is submitted twice', async () => {
    const body = formBody();
    insert(await submitted(body));
    expect(await getTaskEitherRightOrFail(submitAs(purchaser, body))).toStrictEqual(
      O.none
    );
  });

  describe('who may submit', () => {
    const input = () => getRightOrFail(submit.decode(formBody()));

    it('is a purchaser for the purchasing area', () => {
      expect(
        submit.isAuthorized({
          actor: purchaser,
          rm: framework.sharedReadModel,
          input: input(),
        })
      ).toBe(true);
    });

    it('is not any other member', () => {
      expect(
        submit.isAuthorized({
          actor: userActor(otherMemberNumber),
          rm: framework.sharedReadModel,
          input: input(),
        })
      ).toBe(false);
    });

    it('is a super user', () => {
      insert(
        constructEvent('SuperUserDeclared')({
          actor: arbitraryActor(),
          memberNumber: otherMemberNumber,
        })
      );
      expect(
        submit.isAuthorized({
          actor: userActor(otherMemberNumber),
          rm: framework.sharedReadModel,
          input: input(),
        })
      ).toBe(true);
    });
  });
});
