import { SharedReadModel } from "../../read-models/shared-state";
import { Actor } from "../../types";
import { EquipmentId } from "../../types/equipment-id";
import { isAdminOrSuperUser } from "./is-admin-or-super-user";
import { isEquipmentTrainer } from "./is-equipment-trainer";

export const isAdminSuperUserOrTrainerForEquipment = (input: {
  actor: Actor;
  rm: SharedReadModel;
  input: {
    equipmentId: EquipmentId
  }
}) =>
  isAdminOrSuperUser(input) ||
  isEquipmentTrainer(input);
