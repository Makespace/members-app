import {constructViewModel} from '../../../src/queries/landing/construct-view-model';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {Dependencies} from '../../../src/dependencies';
import {constructEvent} from '../../../src/types';
import {happyPathAdapters} from '../../init-dependencies/happy-path-adapters.helper';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {getRightOrFail} from '../../helpers';

describe('construct-view-model', () => {
  describe('when the user has been declared to be a super user', () => {
    const user = arbitraryUser();
    const deps: Dependencies = {
      ...happyPathAdapters,
      getAllEvents: () =>
        TE.right([
          constructEvent('SuperUserDeclared')({
            memberNumber: user.memberNumber,
            declaredAt: faker.date.past(),
          }),
        ]),
    };

    it('sets the flag accordingly', async () => {
      const viewModel = await pipe(
        user,
        constructViewModel(deps),
        T.map(getRightOrFail)
      )();
      expect(viewModel.isSuperUser).toBe(true);
    });
  });

  describe('when the user has not been declared to be a super user', () => {
    const deps: Dependencies = happyPathAdapters;

    it('sets the flag accordingly', async () => {
      const viewModel = await pipe(
        arbitraryUser(),
        constructViewModel(deps),
        T.map(getRightOrFail)
      )();
      expect(viewModel.isSuperUser).toBe(false);
    });
  });
});
