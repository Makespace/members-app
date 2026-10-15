import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import {StatusCodes} from 'http-status-codes';
import {UUID} from 'io-ts-types';
import {formatValidationErrors} from 'io-ts-reporters';
import {Dependencies} from '../../dependencies';
import {User} from '../../types';
import {
  failureWithStatus,
  FailureWithStatus,
} from '../../types/failure-with-status';
import {liftActorOrUser} from '../../read-models/lift-actor-or-user';
import {isAdminOrSuperUser} from '../../commands/authentication-helpers/is-admin-or-super-user';
import {canManageAreaEquipment} from '../../commands/authentication-helpers/can-manage-area-equipment';
import {ViewModel} from './view-model';

// Super users get every action; an area's owners get the equipment ones they
// are allowed (orange/green bulk-add and categories). Anyone else is turned
// away rather than shown an empty page.
export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (areaParam: unknown): E.Either<FailureWithStatus, ViewModel> =>
    pipe(
      areaParam,
      UUID.decode,
      E.mapLeft(formatValidationErrors),
      E.mapLeft(failureWithStatus('Invalid area', StatusCodes.BAD_REQUEST)),
      E.chain(areaId =>
        pipe(
          deps.sharedReadModel.area.get(areaId),
          E.fromOption(() =>
            failureWithStatus('No such area', StatusCodes.NOT_FOUND)()
          )
        )
      ),
      E.filterOrElse(
        area =>
          canManageAreaEquipment({
            actor: liftActorOrUser(user),
            rm: deps.sharedReadModel,
            input: {areaId: area.id},
          }),
        () =>
          failureWithStatus(
            'Only owners of this area (or admins) can manage it',
            StatusCodes.FORBIDDEN
          )()
      ),
      E.map(area => {
        const visible = area.equipment.filter(item =>
          O.isNone(item.removedAt)
        );
        return {
          areaId: area.id,
          areaName: area.name,
          isSuperUser: isAdminOrSuperUser({
            actor: liftActorOrUser(user),
            rm: deps.sharedReadModel,
          }),
          equipmentCount: visible.length,
          categoryCount: deps.sharedReadModel.area.getEquipmentCategories(
            area.id
          ).length,
          uncategorisedCount: visible.filter(item =>
            O.isNone(item.areaCategoryId)
          ).length,
        };
      })
    );
