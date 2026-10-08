import {EmailAddress} from '../../../src/types';
import {constructViewModel} from '../../../src/queries/unlinked-recurly/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail, insertRecurlySubscription} from '../../helpers';
import {initTestFramework, TestFramework} from '../../read-models/test-framework';

describe('the unlinked Recurly accounts page', () => {
  let framework: TestFramework;
  const superUser = arbitraryUser();
  const member = arbitraryUser();

  beforeEach(async () => {
    framework = await initTestFramework();
    for (const user of [superUser, member]) {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.superUser.declare({memberNumber: superUser.memberNumber});
  });
  afterEach(() => {
    framework.close();
  });

  const page = () =>
    constructViewModel(framework.sharedReadModel, framework.extDB)(superUser)();

  it('leaves out an account whose billing email is a member’s', async () => {
    await insertRecurlySubscription(framework.extDB, {
      email: member.emailAddress,
      hasActiveSubscription: true,
    });
    const viewModel = getRightOrFail(await page());
    expect(viewModel.needingAction).toHaveLength(0);
    expect(viewModel.theRest).toHaveLength(0);
  });

  it('leaves out an account whose code is a member’s email, whatever it bills', async () => {
    await insertRecurlySubscription(framework.extDB, {
      email: 'billing@example.com' as EmailAddress,
      accountCode: member.emailAddress.toLowerCase(),
      hasActiveSubscription: true,
    });
    const viewModel = getRightOrFail(await page());
    expect(viewModel.needingAction).toHaveLength(0);
  });

  it('puts paying accounts nobody answers to first, and the lapsed ones after', async () => {
    await insertRecurlySubscription(framework.extDB, {
      email: 'paying@example.com' as EmailAddress,
      accountCode: 'paying@example.com',
      hasActiveSubscription: true,
    });
    await insertRecurlySubscription(framework.extDB, {
      email: 'owing@example.com' as EmailAddress,
      hasActiveSubscription: false,
      hasPastDueInvoice: true,
    });
    await insertRecurlySubscription(framework.extDB, {
      email: 'gone@example.com' as EmailAddress,
      hasActiveSubscription: false,
      hasCanceledSubscription: true,
    });
    const viewModel = getRightOrFail(await page());
    expect(viewModel.needingAction.map(e => e.email).sort()).toStrictEqual([
      'owing@example.com',
      'paying@example.com',
    ]);
    expect(viewModel.theRest.map(e => e.email)).toStrictEqual(['gone@example.com']);
  });

  it('does not treat an unverified address as a link, since no lookup does', async () => {
    const billing = 'billing@example.com' as EmailAddress;
    await insertRecurlySubscription(framework.extDB, {
      email: billing,
      hasActiveSubscription: true,
    });
    await framework.commands.members.addEmail({
      memberNumber: member.memberNumber,
      email: billing,
    });
    const viewModel = getRightOrFail(await page());
    expect(viewModel.needingAction.map(e => e.email)).toStrictEqual([billing]);

    await framework.commands.members.verifyEmail({
      memberNumber: member.memberNumber,
      emailAddress: billing,
    });
    expect(getRightOrFail(await page()).needingAction).toHaveLength(0);
  });

  it('does not count an account the sync has stopped refreshing as paying', async () => {
    await insertRecurlySubscription(framework.extDB, {
      email: 'gone@example.com' as EmailAddress,
      hasActiveSubscription: true,
      cacheLastUpdated: new Date('2020-01-01T00:00:00.000Z'),
    });
    const viewModel = getRightOrFail(await page());
    expect(viewModel.needingAction).toHaveLength(0);
    expect(viewModel.theRest[0]).toMatchObject({email: 'gone@example.com', isFresh: false});
  });

  it('shows the signup address beside the billing one when they differ', async () => {
    await insertRecurlySubscription(framework.extDB, {
      email: 'billing@example.com' as EmailAddress,
      accountCode: 'signup@example.com',
      hasActiveSubscription: true,
    });
    const viewModel = getRightOrFail(await page());
    expect(viewModel.needingAction[0]?.otherCodes).toStrictEqual(['signup@example.com']);
  });

  it('refuses an ordinary member', async () => {
    const failure = getLeftOrFail(
      await constructViewModel(framework.sharedReadModel, framework.extDB)(member)()
    );
    expect(failure.status).toBe(403);
  });
});
