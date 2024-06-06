import {add} from './add';
import {addForm} from './add-form';
import {registerTrainingSheet} from './register-training-sheet';
import {registerTrainingSheetForm} from './register-training-sheet-form';

export const equipment = {
  add: {
    ...add,
    ...addForm,
  },
  training_sheet: {
    ...registerTrainingSheet,
    ...registerTrainingSheetForm,
  },
};
