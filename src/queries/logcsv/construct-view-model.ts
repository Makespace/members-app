import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {ViewModel} from './view-model';
import {readModels} from '../../read-models';
import {failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';

export const constructViewModel = (deps: Dependencies) => (user: User) =>
  pipe(
    deps.getAllEvents(),
    TE.filterOrElse(readModels.superUsers.is(user.memberNumber), () =>
      failureWithStatus(
        'You do not have the necessary permission to see this page.',
        StatusCodes.FORBIDDEN
      )()
    ),
    TE.map(events => ({events}) satisfies ViewModel)
  );
