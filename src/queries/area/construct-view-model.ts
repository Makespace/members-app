import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {readModels} from '../../read-models';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failureWithStatus';
import {ViewModel} from './view-model';
import {User} from '../../types';
import {StatusCodes} from 'http-status-codes';
import {sequenceS} from 'fp-ts/lib/Apply';

export type Params = {areaId: string; user: User};

export const constructViewModel =
  (deps: Dependencies) =>
  (params: Params): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.map(events => ({
        user: E.right(params.user),
        isSuperUser: E.right(
          readModels.superUsers.is(params.user.memberNumber)(events)
        ),
        area: pipe(
          params.areaId,
          readModels.areas.getArea(events),
          E.fromOption(() =>
            failureWithStatus('No such area', StatusCodes.NOT_FOUND)()
          )
        ),
        equipment: pipe(
          params.areaId,
          readModels.equipment.getForArea(events),
          E.right
        ),
      })),
      TE.chainEitherK(sequenceS(E.Apply))
    );
