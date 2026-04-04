import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/lib/function';
import { Actor } from '../../types';
import { EquipmentId } from '../../types/equipment-id';
import { SharedReadModel } from '../../read-models/shared-state';

export const isEquipmentOwner = (input: {
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
      O.flatMap(e => input.rm.area.get(e.area.id)),
      O.match(
        () => false,
        area => area.owners.some(o => o.memberNumber === actorMemberNumber)
      )
    );
  };
