import {addOwner} from './add-owner';
import {addOwnerForm} from './add-owner-form';
import {create} from './create';
import {createForm} from './create-form';
import {removeArea} from './remove-area';
import {removeAreaForm} from './remove-area-form';
import {removeOwner} from './remove-owner';
import {removeOwnerForm} from './remove-owner-form';
import {setMailingList} from './set-mailing-list';
import {setMailingListForm} from './set-mailing-list-form';


export const area = {
  create: {
    ...create,
    ...createForm,
  },
  addOwner: {
    ...addOwner,
    ...addOwnerForm,
  },
  removeOwner: {
    ...removeOwner,
    ...removeOwnerForm,
  },
  remove: {
    ...removeArea,
    ...removeAreaForm,
  },
  setMailingList: {
    ...setMailingList,
    ...setMailingListForm,
  },
};
