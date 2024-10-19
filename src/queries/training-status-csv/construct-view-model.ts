import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {readModels} from '../../read-models';
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
      byAreaByEquipment: pipe(
        deps.sharedReadModel.equipment.getAll(),
        RA.map(equipment => ({
          
        }))
      ),
    });
  };
pipe(
  deps.getAllEvents(),
  TE.filterOrElse(readModels.superUsers.is(user.memberNumber), () =>
    failureWithStatus(
      'You do not have the necessary permission to see this page.',
      StatusCodes.UNAUTHORIZED
    )()
  ),
  TE.map(events => ({events}) satisfies ViewModel)
);
