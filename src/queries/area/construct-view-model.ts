import {pipe} from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import {readModels} from '../../read-models';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {ViewModel} from './view-model';
import {User} from '../../types';
import {StatusCodes} from 'http-status-codes';
import {sequenceS} from 'fp-ts/lib/Apply';
import {UUID} from 'io-ts-types';

export const constructViewModel =
  (deps: Dependencies) =>
  (areaId: UUID, user: User): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      deps.getAllEvents(),
      TE.map(events => ({
        user: E.right(user),
        isSuperUser: E.right(
          readModels.superUsers.is(user.memberNumber)(events)
        ),
        area: pipe(
          areaId,
          readModels.areas.getArea(events),
          E.fromOption(() =>
            failureWithStatus('No such area', StatusCodes.NOT_FOUND)()
          )
        ),
        equipment: pipe(
          areaId,
          readModels.equipment.getForArea(events),
          E.right
        ),
      })),
      TE.chainEitherK(sequenceS(E.Apply))
    );
