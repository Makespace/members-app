import {UUID} from 'io-ts-types';
import {Actor} from '../../types';
import {SharedReadModel} from '../../read-models/shared-state';
import {isAdminOrSuperUser} from './is-admin-or-super-user';
import {isAreaOwner} from './is-area-owner';

// Who may look after an area's equipment list (its categories, and adding
// orange/green kit): admins and super users, plus the area's own owners.
export const canManageAreaEquipment = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {areaId: UUID};
}): boolean => isAdminOrSuperUser(input) || isAreaOwner(input);
