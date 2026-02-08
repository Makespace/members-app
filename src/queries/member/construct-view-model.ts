import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
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
  (memberNumber: number): E.Either<FailureWithStatus, ViewModel> => {
    const userDetails = deps.sharedReadModel.members.get(user.memberNumber);

    const memberScoped = deps.sharedReadModel.members.getAsActor(user)(memberNumber);


    return pipe(
      {
        user: E.right(user),
        isSelf: E.right(memberNumber === user.memberNumber),
        member: pipe(
          ,
          E.fromOption(() =>
            failureWithStatus('No such member', StatusCodes.NOT_FOUND)()
          )
        ),
        isSuperUser: E.right(
          O.isSome(userDetails) && userDetails.value.isSuperUser
        ),
        
      },
      sequenceS(E.Apply)
    );
  };

// Use the shared read model for getting member information
// Add redacting of this information
// Display the extra training information
