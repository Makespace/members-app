import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as T from 'fp-ts/Task';
import {faker} from '@faker-js/faker';
import {Dependencies} from '../../../src/dependencies';
import {constructEvent} from '../../../src/types';
import {happyPathAdapters} from '../../init-dependencies/happy-path-adapters.helper';
import {pipe} from 'fp-ts/lib/function';
import {constructViewModel} from '../../../src/queries/areas/construct-view-model';
import {arbitraryUser} from '../../types/user.helper';
import {v4} from 'uuid';
import {UUID} from 'io-ts-types';
import {getRightOrFail} from '../../helpers';

describe('construct-view-model', () => {
  describe('when the user has not been declared to be a super user', () => {
    const deps: Dependencies = happyPathAdapters;

    it('does not return the page', async () => {
      const viewModel = await pipe(arbitraryUser(), constructViewModel(deps))();
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
          }),
        ]),
    };

    it('shows the page', async () => {
      const viewModel = await pipe(user, constructViewModel(deps))();
      expect(viewModel).toStrictEqual(E.right(expect.anything()));
    });

    describe('when area there are no areas', () => {
      const deps: Dependencies = {
        ...happyPathAdapters,
        getAllEvents: () =>
          TE.right([
            constructEvent('SuperUserDeclared')({
              memberNumber: user.memberNumber,
            }),
          ]),
      };

      it('should return nothing', async () => {
        const viewModel = await pipe(
          user,
          constructViewModel(deps),
          T.map(getRightOrFail)
        )();
        expect(viewModel.areas).toStrictEqual([]);
      });
    });

    describe('when an area is created', () => {
      const deps: Dependencies = {
        ...happyPathAdapters,
        getAllEvents: () =>
          TE.right([
            constructEvent('SuperUserDeclared')({
              memberNumber: user.memberNumber,
            }),
            constructEvent('AreaCreated')({
              id: v4() as UUID,
              name: faker.commerce.productName(),
            }),
            constructEvent('AreaCreated')({
              id: v4() as UUID,
              name: faker.commerce.productName(),
            }),
            constructEvent('AreaCreated')({
              id: v4() as UUID,
              name: faker.commerce.productName(),
            }),
          ]),
      };
      it('should show up the areas', async () => {
        const viewModel = await pipe(
          user,
          constructViewModel(deps),
          T.map(getRightOrFail)
        )();
        expect(viewModel.areas).toHaveLength(3);
      });
    });
  });
});
