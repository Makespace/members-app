import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';
import * as T from 'fp-ts/Task';
import {constructViewModel} from '../../../src/queries/areas/construct-view-model';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

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
    expect(result.areas).toBeDefined();
    expect(result.canManageAreas).toStrictEqual(true);
    expect(result.canSeeOwnerPrivateDetails).toStrictEqual(true);
  });

  it('succeeds if the logged in user is not a super user', async () => {
    const result = await pipe(
      unprivilegedUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getRightOrFail)
    )();
    expect(result.areas).toBeDefined();
    expect(result.canManageAreas).toStrictEqual(false);
    expect(result.canSeeOwnerPrivateDetails).toStrictEqual(false);
  });

  it("succeeds without management permissions if the logged in user isn't known to the shared state", async () => {
    const result = await pipe(
      unregisteredUser,
      constructViewModel(framework.sharedReadModel, framework.extDB),
      T.map(getRightOrFail)
    )();
    expect(result.areas).toBeDefined();
    expect(result.canManageAreas).toStrictEqual(false);
    expect(result.canSeeOwnerPrivateDetails).toStrictEqual(false);
  });
});
