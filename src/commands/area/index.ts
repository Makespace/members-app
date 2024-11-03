import {addOwner} from './add-owner';
import {addOwnerForm} from './add-owner-form';
import {create} from './create';
import {createForm} from './create-form';
import {removeArea} from './remove-area';
import {removeAreaForm} from './remove-area-form';

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
    ...removeArea,
    ...removeAreaForm,
  },
};
