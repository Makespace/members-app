import * as O from 'fp-ts/Option';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {constructViewModel} from '../../../src/queries/outstanding-invoices/construct-view-model';
import {recurlyInvoiceTable} from '../../../src/sync-worker/recurly/recurly-data-table';
import {Dependencies} from '../../../src/dependencies';

const thresholds = {
  BILLING_REMOVE_ACCESS_AFTER_DAYS: 14,
  BILLING_CANCEL_AFTER_DAYS: 60,
} as unknown as Dependencies['conf'];

describe('the outstanding invoices page', () => {
  let framework: TestFramework;
  const superUser = arbitraryUser();
  const ordinaryUser = arbitraryUser();
  const debtor = arbitraryUser();

  const deps = () => ({
    sharedReadModel: framework.sharedReadModel,
    extDB: framework.extDB,
    conf: thresholds,
  });

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const user of [superUser, ordinaryUser, debtor]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });
    await framework.extDB
      .insert(recurlyInvoiceTable)
      .values({
        id: 'inv_1',
        email: debtor.emailAddress.toLowerCase(),
        accountId: 'acct_1',
        state: 'past_due',
        currency: 'GBP',
        total: 30,
        paid: 0,
        balance: 30,
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
        dueAt: new Date('2020-01-01T00:00:00.000Z'),
        cachedAt: new Date(),
      })
      .run();
  });
  afterEach(() => {
    framework.close();
  });

  it('puts somebody years behind in the band where cancelling is on the table', async () => {
    const viewModel = getRightOrFail(
      await constructViewModel(deps(), superUser)()
    );
    const cancel = viewModel.bands.find(band => band.band === 'cancel');
    expect(cancel?.concerns).toHaveLength(1);
    expect(cancel?.concerns[0]?.memberNumber).toBe(debtor.memberNumber);
  });

  it('reports the thresholds it banded by, so the page can name them', async () => {
    const viewModel = getRightOrFail(
      await constructViewModel(deps(), superUser)()
    );
    expect(viewModel.thresholds).toEqual({
      removeAccessAfterDays: 14,
      cancelAfterDays: 60,
    });
  });

  it('refuses an ordinary member', async () => {
    const failure = getLeftOrFail(
      await constructViewModel(deps(), ordinaryUser)()
    );
    expect(failure.status).toBe(403);
  });

  it('refuses the member who owes the money', async () => {
    const failure = getLeftOrFail(await constructViewModel(deps(), debtor)());
    expect(failure.status).toBe(403);
  });

  it('marks a cache nobody has refreshed as stale', async () => {
    await framework.extDB
      .insert(recurlyInvoiceTable)
      .values({
        id: 'inv_old',
        email: debtor.emailAddress.toLowerCase(),
        accountId: 'acct_1',
        state: 'past_due',
        balance: 30,
        cachedAt: new Date('2020-01-01T00:00:00.000Z'),
      })
      .run();
    const viewModel = getRightOrFail(
      await constructViewModel(deps(), superUser)()
    );
    expect(viewModel.isStale).toBe(false);
    expect(O.isSome(viewModel.cachedAt)).toBe(true);
  });
});
