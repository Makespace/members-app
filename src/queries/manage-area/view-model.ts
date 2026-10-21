import * as O from 'fp-ts/Option';
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
  // The purchasing area whose yearly budget this area's purchases come out
  // of, if it is in one.
  purchasingArea: O.Option<{id: UUID; name: string}>;
};
