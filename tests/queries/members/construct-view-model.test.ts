import {constructViewModel} from '../../../src/queries/members/construct-view-model';
import {Dependencies} from '../../../src/dependencies';
import {happyPathAdapters} from '../../init-dependencies/happy-path-adapters.helper';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';
import * as T from 'fp-ts/Task';

describe('construct-view-model', () => {
  describe('when the user has not been declared to be a super user', () => {
    const deps: Dependencies = happyPathAdapters;

    it('viewer is not super user', async () => {
      const viewModel = await pipe(
        arbitraryUser(),
        constructViewModel(deps),
        T.map(getRightOrFail)
      )();

      expect(viewModel.viewerIsSuperUser).toStrictEqual(false);
    });
  });
});
