import {areas} from './areas';
import {landing} from './landing';
import {superUsers} from './super-users';
import {area} from './area';
import {allEquipment} from './all-equipment';
import {equipment} from './equipment';
import {log} from './log';
import {Query} from './query';

export const queries: Record<string, Query> = {
  allEquipment,
  areas,
  area,
  equipment,
  superUsers,
  landing,
  log,
};
