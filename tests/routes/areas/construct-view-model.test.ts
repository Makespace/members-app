import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {Dependencies} from '../../../src/dependencies';
import {constructEvent} from '../../../src/types';
import {happyPathAdapters} from '../../init-dependencies/happy-path-adapters.helper';
import {pipe} from 'fp-ts/lib/function';
import {constructViewModel} from '../../../src/pages/areas/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {shouldNotBeCalled} from '../../should-not-be-called.helper';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';

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

  describe('when area there are no areas', () => {
    const deps: Dependencies = happyPathAdapters;

    it('should return nothing', async () => {
      const viewModel = await pipe(
        arbitraryUser(),
        constructViewModel(deps),
        TE.getOrElse(shouldNotBeCalled)
      )();
      expect(viewModel.areas).toStrictEqual([]);
    });
  });

  describe('when an area is created', () => {
    const deps: Dependencies = {
      ...happyPathAdapters,
      getAllEvents: () =>
        TE.right([
          constructEvent('AreaCreated')({
            id: v4() as UUID,
            name: faker.commerce.productName(),
            description: faker.commerce.productDescription(),
          }),
          constructEvent('AreaCreated')({
            id: v4() as UUID,
            name: faker.commerce.productName(),
            description: faker.commerce.productDescription(),
          }),
          constructEvent('AreaCreated')({
            id: v4() as UUID,
            name: faker.commerce.productName(),
            description: faker.commerce.productDescription(),
          }),
        ]),
    };
    it('should show up the areas', async () => {
      const viewModel = await pipe(
        arbitraryUser(),
        constructViewModel(deps),
        TE.getOrElse(shouldNotBeCalled)
      )();
      expect(viewModel.areas).toHaveLength(3);
    });
  });
});
