import {getAll} from './getAll';
import {getDetails} from './get-details';
import {lookupByEmail} from './lookup-by-email';
import {getPotentialOwners} from './getPotentialOwners';

export const members = {
  lookupByEmail,
  getAll,
  getDetails,
  getPotentialOwners,
};
