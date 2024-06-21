import {getAll} from './get-all';
import {getDetails} from './get-details';
import {lookupByEmail} from './lookup-by-email';
import {getPotentialOwners} from './get-potential-owners';

export const members = {
  lookupByEmail,
  getAll,
  getDetails,
  getPotentialOwners,
};
