import {Params} from '../query';
import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {ViewModel} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';
import {mustBeSuperuser} from '../util';
import { FailureWithStatus } from '../../types/failure-with-status';

export const constructViewModel =
  (deps: Dependencies) => (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      mustBeSuperuser(deps.sharedReadModel, user),
      TE.chain(() => deps.getDeletedEvents()),
      TE.map(RA.reverse),
      TE.map(events => {
        return {
          events,
          user,
        };
      })
    );
