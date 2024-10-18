import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as E from 'fp-ts/Either';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {StatusCodes} from 'http-status-codes';
import {sequenceS} from 'fp-ts/lib/Apply';

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (memberNumber: number): E.Either<FailureWithStatus, ViewModel> =>
    pipe(
      {
        user: E.right(user),
        isSelf: E.right(memberNumber === user.memberNumber),
        member: pipe(
          deps.sharedReadModel.members.getAsActor(user)(memberNumber),
          E.fromOption(() =>
            failureWithStatus('No such member', StatusCodes.NOT_FOUND)()
          )
        ),
      },
      sequenceS(E.Apply)
    );

// Use the shared read model for getting member information
// Add redacting of this information
// Display the extra training information
