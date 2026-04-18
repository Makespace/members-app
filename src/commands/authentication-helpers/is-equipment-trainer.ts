import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import { Actor } from '../../types';
import { SharedReadModel } from '../../read-models/shared-state';
import { EquipmentId } from '../../types/equipment-id';
import {allMemberNumbers} from '../../read-models/shared-state/return-types';

export const isEquipmentTrainer =
  (input: {
    actor: Actor;
    rm: SharedReadModel;
    input: {
      equipmentId: EquipmentId
    }
  }) => {
    if (input.actor.tag !== 'user') {
      return false;
    }
    const actorMemberNumber = input.actor.user.memberNumber;
    return pipe(
      input.input.equipmentId,
      input.rm.equipment.get,
      O.match(
        () => false,
        e => e.trainers.some(t => allMemberNumbers(t).includes(actorMemberNumber))
      )
    );
  };
