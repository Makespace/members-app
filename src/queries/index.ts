import {flow} from 'fp-ts/lib/function';
import {areas} from './areas';
import {landing} from './landing';
import {superUsers} from './super-users';
import asyncHandler from 'express-async-handler';

export const queries = {
  areas: flow(areas, asyncHandler),
  superUsers: flow(superUsers, asyncHandler),
  landing: flow(landing, asyncHandler),
};
