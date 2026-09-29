import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {constructViewModel} from '../../../src/queries/member/construct-view-model';
import {ViewModel} from '../../../src/queries/member/view-model';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
import { faker } from '@faker-js/faker';
import { FailureWithStatus } from '../../../src/types/failure-with-status';
import { User } from '../../../src/types/user';
import {insertRecurlySubscription} from '../../helpers';
import {recurlyInvoiceTable} from '../../../src/sync-worker/recurly/recurly-data-table';

describe('construct-view-model', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  const unregisteredUser = arbitraryUser();
  const unprivilegedUser = arbitraryUser();
  const superUser = arbitraryUser();
  beforeEach(async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: unprivilegedUser.memberNumber,
      email: unprivilegedUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: superUser.memberNumber,
      email: superUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });
  });

  it('returns the recurly status for the member being viewed', async () => {
    const anotherUser = arbitraryUser();
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: anotherUser.memberNumber,
      email: anotherUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await insertRecurlySubscription(framework.extDB, {
      email: anotherUser.emailAddress,
      hasActiveSubscription: true,
    });

    const viewModel = await constructViewModel(
      framework,
      superUser
    )(anotherUser.memberNumber)();

    expect(getRightOrFail(viewModel).recurlyStatus).toStrictEqual('active');
  });

  // Billing detail is fetched only for the people who chase it. Keeping it out
  // of the view model - rather than hiding it in the template - means a later
  // change to the rendering cannot put somebody's payment history on a page
  // that other members can read.
  describe('billing detail', () => {
    const memberInArrears = arbitraryUser();
    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: memberInArrears.memberNumber,
        email: memberInArrears.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
      await framework.extDB
        .insert(recurlyInvoiceTable)
        .values({
          id: 'inv_1',
          email: memberInArrears.emailAddress.toLowerCase(),
          accountId: 'acct_1',
          number: 'INV-9001',
          state: 'past_due',
          collectionMethod: 'automatic',
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

    it('is fetched for a super user', async () => {
      const viewModel = await constructViewModel(
        framework,
        superUser
      )(memberInArrears.memberNumber)();
      const billing = O.toNullable(getRightOrFail(viewModel).billing);
      expect(billing).not.toBeNull();
      expect(billing?.invoices).toHaveLength(1);
      expect(billing?.totalOutstanding).toBe(25);
    });

    it('is not fetched for another member', async () => {
      const viewModel = await constructViewModel(
        framework,
        unprivilegedUser
      )(memberInArrears.memberNumber)();
      expect(getRightOrFail(viewModel).billing).toStrictEqual(O.none);
    });

    it('is not fetched for the member themselves', async () => {
      const viewModel = await constructViewModel(
        framework,
        memberInArrears
      )(memberInArrears.memberNumber)();
      const model = getRightOrFail(viewModel);
      expect(model.isSelf).toBe(true);
      expect(model.billing).toStrictEqual(O.none);
    });
  });

  ([
    {userDesc: 'unregistered user', userViewingPage: unregisteredUser},
    {userDesc: 'super user', userViewingPage: superUser},
    {userDesc: 'normal user', userViewingPage: unprivilegedUser},
  ] as {
    userDesc: 'unregistered user' | 'super user' | 'normal user',
    userViewingPage: User,
  }[]).forEach(
    ({userDesc, userViewingPage}) => {
      describe(`${userDesc} views page`, () => {
        describe('member exists', () => {
          const anotherUser = {
            ...arbitraryUser(),
            name: faker.animal.bear(),
            formOfAddress: faker.person.prefix()
          };
          let viewModel: E.Either<FailureWithStatus, ViewModel>;

          beforeEach(async () => {
            await framework.commands.memberNumbers.linkNumberToEmail({
              memberNumber: anotherUser.memberNumber,
              email: anotherUser.emailAddress,
              name: anotherUser.name,
              formOfAddress: anotherUser.formOfAddress,
            });
            viewModel = await constructViewModel(framework, userViewingPage)(anotherUser.memberNumber)();
          });

          if (userDesc === 'unregistered user') {
            it('returns an error', () => {
              const error = getLeftOrFail(viewModel);
              expect(error.status).toStrictEqual(404);
            });
          } else {
            it('returns basic information about the user', () => {
              const model = getRightOrFail(viewModel);
              expect(model.isSelf).toStrictEqual(false);
              expect(model.isSuperUser).toStrictEqual(userDesc === 'super user');
              expect(model.member.name).toStrictEqual(O.some(anotherUser.name));
              expect(model.member.formOfAddress).toStrictEqual(O.some(anotherUser.formOfAddress));
            });
          }
        });

        describe('member does not exist', () => {
          const nonExistent = arbitraryUser();
          let viewModel: E.Either<FailureWithStatus, ViewModel>;
          beforeEach(async () => {
            viewModel = await constructViewModel(framework, userViewingPage)(nonExistent.memberNumber)();
          });

          it('returns an error', () => {
            const error = getLeftOrFail(viewModel);
            expect(error.status).toStrictEqual(404);
          });
        });
      });
    }
  );
});
