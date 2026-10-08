import {Int} from 'io-ts';
import {NonEmptyString} from 'io-ts-types';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail, insertRecurlySubscription} from '../../helpers';
import {initTestFramework, TestFramework} from '../../read-models/test-framework';
import {constructViewModel} from '../../../src/queries/access-audit/construct-view-model';
import {recurlyInvoiceTable} from '../../../src/sync-worker/recurly/recurly-data-table';
import {Dependencies} from '../../../src/dependencies';
import {User} from '../../../src/types';

const conf = {
  BILLING_REMOVE_ACCESS_AFTER_DAYS: 14,
  BILLING_CANCEL_AFTER_DAYS: 60,
} as unknown as Dependencies['conf'];

describe('the door access audit', () => {
  let framework: TestFramework;
  const superUser = arbitraryUser();
  const lapsedWithLiveFob = arbitraryUser();
  const activeWithCancelledFob = arbitraryUser();
  const activeWithNoFob = arbitraryUser();
  const activeParked = arbitraryUser();
  const activeButOverdue = arbitraryUser();
  const fine = arbitraryUser();

  const deps = () => ({
    sharedReadModel: framework.sharedReadModel,
    extDB: framework.extDB,
    conf,
  });

  const fob = (user: User, fobId: number, accessLevel: string) =>
    framework.commands.members.recordFob({
      memberNumber: user.memberNumber,
      fobId: fobId as Int,
      accessLevel: accessLevel as NonEmptyString,
      paxtonName: 'x' as NonEmptyString,
    });

  beforeEach(async () => {
    framework = await initTestFramework();
    const everyone = [
      superUser,
      lapsedWithLiveFob,
      activeWithCancelledFob,
      activeWithNoFob,
      activeParked,
      activeButOverdue,
      fine,
    ];
    for (const user of everyone) {
      // Linked emails count as verified, which the Recurly lookup needs.
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    }
    await framework.commands.superUser.declare({memberNumber: superUser.memberNumber});

    for (const user of [superUser, activeWithCancelledFob, activeWithNoFob, activeParked, activeButOverdue, fine]) {
      await insertRecurlySubscription(framework.extDB, {
        email: user.emailAddress,
        hasActiveSubscription: true,
      });
    }
    await insertRecurlySubscription(framework.extDB, {
      email: lapsedWithLiveFob.emailAddress,
      hasActiveSubscription: false,
    });
    await framework.extDB
      .insert(recurlyInvoiceTable)
      .values({
        id: 'inv_1',
        email: activeButOverdue.emailAddress.toLowerCase(),
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

    await fob(superUser, 1, '1c - Management Team');
    await fob(lapsedWithLiveFob, 2, '1a - Active Members');
    await fob(activeWithCancelledFob, 3, '3 - Cancelled Members');
    await fob(activeParked, 4, '2 - Parked Members');
    await fob(activeButOverdue, 5, '1a - Active Members');
    await fob(fine, 6, '1a - Active Members');
  });

  afterEach(() => {
    framework.close();
  });

  const numbersIn = (rows: ReadonlyArray<{member: {memberNumber: number}}>) =>
    rows.map(row => row.member.memberNumber).sort();

  it('lists live fobs whose holder is not entitled, with the reason', async () => {
    const viewModel = getRightOrFail(await constructViewModel(deps(), superUser)());
    expect(numbersIn(viewModel.groups.toRevoke)).toStrictEqual(
      [lapsedWithLiveFob.memberNumber, activeButOverdue.memberNumber].sort()
    );
    const overdue = viewModel.groups.toRevoke.find(
      row => row.member.memberNumber === activeButOverdue.memberNumber
    );
    expect(overdue?.entitlement).toMatchObject({kind: 'not-entitled', why: 'overdue'});
  });

  it('lists entitled members whose fob is cancelled, missing, or paused on purpose', async () => {
    const viewModel = getRightOrFail(await constructViewModel(deps(), superUser)());
    expect(numbersIn(viewModel.groups.toReinstate)).toStrictEqual([activeWithCancelledFob.memberNumber]);
    expect(numbersIn(viewModel.groups.noFob)).toStrictEqual([activeWithNoFob.memberNumber]);
    expect(numbersIn(viewModel.groups.pausedOnPurpose)).toStrictEqual([activeParked.memberNumber]);
  });

  it('counts the members who are as they should be', async () => {
    const viewModel = getRightOrFail(await constructViewModel(deps(), superUser)());
    // The super user and "fine" are entitled with live fobs.
    expect(viewModel.groups.consistent).toStrictEqual(2);
    expect(viewModel.totalMembers).toStrictEqual(7);
    expect(viewModel.membersWithFobs).toStrictEqual(6);
  });

  it('refuses an ordinary member', async () => {
    const failure = getLeftOrFail(await constructViewModel(deps(), fine)());
    expect(failure.status).toBe(403);
  });
});
