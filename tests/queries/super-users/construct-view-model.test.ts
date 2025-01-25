import * as E from 'fp-ts/Either';
import {pipe} from 'fp-ts/lib/function';
import {arbitraryUser} from '../../types/user.helper';
import {constructViewModel} from '../../../src/queries/super-users/construct-view-model';
import {Dependencies} from '../../../src/dependencies';
import {happyPathAdapters} from '../../init-dependencies/happy-path-adapters.helper';
import * as TE from 'fp-ts/TaskEither';
import {constructEvent} from '../../../src/types';
import * as T from 'fp-ts/Task';
import * as RA from 'fp-ts/ReadonlyArray';
import {getRightOrFail} from '../../helpers';

describe.skip('construct-view-model', () => {
  it('succeeds if the logged in user is not a super user', async () => {
    const memberToBeSuperUser = arbitraryUser();
    const deps: Dependencies = {
      ...happyPathAdapters,
      getAllEvents: () =>
        TE.right([
          constructEvent('SuperUserDeclared')({
            memberNumber: memberToBeSuperUser.memberNumber,
          }),
        ]),
    };

    const result = await pipe(
      memberToBeSuperUser,
      constructViewModel(deps),
      T.map(getRightOrFail),
      T.map(viewModel => viewModel.superUsers),
      T.map(RA.map(superUser => superUser.memberNumber))
    )();

    expect(result).toStrictEqual([memberToBeSuperUser.memberNumber]);
  });

  it('fails if the logged in user is not a super user', async () => {
    const deps: Dependencies = happyPathAdapters;
    const result = await pipe(arbitraryUser(), constructViewModel(deps))();

    expect(result).toStrictEqual(E.left(expect.anything()));
  });
});
