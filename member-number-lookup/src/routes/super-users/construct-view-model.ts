import {sequenceS} from 'fp-ts/lib/Apply';
import {pipe} from 'fp-ts/lib/function';
import {User, isEventOfType} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {FailureWithStatus} from '../../types/failureWithStatus';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      {
        user: TE.right(user),
        superUsers: pipe(
          deps.getAllEvents(),
          TE.map(RA.filter(isEventOfType('SuperUserDeclared'))),
          TE.map(
            RA.map(event => ({
              memberNumber: event.memberNumber,
              since: event.declaredAt,
            }))
          )
        ),
      },
      sequenceS(TE.ApplySeq)
    );
