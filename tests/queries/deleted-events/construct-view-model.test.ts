import {constructViewModel} from '../../../src/queries/deleted-events/construct-view-model';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail, getRightOrFail} from '../../helpers';
import * as T from 'fp-ts/Task';
import {StatusCodes} from 'http-status-codes';
import {
  initTestFramework,
  TestFramework,
} from '../../read-models/test-framework';

describe('deleted-events construct-view-model', () => {
  let framework: TestFramework;

  beforeEach(async () => {
    framework = await initTestFramework();
  });

  afterEach(() => {
    framework.close();
  });

  describe('when the user has not been declared to be a super user', () => {
    const user = arbitraryUser();

    beforeEach(async () => {
      await framework.commands.memberNumbers.linkNumberToEmail({
        memberNumber: user.memberNumber,
        email: user.emailAddress,
        name: undefined,
        formOfAddress: undefined,
      });
    });

    it('does not show deleted events', async () => {
      const failure = await pipe(
        {},
        constructViewModel(framework.depsForCommands)(user),
        T.map(getLeftOrFail)
      )();

      expect(failure.status).toStrictEqual(StatusCodes.FORBIDDEN);
    });
  });

  it('shows deleted events to super users', async () => {
    const superUser = arbitraryUser();
    const firstMember = arbitraryUser();
    const secondMember = arbitraryUser();

    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: superUser.memberNumber,
      email: superUser.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.superUser.declare({
      memberNumber: superUser.memberNumber,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: firstMember.memberNumber,
      email: firstMember.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });
    await framework.commands.memberNumbers.linkNumberToEmail({
      memberNumber: secondMember.memberNumber,
      email: secondMember.emailAddress,
      name: undefined,
      formOfAddress: undefined,
    });

    await framework.setEventDeletedState(1, true);

    const result = await pipe(
      {offset: '0', limit: '10'},
      constructViewModel(framework.depsForCommands)(superUser),
      T.map(getRightOrFail)
    )();

    expect(result.count).toStrictEqual(1);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].event_index).toStrictEqual(1);
    expect(result.events[0].deletedAt).toEqual(expect.any(Date));
  });
});
