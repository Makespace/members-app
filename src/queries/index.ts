import {flow} from 'fp-ts/lib/function';
import {areas} from './areas';
import {landing} from './landing';
import {superUsers} from './super-users';
import asyncHandler from 'express-async-handler';
import {area} from './area';
import {allEquipment} from './all-equipment';
import {equipment} from './equipment';
import {log} from './log';

export const queries = {
  allEquipment: flow(allEquipment, asyncHandler),
  areas: flow(areas, asyncHandler),
  area: area,
  equipment: flow(equipment, asyncHandler),
  superUsers: flow(superUsers, asyncHandler),
  landing: landing,
  log: flow(log, asyncHandler),
};
