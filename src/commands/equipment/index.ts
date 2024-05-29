import {add} from './add';
import {addForm} from './add-form';
import {addTrainingSheet} from './add-training-sheet';

export const equipment = {
  add: {
    ...add,
    ...addForm,
  },
  training_sheet: {
    ...addTrainingSheet,
  }
};
