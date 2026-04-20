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
