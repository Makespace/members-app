import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as E from 'fp-ts/Either';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failureWithStatus';
import {isEventOfType} from '../../types/domain-event';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {StatusCodes} from 'http-status-codes';
import {sequenceS} from 'fp-ts/lib/Apply';
import * as O from 'fp-ts/Option';

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (memberNumber: number): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.map(events => ({
        user: E.right(user),
        member: pipe(
          events,
          RA.filter(isEventOfType('MemberNumberLinkedToEmail')),
          RA.findFirst(event => event.memberNumber === memberNumber),
          O.map(event => ({
            email: event.email,
            memberNumber: event.memberNumber,
          })),
          E.fromOption(() =>
            failureWithStatus('No such member', StatusCodes.NOT_FOUND)()
          )
        ),
      })),
      TE.chainEitherK(sequenceS(E.Apply))
    );
