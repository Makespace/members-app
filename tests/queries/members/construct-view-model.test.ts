import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';
import * as T from 'fp-ts/Task';
import * as E from 'fp-ts/Either';
import {constructViewModel} from '../../../src/queries/members/construct-view-model';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';
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

  it('succeeds if the logged in user is a super user', async () => {
    const result = await pipe(
      superUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getRightOrFail)
    )();
    expect(result.members).toBeDefined();
  });

  it('includes recurly status for each member', async () => {
    await insertRecurlySubscription(framework.extDB, {
      email: unprivilegedUser.emailAddress,
      hasActiveSubscription: true,
    });

    const result = await pipe(
      superUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getRightOrFail)
    )();

    expect(result.members).toEqual(expect.arrayContaining([
      expect.objectContaining({
        memberNumber: unprivilegedUser.memberNumber,
        recurlyStatus: 'active',
      }),
      expect.objectContaining({
        memberNumber: superUser.memberNumber,
        recurlyStatus: 'inactive',
      }),
    ]));
  });

  it('fails if the logged in user is not a super user', async () => {
    const result = await pipe(
      unprivilegedUser,
      constructViewModel(framework.sharedReadModel, framework.extDB)
    )();
    expect(result).toStrictEqual(E.left(expect.anything()));
  });

  it("fails if the logged in user isn't known to the shared state", async () => {
    const result = await pipe(
      unregisteredUser,
      constructViewModel(framework.sharedReadModel, framework.extDB)
    )();
    expect(result).toStrictEqual(E.left(expect.anything()));
  });
});
