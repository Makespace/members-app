import * as E from 'fp-ts/Either';
import {constructViewModel} from '../../../src/routes/dashboard/construct-view-model';
import * as TE from 'fp-ts/TaskEither';
import {faker} from '@faker-js/faker';
import {Dependencies} from '../../../src/dependencies';
import {EmailAddress, User, failure} from '../../../src/types';
import {happyPathAdapters} from '../../adapters/happy-path-adapters.helper';

describe('construct-view-model', () => {
  describe('when the trainers cannot be fetched', () => {
    const user: User = {
      emailAddress: faker.internet.email() as EmailAddress,
      memberNumber: faker.number.int(),
    };
    const deps: Dependencies = {
      ...happyPathAdapters,
      getTrainers: () => TE.left(failure('something failed')()),
    };
    it('returns on the left', async () => {
      const viewModel = await constructViewModel(deps)(user)();
      expect(viewModel).toStrictEqual(E.left(expect.anything()));
    });
  });
});
