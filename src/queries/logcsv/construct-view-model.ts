import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {ViewModel} from './view-model';
import {readModels} from '../../read-models';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {sequenceS} from 'fp-ts/lib/Apply';

export const constructViewModel = (deps: Dependencies) => (user: User) =>
  pipe(
    {
      authEvents: deps.getAllEvents(),
      events: deps.getAllEventsWithDeletionStatus(),
    },
    sequenceS(TE.ApplyPar),
    TE.filterOrElse(({authEvents}) => readModels.superUsers.is(user.memberNumber)(authEvents), () =>
      failureWithStatus(
        'You do not have the necessary permission to see this page.',
        StatusCodes.FORBIDDEN
      )()
    ),
    TE.map(({events}) => ({events}) satisfies ViewModel)
  );
