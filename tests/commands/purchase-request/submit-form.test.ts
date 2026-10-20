import * as O from 'fp-ts/Option';
import {faker} from '@faker-js/faker';
import {UUID} from 'io-ts-types';
import {constructEvent, EmailAddress} from '../../../src/types';
import {submitForm} from '../../../src/commands/purchase-request/submit-form';
import {
  arbitraryActor,
  getSomeOrFail,
  getTaskEitherRightOrFail,
} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

// The form is filled in a page at a time; these drive it the way a browser
// would, with each page's answers in the query string.
describe('purchase request form pages', () => {
  let framework: TestFramework;
  const woodShopId = faker.string.uuid() as UUID;
  const craftId = faker.string.uuid() as UUID;
  const purchaserNumber = faker.number.int({min: 1, max: 50_000});
  const user = {
    memberNumber: purchaserNumber,
    emailAddress: faker.internet.email() as EmailAddress,
  };
  const requestId = faker.string.uuid();

  const insert = (
    ...events: Parameters<TestFramework['insertIntoSharedReadModel']>[0][]
  ) => events.forEach(event => framework.insertIntoSharedReadModel(event));

  const purchasingArea = (id: UUID, name: string, areaId: UUID) => [
    constructEvent('AreaCreated')({actor: arbitraryActor(), id: areaId, name}),
    constructEvent('PurchasingAreaCreated')({
      actor: arbitraryActor(),
      id,
      name,
      yearlyBudgetPence: 100_000,
    }),
    constructEvent('AreaAssignedToPurchasingArea')({
      actor: arbitraryActor(),
      purchasingAreaId: id,
      areaId,
    }),
    constructEvent('OwnerAdded')({
      actor: arbitraryActor(),
      areaId,
      memberNumber: purchaserNumber,
    }),
    constructEvent('PurchaserAdded')({
      actor: arbitraryActor(),
      purchasingAreaId: id,
      memberNumber: purchaserNumber,
    }),
  ];

  // As Express's query parser hands it over: purchases[0][items][0][sku]
  // etc. arrive as nested lists.
  const page = (query: Record<string, unknown>) =>
    getTaskEitherRightOrFail(
      submitForm.constructForm(query)({
        user,
        readModel: framework.sharedReadModel,
        deps: {} as never,
      })
    );

  const aboutAnswers = {
    id: requestId,
    purchasingAreaId: woodShopId,
    summary: 'Saw blades',
    justification: 'The old ones are blunt',
  };
  const jewson = (cost = '50') => ({
    shop: 'jewson.co.uk',
    delivery: '',
    items: [
      {url: '', sku: 'PEGF8418', quantity: '1', cost, notes: ''},
      {url: '', sku: 'PBJT4750', quantity: '4', cost: '100', notes: '4.8m'},
    ],
  });
  const allAnswers = {
    ...aboutAnswers,
    purchases: [jewson()],
    isMemberPaidConsumable: 'false',
  };

  beforeEach(async () => {
    framework = await initTestFramework();
    insert(
      constructEvent('MemberNumberLinkedToEmail')({
        actor: arbitraryActor(),
        memberNumber: purchaserNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      }),
      ...purchasingArea(woodShopId, 'Wood Shop', faker.string.uuid() as UUID),
      ...purchasingArea(craftId, 'Craft & Art', faker.string.uuid() as UUID)
    );
  });

  afterEach(() => {
    framework.close();
  });

  it('starts on page 1 with nothing answered', async () => {
    const viewModel = await page({});
    expect(viewModel).toMatchObject({step: 1, problems: []});
    expect(viewModel.purchasingAreas.map(area => area.name).sort()).toStrictEqual(
      ['Craft & Art', 'Wood Shop']
    );
  });

  it('starts with the purchasing area it was opened from', async () => {
    const viewModel = await page({purchasingArea: craftId});
    expect(viewModel.answers.purchasingAreaId).toBe(craftId);
  });

  it('goes to the page asked for once the earlier ones are answered', async () => {
    expect((await page({...aboutAnswers, step: '2'})).step).toBe(2);
    expect((await page({...allAnswers, step: '3'})).step).toBe(3);
    expect((await page({...allAnswers, step: '1'})).step).toBe(1);
  });

  it('knows the chosen area from page 2', async () => {
    const viewModel = await page({...aboutAnswers, step: '2'});
    expect(viewModel.chosen).toStrictEqual(
      O.some(expect.objectContaining({id: woodShopId, name: 'Wood Shop'}))
    );
  });

  it('sends them back to page 1 with what is missing', async () => {
    const viewModel = await page({
      id: requestId,
      purchasingAreaId: woodShopId,
      step: '3',
    });
    expect(viewModel).toMatchObject({
      step: 1,
      problems: ['Please give a summary, why it is needed before moving on.'],
    });
  });

  it("won't take an area they can't purchase for", async () => {
    const viewModel = await page({
      ...aboutAnswers,
      purchasingAreaId: faker.string.uuid(),
      step: '2',
    });
    expect(viewModel).toMatchObject({
      step: 1,
      problems: ['Please give the area it is for before moving on.'],
    });
  });

  it('sends them back to page 2 until the shops and the question are sorted', async () => {
    expect(await page({...aboutAnswers, step: '3'})).toMatchObject({
      step: 2,
      problems: [
        'Please add at least one shop or website to buy from.',
        'Please say whether members pay for it as a consumable.',
      ],
    });
    const noPrice = jewson();
    expect(
      await page({
        ...allAnswers,
        purchases: [
          {...noPrice, items: [noPrice.items[0], {...noPrice.items[1], cost: ''}]},
        ],
        step: '3',
      })
    ).toMatchObject({
      step: 2,
      problems: ['jewson.co.uk, item 2: please say how much they cost in total.'],
    });
  });

  it('keeps only the shops and items filled in, in order', async () => {
    const viewModel = await page({
      ...aboutAnswers,
      purchases: [
        {shop: '', items: [{sku: ''}]},
        {shop: 'jewson.co.uk', items: [{sku: ''}, {sku: 'PEGF8418'}]},
      ],
      step: '2',
    });
    expect(viewModel.answers.purchases).toStrictEqual([
      {
        shop: 'jewson.co.uk',
        delivery: '',
        items: [{url: '', sku: 'PEGF8418', quantity: '', cost: '', notes: ''}],
      },
    ]);
  });

  it('works out the actual budget from the shop total on page 3', async () => {
    const result = getSomeOrFail((await page({...allAnswers, step: '3'})).result);
    expect(result.totalPence).toBe(15_000);
    expect(result.purchases[0].items.map(item => item.sku)).toStrictEqual([
      'PEGF8418',
      'PBJT4750',
    ]);
    expect(result.classification.outcome).toBe('budget');
    const proposal = getSomeOrFail(
      (await page({...allAnswers, purchases: [jewson('900')], step: '3'}))
        .result
    );
    expect(proposal.totalPence).toBe(100_000);
    expect(proposal.classification.outcome).toBe('budget-proposal-needed');
  });

  it('starts a new request id, then keeps it', async () => {
    expect((await page({})).requestId).toMatch(/^[0-9a-f-]{36}$/);
    expect((await page({...aboutAnswers, step: '2'})).requestId).toBe(requestId);
  });
});
