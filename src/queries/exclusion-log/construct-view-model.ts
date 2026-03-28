import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {readModels} from '../../read-models';
import {FailureWithStatus, failureWithStatus} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import { ViewModel } from './view-model';


export const constructViewModel =
  (deps: Dependencies) => (user: User) => (): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.filterOrElse(readModels.superUsers.is(user.memberNumber), () =>
        failureWithStatus(
          'You do not have the necessary permission to see this page.',
          StatusCodes.FORBIDDEN
        )()
      ),
      TE.chain(
        (_events) => deps.getAllExclusionEvents()
      ),
      TE.map(
        events => ({events})
      )
    );
