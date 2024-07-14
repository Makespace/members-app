import {readModels} from './read-models';
import {DomainEvent, MemberDetails, User} from './types';
import * as E from 'fp-ts/Either';
import {
  failureWithStatus,
  FailureWithStatus,
} from './types/failure-with-status';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';

export const userMemberDetails = (
  events: ReadonlyArray<DomainEvent>,
  user: User
): E.Either<FailureWithStatus, MemberDetails> =>
  pipe(
    events,
    readModels.members.getDetails(user.memberNumber),
    E.fromOption(() =>
      failureWithStatus('Unknown logged in member', StatusCodes.NOT_FOUND)()
    )
  );
