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

  it('refuses an ordinary member', async () => {
    const failure = getLeftOrFail(
      await constructViewModel(framework.sharedReadModel, framework.extDB)(member)()
    );
    expect(failure.status).toBe(403);
  });
});
