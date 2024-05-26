import {add} from './add';
import {addForm} from './add-form';

export const equipment = {
  add: {
    ...add,
    ...addForm,
  },
};
