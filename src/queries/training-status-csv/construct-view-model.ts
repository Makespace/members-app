import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {ViewModel} from './view-model';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): E.Either<FailureWithStatus, ViewModel> => {
    const requestUser = deps.sharedReadModel.members.get(user.memberNumber);
    if (O.isNone(requestUser) || !requestUser.value.isSuperUser) {
      return E.left(
        failureWithStatus(
          'You do not have the necessary permission to see this page.',
          StatusCodes.UNAUTHORIZED
        )()
      );
    }
    return E.right({
      areas: deps.sharedReadModel.area.getAll(),
    });
  };
