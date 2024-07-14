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
import {sequenceS} from 'fp-ts/lib/Apply';
import {readModels} from '../../read-models';
import {loggedInMemberDetails} from '../../logged-in-member-details';

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (memberNumber: number): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.map(events => ({
        user: E.right(user),
        isSelf: E.right(memberNumber === user.memberNumber),
        member: pipe(
          events,
          readModels.members.getDetails(memberNumber),
          E.fromOption(() =>
            failureWithStatus('No such member', StatusCodes.NOT_FOUND)()
          )
        ),
        loggedInMember: loggedInMemberDetails(events, user), // Potential optimisation here when a member is checking their own page we don't need to get details twice.
      })),
      TE.chainEitherK(sequenceS(E.Apply))
    );
