import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {StatusCodes} from 'http-status-codes';

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (memberNumber: number): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      pipe(
        memberNumber,
        deps.sharedReadModel.members.get,
        E.fromOption(() =>
          failureWithStatus('No such member', StatusCodes.NOT_FOUND)()
        ),
        E.bindTo('member'),
        E.let('user', () => user),
        TE.fromEither
      )
    );
