import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {ViewModel} from './view-model';
import * as RA from 'fp-ts/ReadonlyArray';
import {readModels} from '../../read-models';
import {failureWithStatus} from '../../types/failureWithStatus';
import {StatusCodes} from 'http-status-codes';

export const constructViewModel = (deps: Dependencies) => (user: User) =>
  pipe(
    deps.getAllEvents(),
    TE.filterOrElse(readModels.superUsers.is(user.memberNumber), () =>
      failureWithStatus(
        'You do not have the necessary permission to see this page.',
        StatusCodes.UNAUTHORIZED
      )()
    ),
    TE.map(RA.reverse),
    TE.map(
      events =>
        ({
          events,
          user,
        }) satisfies ViewModel
    )
  );
