import {constructViewModel} from '../../../src/queries/log/construct-view-model';
import {Dependencies} from '../../../src/dependencies';
import {happyPathAdapters} from '../../init-dependencies/happy-path-adapters.helper';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getLeftOrFail} from '../../helpers';
import * as T from 'fp-ts/Task';
import {StatusCodes} from 'http-status-codes';

describe('construct-view-model', () => {
  describe('when the user has not been declared to be a super user', () => {
    const deps: Dependencies = happyPathAdapters;

    it('does not show the event log', async () => {
      const failure = await pipe(
        arbitraryUser(),
        constructViewModel(deps),
        T.map(getLeftOrFail)
      )();

      expect(failure.status).toStrictEqual(StatusCodes.UNAUTHORIZED);
    });
  });
});
