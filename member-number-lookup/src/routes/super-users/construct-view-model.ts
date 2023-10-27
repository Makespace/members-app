import {pipe} from 'fp-ts/lib/function';
import {DomainEvent, User, isEventOfType} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';
import {queries} from '../../queries';

const isSuperUser = (user: User) => (events: ReadonlyArray<DomainEvent>) =>
  pipe(
    events,
    RA.filter(isEventOfType('SuperUserDeclared')),
    RA.some(event => event.memberNumber === user.memberNumber)
  );

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.filterOrElse(
        isSuperUser(user),
        failureWithStatus(
          'Only super-users can see this page',
          StatusCodes.UNAUTHORIZED
        )
      ),
      TE.map(events => ({
        user: user,
        superUsers: queries.superUsers.getAll()(events),
      }))
    );
