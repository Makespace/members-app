import {getAll, getAllDetails} from './get-all';
import {getDetails} from './get';
import {lookupByEmail} from './lookup-by-email';
import {getPotentialOwners} from './get-potential-owners';

export const members = {
  lookupByEmail,
  getAll,
  getAllDetails,
  getDetails,
  getPotentialOwners,
};
