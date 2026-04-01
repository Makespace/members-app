import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import { Actor } from '../../types';
import { SharedReadModel } from '../../read-models/shared-state';
import { EquipmentId } from '../../types/equipment-id';

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
    return pipe(
      input.actor.user.memberNumber,
      input.rm.members.get,
      O.match(
        () => false,
        m => m.trainerFor.some(t => t.equipment_id === input.input.equipmentId)
      ),
    );
  };
