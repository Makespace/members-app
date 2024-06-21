import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {FailureWithStatus} from '../../types/failure-with-status';
import {isEventOfType} from '../../types/domain-event';
import {User} from '../../types/user';
import {ViewModel} from './view-model';
import {readModels} from '../../read-models';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.map(events => ({
        viewerIsSuperUser: readModels.superUsers.is(user.memberNumber)(events),
        members: pipe(
          events,
          RA.filter(isEventOfType('MemberNumberLinkedToEmail'))
        ),
      }))
    );
