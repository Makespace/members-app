import {UUID} from 'io-ts-types';

export type ViewModel = {
  areaId: UUID;
  areaName: string;
  // Owners who are not super users only see the equipment actions.
  isSuperUser: boolean;
  // Visible (non-obsolete) equipment, and how much of it has no category.
  equipmentCount: number;
  categoryCount: number;
  uncategorisedCount: number;
};
