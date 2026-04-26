import {constructViewModel} from '../../../src/queries/log/construct-view-model';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail} from '../../helpers';
import * as T from 'fp-ts/Task';
import {StatusCodes} from 'http-status-codes';
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

    it('does not show the event log', async () => {
      const failure = await pipe(
        {},
        constructViewModel(framework.depsForCommands)(user),
        T.map(getLeftOrFail)
      )();

      expect(failure.status).toStrictEqual(StatusCodes.FORBIDDEN);
    });
  });
});
