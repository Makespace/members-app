import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {constructViewModel} from '../../../src/queries/trouble-tickets/construct-view-model';
import * as T from 'fp-ts/Task';
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
  const unregisteredUser = arbitraryUser();
  beforeEach(async () => {
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: loggedInUser.memberNumber,
      email: loggedInUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
  });

  it('succeeds if the logged in user is a super user', async () => {
    await framework.commands.superUser.declare({
      memberNumber: loggedInUser.memberNumber,
    });

    const result = await pipe(
      loggedInUser,
      constructViewModel(
        framework.sharedReadModel,
        framework.getTroubleTicketData
      ),
      T.map(getRightOrFail)
    )();
    expect(result).toBeDefined();
  });

  it('fails if the logged in user is not a super user', async () => {
    const result = await pipe(
      loggedInUser,
      constructViewModel(
        framework.sharedReadModel,
        framework.getTroubleTicketData
      )
    )();

    expect(result).toStrictEqual(E.left(expect.anything()));
  });

  it('fails if the user is unknown', async () => {
    const result = await pipe(
      unregisteredUser,
      constructViewModel(
        framework.sharedReadModel,
        framework.getTroubleTicketData
      )
    )();

    expect(result).toStrictEqual(E.left(expect.anything()));
  });
});
