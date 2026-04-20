import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {readModels} from '../../read-models';
import {mustBeSuperuser} from '../util';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      mustBeSuperuser(deps.sharedReadModel, user),
      TE.chain(() => deps.getAllEvents()),
      TE.map(events => ({
        failedImports: readModels.members.getFailedImports(events),
        user,
      }))
    );
