import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {constructViewModel} from '../../../src/queries/super-users/construct-view-model';
import * as T from 'fp-ts/Task';
import * as RA from 'fp-ts/ReadonlyArray';
import {getRightOrFail} from '../../helpers';
import {
  TestFramework,
  initTestFramework,
} from '../../read-models/test-framework';

describe('construct-view-model', () => {
  let framework: TestFramework;
  beforeEach(async () => {
    framework = await initTestFramework();
  });
  afterEach(() => {
    framework.close();
  });

  const loggedInUser = arbitraryUser();
  beforeEach(async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: loggedInUser.memberNumber,
      email: loggedInUser.emailAddress,
    });
  });

  it('succeeds if the logged in user is a super user', async () => {
    await framework.commands.superUser.declare({
      memberNumber: loggedInUser.memberNumber,
    });

    const result = await pipe(
      loggedInUser,
      constructViewModel(framework.sharedReadModel),
      T.map(getRightOrFail),
      T.map(viewModel => viewModel.superUsers),
      T.map(RA.map(superUser => superUser.memberNumber))
    )();

    expect(result).toStrictEqual([loggedInUser.memberNumber]);
  });

  it('fails if the logged in user is not a super user', async () => {
    const result = await pipe(
      loggedInUser,
      constructViewModel(framework.sharedReadModel)
    )();

    expect(result).toStrictEqual(E.left(expect.anything()));
  });
});
