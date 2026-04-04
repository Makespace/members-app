import { SharedReadModel } from "../../read-models/shared-state";
import { Actor } from "../../types";
import { EquipmentId } from "../../types/equipment-id";
import { isAdminOrSuperUser } from "./is-admin-or-super-user";
import { isEquipmentOwner } from "./is-equipment-owner";
import { isEquipmentTrainer } from "./is-equipment-trainer";

export const isAdminSuperUserOrTrainerOrOwnerForEquipment = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {
    equipmentId: EquipmentId
  };
}): boolean =>
  isAdminOrSuperUser(input) ||
  isEquipmentTrainer(input) ||
  isEquipmentOwner(input);
