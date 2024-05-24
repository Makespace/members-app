import {addOwner} from './add-owner';
import {create} from './create';
import {createForm} from './create-form';

export const area = {
  create: {
    ...create,
    ...createForm,
  },
  addOwner: {
    ...addOwner,
  },
};
