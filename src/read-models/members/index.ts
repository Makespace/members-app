import {getAll, getAllDetails} from './get-all';
import {getDetails} from './get';
import {lookupByEmail} from './lookup-by-email';
import {getPotentialOwners} from './get-potential-owners';
import {getFailedImports} from './get-failed-imports';

export const members = {
  lookupByEmail,
  getAll,
  getAllDetails,
  getDetails,
  getFailedImports,
  getPotentialOwners,
};
