import {add} from './add';
import {addForm} from './add-form';
import {registerTrainingSheet} from './register-training-sheet';

export const equipment = {
  add: {
    ...add,
    ...addForm,
  },
  training_sheet: {
    ...registerTrainingSheet,
  }
};
