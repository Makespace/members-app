import {UUID} from 'io-ts-types';
import {Actor} from '../../types';

type TrainerInformation = {
  memberNumber: number;
  email: string;
  name: string;
  trainerSince: Date;
  markedTrainerBy: Actor;
};

type OwnerInformation = {
  memberNumber: number;
  email: string;
  name: string;
  ownerSince: Date;
  markedOwnerBy: Actor;
};

type TrainedUser = {
  memberNumber: number;
  email: string;
  name: string;
  trainedSince: Date;
  markedTrainedBy: Actor;
};

type AreaInformation = {
  id: UUID;
  name: string;
};

type EquipmentInformation = {
  equipment_id: UUID;
  equipment_name: string;
};

export type ViewModel = {
  byAreaByEquipment: ReadonlyArray<{
    area: AreaInformation;
    owners: ReadonlyArray<OwnerInformation>;
    byEquipment: ReadonlyArray<{
      equipment: EquipmentInformation;
      trainers: ReadonlyArray<TrainerInformation>;
      trainedMembers: ReadonlyArray<TrainedUser>;
    }>;
  }>;
};
