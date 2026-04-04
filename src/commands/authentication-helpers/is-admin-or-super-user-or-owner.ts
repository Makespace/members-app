import { SharedReadModel } from "../../read-models/shared-state";
import { Actor } from "../../types";
import { EquipmentId } from "../../types/equipment-id";
import { isAdminOrSuperUser } from "./is-admin-or-super-user";
import { isEquipmentOwner } from "./is-equipment-owner";

export const isAdminSuperUserOrOwnerForEquipment = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {
    equipmentId: EquipmentId
  };
}) =>
  isAdminOrSuperUser(input) ||
  isEquipmentOwner(input);
