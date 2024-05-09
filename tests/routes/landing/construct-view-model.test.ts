import * as E from 'fp-ts/Either';
import {constructViewModel} from '../../../src/pages/landing/construct-view-model';
import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {Dependencies} from '../../../src/dependencies';
import {constructEvent, failure} from '../../../src/types';
import {happyPathAdapters} from '../../dependencies/happy-path-adapters.helper';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {shouldNotBeCalled} from '../../should-not-be-called.helper';

describe('construct-view-model', () => {
  describe('when the trainers cannot be fetched', () => {
    const deps: Dependencies = {
      ...happyPathAdapters,
      getTrainers: () => TE.left(failure('something failed')()),
    };
    it('returns on the left', async () => {
      const viewModel = await constructViewModel(deps)(arbitraryUser())();
      expect(viewModel).toStrictEqual(E.left(expect.anything()));
    });
  });

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
        TE.getOrElse(shouldNotBeCalled)
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
        TE.getOrElse(shouldNotBeCalled)
      )();
      expect(viewModel.isSuperUser).toBe(false);
    });
  });
});
