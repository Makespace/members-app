import {pipe} from 'fp-ts/lib/function';
import * as TE from 'fp-ts/TaskEither';
import {FailureWithStatus} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {SharedReadModel} from '../../read-models/shared-state';

export const constructViewModel =
  (sharedReadModel: SharedReadModel) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      TE.right(sharedReadModel.members.getAll()),
      TE.map(members => ({
        members,
        user,
      }))
    );
