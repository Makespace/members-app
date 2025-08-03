import Database from 'better-sqlite3';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';
import * as T from 'fp-ts/Task';
import * as E from 'fp-ts/Either';
import {constructViewModel} from '../../../src/queries/debug/construct-view-model';
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
      constructViewModel(framework.sharedReadModel),
      T.map(getRightOrFail)
    )();
    expect(result.jsonDump).toBeDefined();
    expect(result.bufferDump).toBeDefined();
  });

  it('produces a serialised buffer that can be loaded back into a database', async () => {
    const result = await pipe(
      superUser,
      constructViewModel(framework.sharedReadModel),
      T.map(getRightOrFail)
    )();
    const db = new Database(result.bufferDump);
    expect(db).toBeDefined();
  });

  it('fails if the logged in user is not a super user', async () => {
    const result = await pipe(
      unprivilegedUser,
      constructViewModel(framework.sharedReadModel)
    )();
    expect(result).toStrictEqual(E.left(expect.anything()));
  });

  it("fails if the logged in user isn't known to the shared state", async () => {
    const result = await pipe(
      unregisteredUser,
      constructViewModel(framework.sharedReadModel)
    )();
    expect(result).toStrictEqual(E.left(expect.anything()));
  });
});
