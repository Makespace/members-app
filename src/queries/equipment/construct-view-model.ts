import {pipe} from 'fp-ts/lib/function';
import {Dependencies} from '../../dependencies';
import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import {readModels} from '../../read-models';
import {
  FailureWithStatus,
} from '../../types/failure-with-status';
import {
  ViewModel,
} from './view-model';
import {User} from '../../types';
import {DomainEvent} from '../../types/domain-event';
import {Equipment} from '../../read-models/equipment/get';
import {UUID} from 'io-ts-types';
import {Member} from '../../read-models/members';

const isSuperUserOrOwnerOfArea = (
  events: ReadonlyArray<DomainEvent>,
  areaId: UUID,
  memberNumber: number
): boolean =>
  readModels.superUsers.is(memberNumber)(events) ||
  readModels.areas.isOwner(events)(areaId, memberNumber);

const isSuperUserOrTrainerOfEquipment = (
  events: ReadonlyArray<DomainEvent>,
  equipment: Equipment,
  memberNumber: number
): boolean =>
  readModels.superUsers.is(memberNumber)(events) ||
  equipment.trainers.includes(memberNumber);

export const constructViewModel =
  (deps: Dependencies, user: User) =>
  (equipmentId: UUID): TE.TaskEither<FailureWithStatus, ViewModel> =>
    pipe(
      {user},
      TE.right,
      TE.bind('equipment', () => deps.sharedReadModel.equipment.get(equipmentId)),
      TE.let('isSuperUserOrOwnerOfArea', ({events, equipment}) => {

      },
        O.some(deps.sharedReadModel.members.get(user.memberNumber)) ? 
        isSuperUserOrOwnerOfArea(events, equipment.areaId, user.memberNumber)
      ),
      TE.let('isSuperUserOrTrainerOfArea', ({events, equipment}) =>
        isSuperUserOrTrainerOfEquipment(events, equipment, user.memberNumber)
      )
    );
