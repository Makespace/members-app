import * as O from 'fp-ts/Option';
import {pipe} from 'fp-ts/function';
import {UUID} from 'io-ts-types';
import {SharedReadModel} from '../read-models/shared-state';
import {resolveEquipmentByName} from '../read-models/shared-state/equipment/get';
import {resolveAreaByName} from '../read-models/shared-state/area/get';
import {TicketPermission} from '../types/trouble-ticket-permission';

// Uses the same name/alias resolution as TroubleTicketCreated's projection.
// Unassigned tickets belong to area-owner too: only super-users can see them
// until an area is assigned.
export const defaultTicketPermission = (
  rm: SharedReadModel,
  managementAreaId: string,
  input: {
    equipmentId?: UUID | null;
    areaId?: UUID | null;
    submittedEquipment?: string | null;
  }
): TicketPermission => {
  const equipmentId =
    input.equipmentId ??
    (input.submittedEquipment
      ? O.toNullable(
          resolveEquipmentByName(rm.readOnlyDb)(input.submittedEquipment)
        )
      : null);
  const areaId =
    equipmentId !== null
      ? pipe(
          rm.equipment.get(equipmentId),
          O.map(equipment => equipment.area.id),
          O.toNullable
        )
      : (input.areaId ??
        (input.submittedEquipment
          ? O.toNullable(
              resolveAreaByName(rm.readOnlyDb)(input.submittedEquipment)
            )
          : null));
  return managementAreaId !== '' && areaId === managementAreaId
    ? 'manager'
    : 'area-owner';
};
