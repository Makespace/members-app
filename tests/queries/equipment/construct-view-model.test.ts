import * as TE from 'fp-ts/TaskEither';
import {constructViewModel} from '../../../src/queries/equipment/construct-view-model';
import {UUID} from 'io-ts-types';
import {v4} from 'uuid';
import {StatusCodes} from 'http-status-codes';
import {getLeftOrFail} from '../../helpers.js';
import { happyPathAdapters } from '../../init-dependencies/happy-path-adapters.helper';
import {arbitraryUser} from '../../types/user.helper';
import {Dependencies} from '../../../src/dependencies';

describe('construct-view-model', () => {
  describe('no equipment events', () => {
    const user = arbitraryUser();
    const deps: Dependencies = {
      ...happyPathAdapters,
      getAllEvents: () => TE.right([]),
    };
    it('Produces a failure status', async () => {
      const failure = getLeftOrFail(
        await constructViewModel(deps, user)(v4() as UUID)()
      );
      expect(failure.status).toEqual(StatusCodes.NOT_FOUND);
    });
  });
});
