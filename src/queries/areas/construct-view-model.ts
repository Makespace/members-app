import {pipe} from 'fp-ts/lib/function';
import {User, isEventOfType} from '../../types';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as RA from 'fp-ts/ReadonlyArray';
import {readModels} from '../../read-models';
import {FailureWithStatus} from '../../types/failureWithStatus';
import {ViewModel} from './view-model';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.map(events => ({
        user: user,
        isSuperUser: readModels.superUsers.is(user.memberNumber)(events),
        areas: pipe(
          events,
          RA.filter(isEventOfType('AreaCreated')),
          RA.map(areaCreated => ({...areaCreated, owners: [1234, 2333]}))
        ),
      }))
    );
