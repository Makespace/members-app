import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import {constructViewModel} from '../../../src/queries/member-billing/construct-view-model';
import {recurlyInvoiceTable} from '../../../src/sync-worker/recurly/recurly-data-table';

describe('a member billing page', () => {
  let framework: TestFramework;
  const superUser = arbitraryUser();
  const ordinaryUser = arbitraryUser();
  const member = arbitraryUser();

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const user of [superUser, ordinaryUser, member]) {
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
        email: member.emailAddress.toLowerCase(),
        accountId: 'acct_1',
        number: 'INV-9001',
        state: 'past_due',
        currency: 'GBP',
        total: 25,
        paid: 0,
        balance: 25,
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
        dueAt: new Date('2026-09-01T00:00:00.000Z'),
        cachedAt: new Date(),
      })
      .run();
  });
  afterEach(() => {
    framework.close();
  });

  it('gives a super user the whole history', async () => {
    const viewModel = getRightOrFail(
      await constructViewModel(framework, superUser)(member.memberNumber)()
    );
    expect(viewModel.memberNumber).toBe(member.memberNumber);
    expect(viewModel.billing.invoices).toHaveLength(1);
  });

  // The page is reachable by anybody who guesses the address, so it carries
  // its own check rather than relying on nothing linking to it.
  it('refuses another member', async () => {
    const failure = getLeftOrFail(
      await constructViewModel(framework, ordinaryUser)(member.memberNumber)()
    );
    expect(failure.status).toBe(403);
  });

  it('refuses the member themselves', async () => {
    const failure = getLeftOrFail(
      await constructViewModel(framework, member)(member.memberNumber)()
    );
    expect(failure.status).toBe(403);
  });

  it('404s for a member who does not exist', async () => {
    const failure = getLeftOrFail(
      await constructViewModel(framework, superUser)(999999)()
    );
    expect(failure.status).toBe(404);
  });
});
