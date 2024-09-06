import {addOwner} from './add-owner';
import {addOwnerForm} from './add-owner-form';
import {create} from './create';
import {createForm} from './create-form';
import {remove} from './remove';
import {removeForm} from './remove-form';

export const area = {
  create: {
    ...create,
    ...createForm,
  },
  addOwner: {
    ...addOwner,
    ...addOwnerForm,
  },
  remove: {
    ...remove,
    ...removeForm,
  },
};
