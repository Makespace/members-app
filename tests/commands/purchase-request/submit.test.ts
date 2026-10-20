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

  const blankItem = {url: '', sku: '', quantity: '', cost: '', notes: ''};

  // What the browser posts, before decoding: pounds as strings, yes/no as
  // "true"/"false", and the fixed shop and item entries (blank ones included).
  const formBody = (overrides: Record<string, unknown> = {}) => ({
    id: faker.string.uuid(),
    purchasingAreaId,
    isMemberPaidConsumable: 'false',
    affectsOtherAreas: 'false',
    healthAndSafetyRisk: 'false',
    summary: 'Sewing machine',
    purchases: [
      {
        shop: 'Sewing Direct',
        delivery: '10',
        items: [
          {
            url: 'sewingdirect.com/machine',
            sku: 'SD-200',
            quantity: '1',
            cost: '230',
            notes: 'Quilting model',
          },
          blankItem,
          blankItem,
        ],
      },
      {shop: '', delivery: '', items: [blankItem, blankItem, blankItem]},
    ],
    justification: 'The old one is too small for quilts',
    ...overrides,
  });

  // One shop with one item costing this much, in pounds: the itemised total
  // that decides the outcome.
  const costing = (cost: string) => ({
    purchases: [
      {shop: 'Sewing Direct', items: [{notes: 'Thing', quantity: '1', cost}]},
    ],
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

  describe('a budget request within the budget', () => {
    it('records it as coming from the budget, with what it was worked out from', async () => {
      const body = formBody();
      expect(await submitted(body)).toMatchObject({
        type: 'PurchaseRequestSubmitted',
        id: body.id,
        purchasingAreaId,
        submittedByMemberNumber: purchaserNumber,
        summary: 'Sewing machine',
        totalPence: 24_000,
        justification: 'The old one is too small for quilts',
        isMemberPaidConsumable: false,
        outcome: 'budget',
        approval: 'none',
        budgetYear: new Date().getFullYear(),
        yearlyBudgetPence: 150_000,
        spentThisYearPence: 0,
      });
    });

    it('keeps only the filled-in shops and items, tidied', async () => {
      expect((await submitted(formBody())).purchases).toStrictEqual([
        {
          shop: 'Sewing Direct',
          items: [
            {
              url: 'https://sewingdirect.com/machine',
              sku: 'SD-200',
              quantity: 1,
              costPence: 23_000,
              notes: 'Quilting model',
            },
          ],
          deliveryPence: 1_000,
        },
      ]);
    });

    it('ignores an outcome the browser tries to supply', async () => {
      const event = await submitted(
        formBody({outcome: 'consumable'})
      );
      expect(event.outcome).toStrictEqual('budget');
    });
  });

  describe('when earlier spending this year leaves too little budget', () => {
    beforeEach(async () => {
      insert(await submitted(formBody(costing('900.00'))));
    });

    it('needs a proposal', async () => {
      const event = await submitted(formBody(costing('600.01')));
      expect(event).toMatchObject({
        outcome: 'budget-proposal-needed',
        approval: 'proposal',
        spentThisYearPence: 90_000,
      });
    });

    it('comes from the budget when it lands exactly on it', async () => {
      const event = await submitted(formBody(costing('600.00')));
      expect(event.outcome).toStrictEqual('budget');
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
    const event = await submitted(formBody(costing('1000')));
    expect(event.outcome).toStrictEqual('budget-proposal-needed');
  });

  it('adds up the shops to decide the outcome', async () => {
    const event = await submitted(
      formBody({
        purchases: [
          {
            shop: 'A',
            delivery: '20',
            items: [{notes: 'Thing', quantity: '2', cost: '480.00'}],
          },
          {shop: 'B', items: [{sku: 'B1', quantity: '1', cost: '600.00'}]},
        ],
      })
    );
    expect(event).toMatchObject({
      totalPence: 110_000,
      outcome: 'budget-proposal-needed',
    });
    expect(event.purchases.map(purchase => purchase.shop)).toStrictEqual([
      'A',
      'B',
    ]);
  });


  describe('a consumable members pay for', () => {
    it("is recorded as a consumable, needing no approval", async () => {
      const event = await submitted(
        formBody({isMemberPaidConsumable: 'true', ...costing('2500.00')})
      );
      expect(event).toMatchObject({
        outcome: 'consumable',
        approval: 'none',
        isMemberPaidConsumable: true,
      });
    });
  });

  it('needs the consumable question answered', () => {
    expect(
      submit.decode(formBody({isMemberPaidConsumable: ''}))._tag
    ).toStrictEqual('Left');
  });

  describe('other areas and health and safety', () => {
    const otherAreaId = faker.string.uuid() as UUID;
    beforeEach(() => {
      insert(
        constructEvent('AreaCreated')({
          actor: arbitraryActor(),
          id: otherAreaId,
          name: 'Metal Shop',
        })
      );
    });

    it('records the other areas it affects and needs a proposal', async () => {
      const event = await submitted(
        formBody({affectsOtherAreas: 'true', affectedAreaIds: otherAreaId})
      );
      expect(event).toMatchObject({
        affectedAreaIds: [otherAreaId],
        outcome: 'budget-proposal-needed',
        approval: 'proposal',
      });
      expect(event.outcomeReason).toContain('It affects Metal Shop too');
    });

    it('needs the other areas chosen when it says it affects some', async () => {
      expect(
        await failure(formBody({affectsOtherAreas: 'true'}))
      ).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        message: 'Please choose which other areas it affects.',
      });
    });

    it('refuses an area that does not exist', async () => {
      expect(
        await failure(
          formBody({
            affectsOtherAreas: 'true',
            affectedAreaIds: [faker.string.uuid()],
          })
        )
      ).toMatchObject({
        message: 'One of the other areas chosen no longer exists.',
      });
    });

    it('records a health and safety risk and needs a proposal', async () => {
      const event = await submitted(formBody({healthAndSafetyRisk: 'true'}));
      expect(event).toMatchObject({
        healthAndSafetyRisk: true,
        affectedAreaIds: [],
        approval: 'proposal',
      });
    });

    it('can need a proposal for a consumable without using the budget', async () => {
      const event = await submitted(
        formBody({isMemberPaidConsumable: 'true', healthAndSafetyRisk: 'true'})
      );
      expect(event).toMatchObject({outcome: 'consumable', approval: 'proposal'});
    });
  });

  describe('the shops', () => {
    it('turns the request down with the problem when a shop is not right', async () => {
      expect(
        await failure(
          formBody({
            purchases: [{shop: 'A', items: [{notes: 'x', quantity: '1'}]}],
          })
        )
      ).toMatchObject({
        status: StatusCodes.BAD_REQUEST,
        message: 'A, item 1: please say how much they cost in total.',
      });
    });

    it('needs at least one', async () => {
      expect(
        await failure(formBody({purchases: [{shop: '', items: [blankItem]}]}))
      ).toMatchObject({
        message: 'Please add at least one shop or website to buy from.',
      });
    });

    it('accepts shops and items posted keyed by index, in index order', async () => {
      const event = await submitted(
        formBody({
          purchases: {
            '21': {shop: 'Second', items: [{notes: 'b', quantity: '1', cost: '2'}]},
            '3': {
              shop: 'First',
              items: {
                '25': {notes: 'later', quantity: '1', cost: '1'},
                '4': {notes: 'earlier', quantity: '1', cost: '1'},
              },
            },
          },
        })
      );
      expect(event.purchases.map(purchase => purchase.shop)).toStrictEqual([
        'First',
        'Second',
      ]);
      expect(event.purchases[0].items.map(item => item.notes)).toStrictEqual([
        'earlier',
        'later',
      ]);
    });
  });

  it('fails for a purchasing area that does not exist', async () => {
    expect(
      await failure(formBody({purchasingAreaId: faker.string.uuid()}))
    ).toMatchObject({status: StatusCodes.NOT_FOUND});
  });

  it('must come from a logged-in member, or the API on behalf of one', async () => {
    expect(await failure(formBody(), arbitraryActor())).toMatchObject({
      status: StatusCodes.BAD_REQUEST,
    });
  });

  it('can be recorded through the API on behalf of a member', async () => {
    const event = getSomeOrFail(
      await getTaskEitherRightOrFail(
        submitAs(
          arbitraryActor(),
          formBody({submittedByMemberNumber: String(otherMemberNumber)})
        )
      )
    );
    expect(event).toMatchObject({submittedByMemberNumber: otherMemberNumber});
  });

  it('ignores a member number given by a logged-in member', async () => {
    const event = await submitted(
      formBody({submittedByMemberNumber: String(otherMemberNumber)})
    );
    expect(event.submittedByMemberNumber).toStrictEqual(purchaserNumber);
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
