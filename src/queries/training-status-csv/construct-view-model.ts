import {pipe} from 'fp-ts/lib/function';
import {User} from '../../types';
import {Dependencies} from '../../dependencies';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as RA from 'fp-ts/ReadonlyArray';
import {ViewModel} from './view-model';
import {
  FailureWithStatus,
  failureWithStatus,
} from '../../types/failure-with-status';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';

export const constructViewModel =
  (deps: Dependencies) =>
  (user: User): E.Either<FailureWithStatus, ViewModel> => {
    const requestUser = deps.sharedReadModel.members.get(user.memberNumber);
    if (O.isNone(requestUser) || !requestUser.value.isSuperUser) {
      return E.left(
        failureWithStatus(
          'You do not have the necessary permission to see this page.',
          StatusCodes.UNAUTHORIZED
        )()
      );
    }
    return E.right({
      byArea: pipe(
        deps.sharedReadModel.equipment.getAll(),
        RA.map(equipment => ({
          area: equipment.area,
          owners: pipe(
            equipment.area.id as UUID,
            deps.sharedReadModel.area.get,
            O.map(areaDetails => {
              return [];
            }),
            //   pipe(
            //     areaDetails.owners,
            //     RA.map(owner => ({
            //       detais: deps.sharedReadModel.members.get(owner.memberNumber),
            //       ownershipRecordedAt: owner.ownershipRecordedAt,
            //     }))
            //   )
            // ),
            O.getOrElse<ReadonlyArray<ViewModel['byArea'][0]['owners']>>(
              () => []
            )
          ),
          equipment,
        }))
      ),
    });
  };
