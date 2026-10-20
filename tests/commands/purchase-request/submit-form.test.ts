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

  // As Express's query parser hands it over: purchases[0][shop] etc. become
  // a list of shops.
  const parsed = (query: Record<string, string>) => {
    const purchases: Record<string, string>[] = [];
    const rest: Record<string, string> = {};
    Object.entries(query).forEach(([name, value]) => {
      const match = /^purchases\[(\d+)\]\[(\w+)\]$/.exec(name);
      if (match) {
        const index = Number(match[1]);
        purchases[index] = {...purchases[index], [match[2]]: value};
      } else {
        rest[name] = value;
      }
    });
    return purchases.length ? {...rest, purchases} : rest;
  };

  const page = (query: Record<string, string>) =>
    getTaskEitherRightOrFail(
      submitForm.constructForm(parsed(query))({
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
  const allAnswers = {
    ...aboutAnswers,
    'purchases[0][shop]': 'Axminster',
    'purchases[0][items]': '2 x blade',
    'purchases[0][cost]': '150',
    'purchases[1][shop]': 'Toolstation',
    'purchases[1][items]': '1 x guard',
    'purchases[1][cost]': '100',
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
    expect(
      await page({...allAnswers, 'purchases[1][cost]': '', step: '3'})
    ).toMatchObject({
      step: 2,
      problems: ['Toolstation: please say how much it costs.'],
    });
  });

  it('keeps only the shops filled in, in order', async () => {
    const viewModel = await page({
      ...aboutAnswers,
      'purchases[0][shop]': '',
      'purchases[1][shop]': 'Axminster',
      'purchases[1][items]': 'blade',
      step: '2',
    });
    expect(viewModel.answers.purchases).toStrictEqual([
      {shop: 'Axminster', items: 'blade'},
    ]);
  });

  it('works out the actual budget from the shop total on page 3', async () => {
    const result = getSomeOrFail((await page({...allAnswers, step: '3'})).result);
    expect(result.totalPence).toBe(25_000);
    expect(result.purchases.map(purchase => purchase.shop)).toStrictEqual([
      'Axminster',
      'Toolstation',
    ]);
    expect(result.classification.outcome).toBe('budget');
    const proposal = getSomeOrFail(
      (await page({...allAnswers, 'purchases[0][cost]': '900', step: '3'}))
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
