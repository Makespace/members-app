import {add} from './add';
import {addForm} from './add-form';
import {registerTrainingSheet} from './register-training-sheet';
import {registerTrainingSheetForm} from './register-training-sheet-form';
import {removeTrainingSheet} from './remove-training-sheet';
import {removeTrainingSheetForm} from './remove-training-sheet-form';
import {removeEquipment} from './remove';
import {removeEquipmentForm} from './remove-form';

export const equipment = {
  add: {
    ...add,
    ...addForm,
  },
  trainingSheet: {
    ...registerTrainingSheet,
    ...registerTrainingSheetForm,
  },
  removeTrainingSheet: {
    ...removeTrainingSheet,
    ...removeTrainingSheetForm,
  },
  remove: {
    ...removeEquipment,
    ...removeEquipmentForm,
  },
};
