import {SharedReadModel} from '../../read-models/shared-state';
import {Actor} from '../../types';
import {EquipmentId} from '../../types/equipment-id';
import {isAdminOrSuperUser} from './is-admin-or-super-user';
import {isEquipmentOwner} from './is-equipment-owner';

// Deliberately narrower than isAdminSuperUserOrTrainerOrOwnerForEquipment:
// trainers teach on a machine, but the risk assessment is the owning area's
// responsibility.
export const isAdminSuperUserOrOwnerForEquipment = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {
    equipmentId: EquipmentId;
  };
}): boolean => isAdminOrSuperUser(input) || isEquipmentOwner(input);
